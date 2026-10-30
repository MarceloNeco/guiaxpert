-- =====================================================================
-- 2026-10-30-acesso-por-app-e-codigos.sql
-- GuiaXpert (e qualquer app da SolverONE): quem pode usar o app e
-- códigos de degustação com validade, controlados pelo RootifyONE.
--
-- COMO RODAR (uma vez):
--   1. Supabase → projeto solverone-app → SQL Editor → New query.
--   2. Cole este arquivo inteiro e clique em Run.
--   3. Deve aparecer "Success. No rows returned".
--   Rodar de novo não estraga nada.
--
-- PRECISA ANTES: os scripts de 27/Set do solverone-app (equipe, assinaturas,
-- pre_liberacoes, acesso_log, _exigir_admin). Eles já foram rodados.
--
-- REGRAS
-- - Liberado no app = (plano ativo na plataforma, tabela assinaturas)
--                     OU (acesso do app ainda válido, vindo de um código).
-- - O código nunca fica guardado em texto: só o "hash" (SHA-256). Quem cria
--   o código vê o texto UMA vez (o RootifyONE mostra e você repassa).
-- - Só dono/admin da equipe cria, lista e desativa códigos.
-- - Tudo vai para acesso_log (quem, quando, o quê).
-- =====================================================================

-- 1. Tabelas ------------------------------------------------------------
create table if not exists public.codigos_acesso (
  id          uuid primary key default gen_random_uuid(),
  app         text not null check (app ~ '^[a-z0-9-]{2,40}$'),
  hash        text not null unique,                -- sha256 do código em maiúsculas, sem espaços
  dica        text not null,                       -- 4 primeiros caracteres, para reconhecer na lista
  nota        text,                                -- ex.: "Família Freitas", "degustação feira"
  valido_ate  timestamptz,                         -- até quando o código pode ser usado (null = sem prazo)
  dias_acesso int not null default 7 check (dias_acesso between 1 and 3650), -- quanto tempo de app ele dá
  usos_max    int not null default 1 check (usos_max between 1 and 10000),
  usos        int not null default 0,
  ativo       boolean not null default true,
  criado_por  uuid,
  criado_em   timestamptz not null default now()
);
alter table public.codigos_acesso enable row level security;
-- sem policy: ninguém lê direto; só pelas funções abaixo
revoke all on table public.codigos_acesso from public, anon, authenticated;
grant select on table public.codigos_acesso to service_role;

create table if not exists public.acessos_app (
  user_id     uuid not null references auth.users (id) on delete cascade,
  app         text not null check (app ~ '^[a-z0-9-]{2,40}$'),
  origem      text not null default 'codigo' check (origem in ('codigo', 'manual')),
  codigo_id   uuid references public.codigos_acesso (id) on delete set null,
  valida_ate  timestamptz not null,
  criado_em   timestamptz not null default now(),
  primary key (user_id, app)
);
alter table public.acessos_app enable row level security;
drop policy if exists "acessos_app: ver o proprio" on public.acessos_app;
create policy "acessos_app: ver o proprio" on public.acessos_app
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.acessos_app from public, anon;
grant select on table public.acessos_app to authenticated;

-- 2. "Posso usar este app?" ----------------------------------------------
create or replace function public.acesso_app(p_app text)
returns table (liberado boolean, origem text, plano text, valida_ate timestamptz)
language plpgsql stable security definer set search_path = '' as $$
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
  select c.valida_ate into x from public.acessos_app c
   where c.user_id = auth.uid() and c.app = p_app and c.valida_ate > now();
  if found then
    return query select true, 'codigo'::text, 'degustacao'::text, x.valida_ate; return;
  end if;
  return query select false, 'bloqueado'::text, null::text, null::timestamptz;
end; $$;
revoke all on function public.acesso_app(text) from public, anon;
grant execute on function public.acesso_app(text) to authenticated;

-- 3. Resgatar um código de degustação ------------------------------------
create or replace function public.resgatar_codigo(p_app text, p_codigo text)
returns table (liberado boolean, valida_ate timestamptz, mensagem text)
language plpgsql volatile security definer set search_path = '' as $$
declare c record; v_hash text; v_ate timestamptz;
begin
  if auth.uid() is null then raise exception 'Entre na conta primeiro' using errcode = '42501'; end if;
  v_hash := encode(extensions.digest(upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex');
  select * into c from public.codigos_acesso k where k.hash = v_hash and k.app = p_app for update;
  if not found or not c.ativo then
    insert into public.acesso_log (quem, acao, depois) values (auth.uid(), 'codigo-invalido', jsonb_build_object('app', p_app));
    return query select false, null::timestamptz, 'invalido'::text; return;
  end if;
  if c.valido_ate is not null and c.valido_ate < now() then
    return query select false, null::timestamptz, 'expirado'::text; return;
  end if;
  if c.usos >= c.usos_max then
    return query select false, null::timestamptz, 'esgotado'::text; return;
  end if;
  v_ate := now() + make_interval(days => c.dias_acesso);
  insert into public.acessos_app (user_id, app, origem, codigo_id, valida_ate)
       values (auth.uid(), p_app, 'codigo', c.id, v_ate)
  on conflict (user_id, app) do update set valida_ate = greatest(public.acessos_app.valida_ate, excluded.valida_ate), codigo_id = excluded.codigo_id;
  update public.codigos_acesso set usos = usos + 1 where id = c.id;
  insert into public.acesso_log (quem, acao, depois)
       values (auth.uid(), 'codigo-resgatado', jsonb_build_object('app', p_app, 'codigo', c.dica, 'ate', v_ate));
  return query select true, v_ate, 'ok'::text;
end; $$;
revoke all on function public.resgatar_codigo(text, text) from public, anon;
grant execute on function public.resgatar_codigo(text, text) to authenticated;

-- 4. Admin (RootifyONE): criar, listar e desativar códigos ---------------
-- Devolve o código em texto UMA vez. Formato: GX-XXXX-XXXX (sem letras confusas).
create or replace function public.admin_criar_codigo(
  p_app text, p_dias int default 7, p_valido_ate timestamptz default null,
  p_usos_max int default 1, p_nota text default null)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_txt text := ''; v_abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int; v_pref text;
begin
  perform public._exigir_admin();
  v_pref := upper(left(regexp_replace(p_app, '[^a-z]', '', 'g'), 2));
  for i in 1..8 loop
    v_txt := v_txt || substr(v_abc, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1);
  end loop;
  v_txt := v_pref || '-' || left(v_txt, 4) || '-' || right(v_txt, 4);
  insert into public.codigos_acesso (app, hash, dica, nota, valido_ate, dias_acesso, usos_max, criado_por)
  values (p_app, encode(extensions.digest(regexp_replace(v_txt, '[^A-Z0-9]', '', 'g'), 'sha256'), 'hex'),
          left(v_txt, 7), p_nota, p_valido_ate, p_dias, p_usos_max, auth.uid());
  insert into public.acesso_log (quem, acao, depois)
       values (auth.uid(), 'codigo-criado', jsonb_build_object('app', p_app, 'dica', left(v_txt, 7), 'dias', p_dias, 'usos', p_usos_max, 'valido_ate', p_valido_ate));
  return v_txt;
end; $$;
revoke all on function public.admin_criar_codigo(text, int, timestamptz, int, text) from public, anon;
grant execute on function public.admin_criar_codigo(text, int, timestamptz, int, text) to authenticated;

create or replace function public.admin_listar_codigos(p_app text)
returns table (id uuid, dica text, nota text, valido_ate timestamptz, dias_acesso int, usos int, usos_max int, ativo boolean, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._exigir_admin();
  return query select k.id, k.dica, k.nota, k.valido_ate, k.dias_acesso, k.usos, k.usos_max, k.ativo, k.criado_em
    from public.codigos_acesso k where k.app = p_app order by k.criado_em desc limit 500;
end; $$;
revoke all on function public.admin_listar_codigos(text) from public, anon;
grant execute on function public.admin_listar_codigos(text) to authenticated;

create or replace function public.admin_desativar_codigo(p_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public._exigir_admin();
  update public.codigos_acesso set ativo = false where id = p_id;
  insert into public.acesso_log (quem, acao, depois) values (auth.uid(), 'codigo-desativado', jsonb_build_object('id', p_id));
end; $$;
revoke all on function public.admin_desativar_codigo(uuid) from public, anon;
grant execute on function public.admin_desativar_codigo(uuid) to authenticated;

-- Para testar (logado como dono no SQL Editor não funciona, porque lá não há auth.uid()):
-- crie o código pelo RootifyONE ou, só para o primeiro teste, rode como service role:
--   insert into public.codigos_acesso (app, hash, dica, nota, dias_acesso, usos_max)
--   values ('guiaxpert', encode(extensions.digest('GXTESTE1234','sha256'),'hex'), 'GX-TEST', 'teste', 7, 5);
--   → o código para digitar no app é: GX-TESTE-1234 (também aceita gxteste1234)
