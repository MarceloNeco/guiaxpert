-- =====================================================================
-- 2026-10-30-nuvem-guiaxpert.sql
-- GuiaXpert: viagens, roteiros, pessoas, favoritos e lugares na conta da
-- pessoa (mesmo formato das "lojas" do aparelho). Cada um só vê o seu.
--
-- NÃO SOBE: reservas e comida/alergias (ficam só no celular, embaralhadas
-- com o PIN/digital). O app tira "restricoes" de pessoas antes de enviar.
--
-- COMO RODAR (uma vez): Supabase → SQL Editor → cole tudo → Run.
-- Rodar de novo não estraga nada.
-- =====================================================================

create table if not exists public.guiaxpert_dados (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  loja         text not null check (loja in ('pessoas', 'viagens', 'roteiros', 'favoritos', 'lugares')),
  id           uuid not null,
  dados        jsonb not null check (pg_column_size(dados) < 262144),
  atualizado_em timestamptz not null,           -- hora do aparelho que mudou (para "o mais novo vence")
  versao       int not null default 1,
  apagado      boolean not null default false,
  recebido_em  timestamptz not null default now(), -- hora do servidor (para baixar só o que mudou)
  primary key (user_id, loja, id)
);
create index if not exists guiaxpert_dados_recebido on public.guiaxpert_dados (user_id, recebido_em);

alter table public.guiaxpert_dados enable row level security;
drop policy if exists "guiaxpert_dados: ver o proprio" on public.guiaxpert_dados;
drop policy if exists "guiaxpert_dados: criar o proprio" on public.guiaxpert_dados;
drop policy if exists "guiaxpert_dados: mudar o proprio" on public.guiaxpert_dados;
drop policy if exists "guiaxpert_dados: apagar o proprio" on public.guiaxpert_dados;
create policy "guiaxpert_dados: ver o proprio" on public.guiaxpert_dados
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "guiaxpert_dados: criar o proprio" on public.guiaxpert_dados
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "guiaxpert_dados: mudar o proprio" on public.guiaxpert_dados
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "guiaxpert_dados: apagar o proprio" on public.guiaxpert_dados
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.guiaxpert_dados from public, anon;
grant select, insert, update, delete on table public.guiaxpert_dados to authenticated;

-- recebido_em sempre com a hora do servidor (o aparelho não escolhe)
create or replace function public.guiaxpert_dados_recebido()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.recebido_em := now();
  return new;
end; $$;
revoke all on function public.guiaxpert_dados_recebido() from public, anon;
grant execute on function public.guiaxpert_dados_recebido() to authenticated;

drop trigger if exists guiaxpert_dados_recebido on public.guiaxpert_dados;
create trigger guiaxpert_dados_recebido before insert or update on public.guiaxpert_dados
  for each row execute function public.guiaxpert_dados_recebido();
