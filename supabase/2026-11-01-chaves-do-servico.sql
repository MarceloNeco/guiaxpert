-- SolverONE — chaves do serviço (Gemini, Tripadvisor, Foursquare, Google) guardadas CIFRADAS no Supabase Vault,
-- cadastradas pelo app por quem é dono/admin da equipe. Rodar de novo não estraga nada.
--
-- Como funciona:
--  - O app manda a chave uma vez (HTTPS) para admin_salvar_chave. Ela vai para o Vault (cifrada no disco, a chave de
--    cifra fica fora do banco). Nunca volta inteira: a tela só vê "cadastrada · termina em 4f2a · data".
--  - As Edge Functions leem com chave_servico(nome), que só o servidor (service_role) pode chamar.
--  - Cada mudança fica no acesso_log, sem o valor.

-- nomes permitidos (o resto é recusado)
create or replace function public._chave_nome_ok(p_nome text) returns boolean
language sql immutable as $$ select p_nome in ('GEMINI_API_KEY', 'TRIPADVISOR_KEY', 'FOURSQUARE_KEY', 'GOOGLE_PLACES_KEY') $$;

-- salvar ou apagar chave exige login confirmado nos últimos 15 minutos ('amr' do token = horário do login de verdade)
create or replace function public._exigir_login_recente(p_minutos int default 15)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_ts bigint;
begin
  select max((x->>'timestamp')::bigint) into v_ts from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) x;
  if v_ts is null or to_timestamp(v_ts) < now() - make_interval(mins => p_minutos) then
    raise exception 'login-recente' using errcode = '42501', hint = 'Confirme sua identidade de novo para mexer nas chaves.';
  end if;
end; $$;
revoke all on function public._exigir_login_recente(int) from public, anon, authenticated;
create or replace function public.admin_salvar_chave(p_nome text, p_valor text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid; v_valor text := btrim(coalesce(p_valor, ''));
begin
  perform public._exigir_admin();
  perform public._exigir_login_recente(15);
  if not public._chave_nome_ok(p_nome) then raise exception 'Nome de chave não permitido' using errcode = '22023'; end if;
  if length(v_valor) < 12 or length(v_valor) > 400 or v_valor ~ '\s' then raise exception 'Chave com formato inválido' using errcode = '22023'; end if;
  select id into v_id from vault.secrets where name = 'srv:' || p_nome;
  if v_id is null then
    perform vault.create_secret(v_valor, 'srv:' || p_nome, 'Chave do serviço SolverONE (cadastrada pelo app)');
  else
    perform vault.update_secret(v_id, v_valor, 'srv:' || p_nome, 'Chave do serviço SolverONE (cadastrada pelo app)');
  end if;
  insert into public.acesso_log (quem, acao, depois) values (auth.uid(), 'chave-salva', jsonb_build_object('nome', p_nome, 'final', right(v_valor, 4)));
  return jsonb_build_object('nome', p_nome, 'final', right(v_valor, 4), 'atualizado_em', now());
end; $$;

create or replace function public.admin_apagar_chave(p_nome text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public._exigir_admin();
  perform public._exigir_login_recente(15);
  if not public._chave_nome_ok(p_nome) then raise exception 'Nome de chave não permitido' using errcode = '22023'; end if;
  delete from vault.secrets where name = 'srv:' || p_nome;
  insert into public.acesso_log (quem, acao, depois) values (auth.uid(), 'chave-apagada', jsonb_build_object('nome', p_nome));
end; $$;

-- o que a tela pode ver: se existe, os 4 últimos caracteres e quando mudou
create or replace function public.admin_status_chaves()
returns table (nome text, cadastrada boolean, final text, atualizado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._exigir_admin();
  return query
    select n.nome, d.id is not null, case when d.id is null then null else right(d.decrypted_secret, 4) end, d.updated_at
      from unnest(array['GEMINI_API_KEY', 'TRIPADVISOR_KEY', 'FOURSQUARE_KEY', 'GOOGLE_PLACES_KEY']) as n(nome)
      left join vault.decrypted_secrets d on d.name = 'srv:' || n.nome;
end; $$;

-- só o servidor lê o valor
create or replace function public.chave_servico(p_nome text)
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'srv:' || p_nome and public._chave_nome_ok(p_nome) limit 1
$$;

-- a tela pergunta "sou admin?" sem erro
create or replace function public.sou_admin_equipe() returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce(public.eh_admin_equipe(), false) $$;

revoke all on function public._chave_nome_ok(text) from public, anon, authenticated;
revoke all on function public.admin_salvar_chave(text, text) from public, anon;
revoke all on function public.admin_apagar_chave(text) from public, anon;
revoke all on function public.admin_status_chaves() from public, anon;
revoke all on function public.chave_servico(text) from public, anon, authenticated;
revoke all on function public.sou_admin_equipe() from public, anon;
grant execute on function public.admin_salvar_chave(text, text) to authenticated;
grant execute on function public.admin_apagar_chave(text) to authenticated;
grant execute on function public.admin_status_chaves() to authenticated;
grant execute on function public.sou_admin_equipe() to authenticated;
grant execute on function public.chave_servico(text) to service_role;

-- conta do dono no GuiaXpert como admin da equipe (para gerenciar as chaves pelo app)
insert into public.equipe (user_id, papel)
select id, 'admin' from auth.users where lower(email) = 'marceloneco@gmail.com'
on conflict (user_id) do nothing;

-- (admin_salvar_chave e admin_apagar_chave chamam public._exigir_login_recente(15) logo depois de _exigir_admin)

create or replace function public.admin_historico_chaves()
returns table (quando timestamptz, acao text, nome text, final text, quem text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._exigir_admin();
  return query select l.quando, l.acao, l.depois->>'nome', l.depois->>'final', coalesce(u.email, l.email)::text
    from public.acesso_log l left join auth.users u on u.id = l.quem
   where l.acao in ('chave-salva', 'chave-apagada') order by l.quando desc limit 20;
end; $$;
revoke all on function public.admin_historico_chaves() from public, anon;
grant execute on function public.admin_historico_chaves() to authenticated;

-- Quem pode GASTAR as chaves do serviço (ninguém vê a chave; isto decide só quem usa):
--  1) a equipe (dono/admin);  2) quem foi convidado para uma viagem de alguém da equipe.
-- Outras famílias usam a própria chave de IA (cofre pessoal) ou ficam sem; a busca aberta (OpenStreetMap) segue para todos.
create or replace function public.pode_usar_chaves_servico()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.equipe e where e.user_id = auth.uid() and e.papel in ('dono', 'admin'))
    or exists (select 1 from public.guiaxpert_membros m join public.equipe e on e.user_id = m.dono
               where m.user_id = auth.uid() and e.papel in ('dono', 'admin'))
  )
$$;
revoke all on function public.pode_usar_chaves_servico() from public, anon;
grant execute on function public.pode_usar_chaves_servico() to authenticated;
