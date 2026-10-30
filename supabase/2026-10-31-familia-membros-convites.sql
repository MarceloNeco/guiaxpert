-- =====================================================================
-- 2026-10-31-familia-membros-convites.sql
-- GuiaXpert: compartilhar uma viagem com a família.
--   - guiaxpert_membros: quem participa de qual viagem e com que papel
--     (edita | ve). O dono é quem criou a viagem (user_id da linha).
--   - guiaxpert_convites: link de convite (só o hash do token fica guardado).
--   - guiaxpert_dados ganha a coluna viagem_id e a chave passa a ser (loja, id):
--     um roteiro é UMA linha, editada pelo dono e por quem ele liberou.
--   - Reservas e cofre continuam só do dono. Comida/alergias nunca sobem.
-- COMO RODAR (uma vez): Supabase → SQL Editor → cole tudo → Run.
-- =====================================================================

-- 1. coluna viagem_id e chave (loja, id) -----------------------------------
alter table public.guiaxpert_dados add column if not exists viagem_id uuid;
update public.guiaxpert_dados set viagem_id = case when loja = 'viagens' then id
  else nullif(dados->>'viagem_id', '')::uuid end where viagem_id is null and loja <> 'pessoas' and loja <> 'cofre';
alter table public.guiaxpert_dados drop constraint if exists guiaxpert_dados_pkey;
alter table public.guiaxpert_dados add primary key (loja, id);
create index if not exists guiaxpert_dados_viagem on public.guiaxpert_dados (viagem_id);
create index if not exists guiaxpert_dados_user on public.guiaxpert_dados (user_id, recebido_em);

-- 2. membros e convites ------------------------------------------------------
create table if not exists public.guiaxpert_membros (
  viagem_id  uuid not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  papel      text not null check (papel in ('edita', 've')),
  dono       uuid not null references auth.users (id) on delete cascade,
  desde      timestamptz not null default now(),
  primary key (viagem_id, user_id)
);
alter table public.guiaxpert_membros enable row level security;
drop policy if exists "membros: ver os meus" on public.guiaxpert_membros;
create policy "membros: ver os meus" on public.guiaxpert_membros
  for select to authenticated using ((select auth.uid()) = user_id or (select auth.uid()) = dono);
revoke all on table public.guiaxpert_membros from public, anon;
grant select on table public.guiaxpert_membros to authenticated;   -- escrever só pelas funções abaixo

create table if not exists public.guiaxpert_convites (
  id          uuid primary key default gen_random_uuid(),
  viagem_id   uuid not null,
  dono        uuid not null references auth.users (id) on delete cascade,
  token_hash  text not null unique,
  papel       text not null check (papel in ('edita', 've')),
  valido_ate  timestamptz not null,
  usos_max    int not null default 5,
  usos        int not null default 0,
  criado_em   timestamptz not null default now()
);
alter table public.guiaxpert_convites enable row level security;
revoke all on table public.guiaxpert_convites from public, anon, authenticated;
grant select on table public.guiaxpert_convites to service_role;

-- 3. que viagens eu alcanço (dono ou membro)? security definer evita recursão na RLS
create or replace function public.guiaxpert_viagens_acesso()
returns table (viagem_id uuid, papel text)
language sql stable security definer set search_path = '' as $$
  select d.id, 'dono'::text from public.guiaxpert_dados d where d.loja = 'viagens' and d.user_id = auth.uid()
  union
  select m.viagem_id, m.papel from public.guiaxpert_membros m where m.user_id = auth.uid();
$$;
revoke all on function public.guiaxpert_viagens_acesso() from public, anon;
grant execute on function public.guiaxpert_viagens_acesso() to authenticated;

-- 3b. a pessoa (perfil) de um dono aparece para quem participa de uma viagem dele que a inclui
--     (security definer: lê a tabela sem passar pela RLS, senão a policy entra em recursão)
create or replace function public.guiaxpert_pessoa_compartilhada(p_pessoa uuid, p_dono uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guiaxpert_dados v
     where v.loja = 'viagens' and v.user_id = p_dono
       and v.id in (select m.viagem_id from public.guiaxpert_membros m where m.user_id = auth.uid())
       and v.dados->'pessoas' ? p_pessoa::text);
$$;
revoke all on function public.guiaxpert_pessoa_compartilhada(uuid, uuid) from public, anon;
grant execute on function public.guiaxpert_pessoa_compartilhada(uuid, uuid) to authenticated;

-- 4. RLS de guiaxpert_dados: dono vê tudo o seu; membro vê a viagem (menos reservas e cofre) -----------
drop policy if exists "guiaxpert_dados: ver o proprio" on public.guiaxpert_dados;
drop policy if exists "guiaxpert_dados: criar o proprio" on public.guiaxpert_dados;
drop policy if exists "guiaxpert_dados: mudar o proprio" on public.guiaxpert_dados;
drop policy if exists "guiaxpert_dados: apagar o proprio" on public.guiaxpert_dados;
drop policy if exists "guiaxpert_dados: ver" on public.guiaxpert_dados;
drop policy if exists "guiaxpert_dados: criar" on public.guiaxpert_dados;
drop policy if exists "guiaxpert_dados: mudar" on public.guiaxpert_dados;
drop policy if exists "guiaxpert_dados: apagar" on public.guiaxpert_dados;

create policy "guiaxpert_dados: ver" on public.guiaxpert_dados for select to authenticated using (
  (select auth.uid()) = user_id
  or (loja in ('viagens', 'roteiros', 'lugares', 'favoritos')
      and viagem_id in (select a.viagem_id from public.guiaxpert_viagens_acesso() a))
  or (loja = 'pessoas' and public.guiaxpert_pessoa_compartilhada(id, user_id))
);
create policy "guiaxpert_dados: criar" on public.guiaxpert_dados for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (viagem_id is null or loja = 'viagens'
       or viagem_id in (select a.viagem_id from public.guiaxpert_viagens_acesso() a where a.papel in ('dono', 'edita')))
);
create policy "guiaxpert_dados: mudar" on public.guiaxpert_dados for update to authenticated using (
  (select auth.uid()) = user_id
  or (loja in ('roteiros', 'lugares', 'favoritos')
      and viagem_id in (select a.viagem_id from public.guiaxpert_viagens_acesso() a where a.papel = 'edita'))
) with check (
  (select auth.uid()) = user_id
  or (loja in ('roteiros', 'lugares', 'favoritos')
      and viagem_id in (select a.viagem_id from public.guiaxpert_viagens_acesso() a where a.papel = 'edita'))
);
create policy "guiaxpert_dados: apagar" on public.guiaxpert_dados for delete to authenticated using ((select auth.uid()) = user_id);

-- 5. funções: convidar, aceitar, listar, mudar papel, sair ---------------------
create or replace function public.guiaxpert_criar_convite(p_viagem uuid, p_papel text default 've', p_dias int default 7)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_tok text; v_abc text := 'abcdefghjkmnpqrstuvwxyz23456789'; i int;
begin
  if auth.uid() is null then raise exception 'Entre na conta' using errcode = '42501'; end if;
  if not exists (select 1 from public.guiaxpert_dados d where d.loja = 'viagens' and d.id = p_viagem and d.user_id = auth.uid()) then
    raise exception 'Só o dono convida' using errcode = '42501'; end if;
  if p_papel not in ('edita', 've') then raise exception 'Papel inválido' using errcode = '22023'; end if;
  v_tok := '';
  for i in 1..24 loop v_tok := v_tok || substr(v_abc, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 31), 1); end loop;
  insert into public.guiaxpert_convites (viagem_id, dono, token_hash, papel, valido_ate)
    values (p_viagem, auth.uid(), encode(extensions.digest(v_tok, 'sha256'), 'hex'), p_papel, now() + make_interval(days => greatest(1, least(p_dias, 90))));
  return v_tok;
end; $$;
revoke all on function public.guiaxpert_criar_convite(uuid, text, int) from public, anon;
grant execute on function public.guiaxpert_criar_convite(uuid, text, int) to authenticated;

create or replace function public.guiaxpert_aceitar_convite(p_token text)
returns table (viagem_id uuid, papel text, nome text)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare c record; v_nome text;
begin
  if auth.uid() is null then raise exception 'Entre na conta' using errcode = '42501'; end if;
  select * into c from public.guiaxpert_convites k where k.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found or c.valido_ate < now() or c.usos >= c.usos_max then raise exception 'Convite inválido ou vencido' using errcode = '22023'; end if;
  if c.dono = auth.uid() then raise exception 'Você já é o dono' using errcode = '22023'; end if;
  insert into public.guiaxpert_membros (viagem_id, user_id, papel, dono) values (c.viagem_id, auth.uid(), c.papel, c.dono)
    on conflict (viagem_id, user_id) do update set papel = excluded.papel;
  update public.guiaxpert_convites set usos = usos + 1 where id = c.id;
  select d.dados->>'nome' into v_nome from public.guiaxpert_dados d where d.loja = 'viagens' and d.id = c.viagem_id;
  return query select c.viagem_id, c.papel, v_nome;
end; $$;
revoke all on function public.guiaxpert_aceitar_convite(text) from public, anon;
grant execute on function public.guiaxpert_aceitar_convite(text) to authenticated;

create or replace function public.guiaxpert_listar_membros(p_viagem uuid)
returns table (user_id uuid, email text, papel text, desde timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.guiaxpert_dados d where d.loja = 'viagens' and d.id = p_viagem and d.user_id = auth.uid())
     and not exists (select 1 from public.guiaxpert_membros m where m.viagem_id = p_viagem and m.user_id = auth.uid()) then
    raise exception 'Sem acesso' using errcode = '42501'; end if;
  return query select m.user_id, regexp_replace(u.email, '^(.{2})[^@]*(@.*)$', '\1…\2') as email, m.papel, m.desde
    from public.guiaxpert_membros m join auth.users u on u.id = m.user_id where m.viagem_id = p_viagem order by m.desde;
end; $$;
revoke all on function public.guiaxpert_listar_membros(uuid) from public, anon;
grant execute on function public.guiaxpert_listar_membros(uuid) to authenticated;

create or replace function public.guiaxpert_mudar_membro(p_viagem uuid, p_user uuid, p_papel text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.guiaxpert_dados d where d.loja = 'viagens' and d.id = p_viagem and d.user_id = auth.uid()) then
    raise exception 'Só o dono' using errcode = '42501'; end if;
  if p_papel is null then delete from public.guiaxpert_membros where viagem_id = p_viagem and user_id = p_user;
  elsif p_papel in ('edita', 've') then update public.guiaxpert_membros set papel = p_papel where viagem_id = p_viagem and user_id = p_user;
  else raise exception 'Papel inválido' using errcode = '22023'; end if;
end; $$;
revoke all on function public.guiaxpert_mudar_membro(uuid, uuid, text) from public, anon;
grant execute on function public.guiaxpert_mudar_membro(uuid, uuid, text) to authenticated;

create or replace function public.guiaxpert_sair_viagem(p_viagem uuid)
returns void language sql volatile security definer set search_path = '' as $$
  delete from public.guiaxpert_membros where viagem_id = p_viagem and user_id = auth.uid();
$$;
revoke all on function public.guiaxpert_sair_viagem(uuid) from public, anon;
grant execute on function public.guiaxpert_sair_viagem(uuid) to authenticated;
