-- GuiaXpert — 11/Nov/2026: o convite vale para a PESSOA, não para um jeito de entrar.
-- * Já é da viagem (ou é o dono)? Abre a viagem, sem erro, mesmo com convite usado ou vencido.
-- * Entrou com o e-mail indicado no convite, ou convite sem e-mail? Aceita.
-- * Entrou com outro e-mail (ex.: Google de trabalho)? Pede o código do convite (prova que recebeu a mensagem). 5 erros travam.
-- Responde erro = 'codigo-necessario' | 'codigo-errado' | 'travado' (sem exceção, para a tentativa errada ficar contada).
drop function if exists public.guiaxpert_aceitar_convite(text);
create or replace function public.guiaxpert_aceitar_convite(p_token text, p_codigo text default null)
 returns table(viagem_id uuid, papel text, nome text, ja_era boolean, erro text)
 language plpgsql security definer set search_path to '' as $function$
#variable_conflict use_column
declare c record; v_nome text; v_papel text;
begin
  if auth.uid() is null then raise exception 'Entre na conta' using errcode = '42501'; end if;
  select * into c from public.guiaxpert_convites k where k.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found then raise exception 'Convite inválido ou vencido' using errcode = '22023'; end if;
  select d.dados->>'nome' into v_nome from public.guiaxpert_dados d where d.loja = 'viagens' and d.id = c.viagem_id;
  -- já é da viagem: só abre
  if c.dono = auth.uid() then return query select c.viagem_id, 'dono'::text, v_nome, true, null::text; return; end if;
  select m.papel into v_papel from public.guiaxpert_membros m where m.viagem_id = c.viagem_id and m.user_id = auth.uid();
  if found then return query select c.viagem_id, v_papel, v_nome, true, null::text; return; end if;
  if c.valido_ate < now() or c.usos >= c.usos_max then raise exception 'Convite inválido ou vencido' using errcode = '22023'; end if;
  -- convite com e-mail e conta com outro e-mail: precisa do código
  if c.email is not null and lower(c.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    -- (responde com o motivo em vez de dar erro: assim a tentativa errada fica contada)
    if c.tentativas >= 5 then return query select null::uuid, null::text, v_nome, false, 'travado'::text; return; end if;
    if p_codigo is null or length(trim(p_codigo)) = 0 then return query select null::uuid, null::text, v_nome, false, 'codigo-necessario'::text; return; end if;
    if c.codigo_hash <> encode(extensions.digest(p_token || ':' || regexp_replace(p_codigo, '\D', '', 'g'), 'sha256'), 'hex') then
      update public.guiaxpert_convites set tentativas = tentativas + 1 where id = c.id;
      return query select null::uuid, null::text, v_nome, false, 'codigo-errado'::text; return;
    end if;
  end if;
  insert into public.guiaxpert_membros (viagem_id, user_id, papel, dono) values (c.viagem_id, auth.uid(), c.papel, c.dono)
    on conflict (viagem_id, user_id) do update set papel = excluded.papel;
  update public.guiaxpert_convites set usos = usos + 1 where id = c.id;
  return query select c.viagem_id, c.papel, v_nome, false, null::text;
end; $function$;
revoke all on function public.guiaxpert_aceitar_convite(text, text) from public, anon;
grant execute on function public.guiaxpert_aceitar_convite(text, text) to authenticated;
