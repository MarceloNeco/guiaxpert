-- GuiaXpert — 11/Nov/2026: convite preso a um e-mail, com código de 6 números.
-- Quem convida diz o e-mail da pessoa; o app gera link + código. A pessoa abre o link, digita o código e cria a senha:
-- a conta nasce já confirmada (sem e-mail de confirmação) e entra na viagem. Link vazado não serve para outro e-mail.
alter table public.guiaxpert_convites add column if not exists email text;
alter table public.guiaxpert_convites add column if not exists codigo_hash text;
alter table public.guiaxpert_convites add column if not exists tentativas int not null default 0;

create or replace function public.guiaxpert_criar_convite_email(p_viagem uuid, p_papel text, p_email text, p_dias int default 14)
returns table(token text, codigo text)
language plpgsql security definer set search_path to '' as $function$
declare v_tok text := ''; v_cod text; v_abc text := 'abcdefghjkmnpqrstuvwxyz23456789'; i int; v_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null then raise exception 'Entre na conta' using errcode = '42501'; end if;
  if not exists (select 1 from public.guiaxpert_dados d where d.loja = 'viagens' and d.id = p_viagem and d.user_id = auth.uid()) then
    raise exception 'Só o dono convida' using errcode = '42501'; end if;
  if p_papel not in ('edita', 've') then raise exception 'Papel inválido' using errcode = '22023'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido' using errcode = '22023'; end if;
  for i in 1..24 loop v_tok := v_tok || substr(v_abc, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 31), 1); end loop;
  v_cod := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  insert into public.guiaxpert_convites (viagem_id, dono, token_hash, papel, valido_ate, usos_max, email, codigo_hash)
    values (p_viagem, auth.uid(), encode(extensions.digest(v_tok, 'sha256'), 'hex'), p_papel,
            now() + make_interval(days => greatest(1, least(p_dias, 90))), 1, v_email,
            encode(extensions.digest(v_tok || ':' || v_cod, 'sha256'), 'hex'));
  return query select v_tok, v_cod;
end; $function$;
revoke all on function public.guiaxpert_criar_convite_email(uuid, text, text, int) from public, anon;
grant execute on function public.guiaxpert_criar_convite_email(uuid, text, text, int) to authenticated;

-- aceitar: convite com e-mail só vale para a conta desse e-mail
create or replace function public.guiaxpert_aceitar_convite(p_token text)
 returns table(viagem_id uuid, papel text, nome text)
 language plpgsql security definer set search_path to '' as $function$
#variable_conflict use_column
declare c record; v_nome text;
begin
  if auth.uid() is null then raise exception 'Entre na conta' using errcode = '42501'; end if;
  select * into c from public.guiaxpert_convites k where k.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found or c.valido_ate < now() or c.usos >= c.usos_max then raise exception 'Convite inválido ou vencido' using errcode = '22023'; end if;
  if c.dono = auth.uid() then raise exception 'Você já é o dono' using errcode = '22023'; end if;
  if c.email is not null and lower(c.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'Este convite é para outro e-mail' using errcode = '42501'; end if;
  insert into public.guiaxpert_membros (viagem_id, user_id, papel, dono) values (c.viagem_id, auth.uid(), c.papel, c.dono)
    on conflict (viagem_id, user_id) do update set papel = excluded.papel;
  update public.guiaxpert_convites set usos = usos + 1 where id = c.id;
  select d.dados->>'nome' into v_nome from public.guiaxpert_dados d where d.loja = 'viagens' and d.id = c.viagem_id;
  return query select c.viagem_id, c.papel, v_nome;
end; $function$;

-- ver o convite antes de entrar: agora diz também o e-mail e se pede código
drop function if exists public.guiaxpert_ver_convite(text);
create function public.guiaxpert_ver_convite(p_token text)
 returns table(viagem text, quem text, papel text, email text, pede_codigo boolean)
 language plpgsql stable security definer set search_path to '' as $function$
declare c record;
begin
  if p_token is null or length(p_token) < 16 then return; end if;
  select * into c from public.guiaxpert_convites k where k.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found or c.valido_ate < now() or c.usos >= c.usos_max then return; end if;
  return query
    select (select d.dados->>'nome' from public.guiaxpert_dados d where d.loja = 'viagens' and d.id = c.viagem_id),
           split_part(coalesce(nullif(u.raw_user_meta_data->>'name', ''), nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)), ' ', 1),
           c.papel, c.email, c.codigo_hash is not null
    from auth.users u where u.id = c.dono;
end; $function$;
revoke all on function public.guiaxpert_ver_convite(text) from public;
grant execute on function public.guiaxpert_ver_convite(text) to anon, authenticated;

-- só para a função do servidor (service_role): confere o código; 5 erros travam o convite
create or replace function public.guiaxpert_conferir_codigo(p_token text, p_codigo text)
 returns table(ok boolean, email text, motivo text)
 language plpgsql security definer set search_path to '' as $function$
declare c record;
begin
  select * into c from public.guiaxpert_convites k where k.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found or c.valido_ate < now() or c.usos >= c.usos_max or c.email is null then return query select false, null::text, 'convite'; return; end if;
  if c.tentativas >= 5 then return query select false, null::text, 'travado'; return; end if;
  if c.codigo_hash <> encode(extensions.digest(p_token || ':' || regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), 'sha256'), 'hex') then
    update public.guiaxpert_convites set tentativas = tentativas + 1 where id = c.id;
    return query select false, null::text, 'codigo'; return;
  end if;
  return query select true, c.email, null::text;
end; $function$;
revoke all on function public.guiaxpert_conferir_codigo(text, text) from public, anon, authenticated;
grant execute on function public.guiaxpert_conferir_codigo(text, text) to service_role;
