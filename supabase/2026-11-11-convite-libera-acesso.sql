-- GuiaXpert — 11/Nov/2026: quem entra por convite de viagem não precisa de código de acesso.
-- 1) acesso_app: ser membro de uma viagem do GuiaXpert já libera o app (origem 'viagem').
-- 2) guiaxpert_ver_convite: a tela de entrar mostra "Fulano convidou você para a viagem X" antes do login.
--    Só quem tem o link (token secreto) consegue; devolve apenas o nome da viagem e o primeiro nome de quem convidou.
create or replace function public.acesso_app(p_app text)
 returns table(liberado boolean, origem text, plano text, valida_ate timestamp with time zone)
 language plpgsql stable security definer set search_path to '' as $function$
declare a record; x record;
begin
  if auth.uid() is null then
    return query select false, 'sem-conta'::text, null::text, null::timestamptz; return;
  end if;
  select s.plano, s.valida_ate into a from public.assinaturas s
   where s.user_id = auth.uid() and s.status = 'ativa' and (s.valida_ate is null or s.valida_ate > now());
  if found then
    return query select true, 'plano'::text, a.plano, a.valida_ate; return;
  end if;
  select c.valida_ate, c.origem into x from public.acessos_app c
   where c.user_id = auth.uid() and c.app = p_app and c.valida_ate > now();
  if found then
    return query select true, x.origem::text, (case when x.origem = 'manual' then 'convite' else 'degustacao' end)::text, x.valida_ate; return;
  end if;
  if p_app = 'guiaxpert' and exists (select 1 from public.guiaxpert_membros m where m.user_id = auth.uid()) then
    return query select true, 'viagem'::text, 'convite'::text, null::timestamptz; return;
  end if;
  return query select false, 'bloqueado'::text, null::text, null::timestamptz;
end; $function$;

create or replace function public.guiaxpert_ver_convite(p_token text)
 returns table(viagem text, quem text, papel text)
 language plpgsql stable security definer set search_path to '' as $function$
declare c record;
begin
  if p_token is null or length(p_token) < 16 then return; end if;
  select * into c from public.guiaxpert_convites k where k.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found or c.valido_ate < now() or c.usos >= c.usos_max then return; end if;
  return query
    select (select d.dados->>'nome' from public.guiaxpert_dados d where d.loja = 'viagens' and d.id = c.viagem_id),
           split_part(coalesce(nullif(u.raw_user_meta_data->>'name', ''), nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)), ' ', 1),
           c.papel
    from auth.users u where u.id = c.dono;
end; $function$;
revoke all on function public.guiaxpert_ver_convite(text) from public;
grant execute on function public.guiaxpert_ver_convite(text) to anon, authenticated;
