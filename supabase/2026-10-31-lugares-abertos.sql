-- GuiaXpert — base aberta de lugares (FSQ OS Places, Apache 2.0) no servidor. OPCIONAL.
-- Fica vazia até alguém carregar o CSV gerado por ferramentas/fsq-os-places/recortar.py.
-- Com a tabela carregada, a função 'lugares' usa esta base (sem limite de cache) no lugar da API do Foursquare.
-- Crédito obrigatório no app: "Powered by Foursquare". Rodar de novo não estraga nada.
-- 11/Nov/2026: as extensões moram no schema `extensions` (não mais em `public`), por causa do advisor de segurança do
-- Supabase (rootify-one/entrega/solverone-app/supabase/2026-11-11-extensoes-fora-do-public.sql, aplicado em 11/Nov).
-- Por isso tudo aqui cita extensions.* por extenso; gx_simples usa search_path vazio e buscar_lugares_abertos,
-- search_path = extensions. Rodar este arquivo de novo mantém isso (não devolve nada para public).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists unaccent with schema extensions;

create table if not exists public.lugares_abertos (
  fsq_id        text primary key,
  nome          text not null,
  categoria     text not null,          -- comer | bebidas | doces | atracao | logistica
  subcategoria  text,
  rotulos       text[],                 -- rótulos originais do Foursquare
  endereco      text,
  cidade        text,
  uf            text,
  pais          text,
  tel           text,
  site          text,
  lat           double precision not null,
  lng           double precision not null,
  fechado       date,
  geom          extensions.geography(point, 4326) generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  carregado_em  timestamptz not null default now()
);

-- função imutável para o índice: sem acento, minúsculo (dicionário dito por extenso: com search_path vazio,
-- unaccent(text) não acharia o dicionário)
create or replace function public.gx_simples(t text) returns text
language sql immutable parallel safe set search_path = ''
as $$ select pg_catalog.lower(extensions.unaccent('extensions.unaccent'::pg_catalog.regdictionary, coalesce(t, ''))) $$;
revoke execute on function public.gx_simples(text) from public;
grant execute on function public.gx_simples(text) to anon, authenticated, service_role;

create index if not exists lugares_abertos_nome_trgm on public.lugares_abertos using gin (public.gx_simples(nome) extensions.gin_trgm_ops);
create index if not exists lugares_abertos_geom on public.lugares_abertos using gist (geom);
create index if not exists lugares_abertos_cat on public.lugares_abertos (categoria);

-- ninguém lê a tabela direto; só pela função abaixo (logado)
alter table public.lugares_abertos enable row level security;
revoke all on public.lugares_abertos from anon, authenticated;

-- busca por nome perto de um ponto. Devolve no formato dos lugares do app.
create or replace function public.buscar_lugares_abertos(p_q text, p_lat double precision default null, p_lng double precision default null,
                                                        p_raio_m integer default 50000, p_limite integer default 10)
returns table (id text, nome text, categoria text, subcategoria text, descricao text, endereco text, site text, telefone text,
               lat double precision, lng double precision, distancia_m double precision)
language sql security definer stable
set search_path = extensions   -- ST_*, <% e word_similarity moram em extensions; o resto está qualificado
as $$
  with q as (select public.gx_simples(regexp_replace(trim(p_q), '^(o|a|os|as|the)\s+', '', 'i')) as t),
  base as (
    select l.*, (select t from q) as t,
           case when p_lat is null then null else ST_Distance(l.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) end as d
    from public.lugares_abertos l, q
    where l.fechado is null
      and (q.t <% public.gx_simples(l.nome) or public.gx_simples(l.nome) like '%' || q.t || '%')   -- palavra parecida dentro do nome (tolera erro de digitação)
      and (p_lat is null or ST_DWithin(l.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, greatest(p_raio_m, 1000)))
  )
  select 'fsq-' || fsq_id, nome, categoria, subcategoria,
         array_to_string((select array_agg(split_part(r, ' > ', array_length(string_to_array(r, ' > '), 1))) from unnest(rotulos[1:2]) r), ', '),
         endereco, site, tel, lat, lng, d
  from base
  where length(t) >= 2
  order by (case when public.gx_simples(nome) like t || '%' then 0 else 1 end), word_similarity(t, public.gx_simples(nome)) desc, d nulls last
  limit least(greatest(p_limite, 1), 25);
$$;

revoke all on function public.buscar_lugares_abertos(text, double precision, double precision, integer, integer) from public, anon;
grant execute on function public.buscar_lugares_abertos(text, double precision, double precision, integer, integer) to authenticated, service_role;

-- quantos lugares há (para a função 'lugares' decidir se usa a base ou a API)
create or replace function public.lugares_abertos_total() returns bigint
language sql security definer stable set search_path = public as $$ select count(*) from public.lugares_abertos $$;
revoke all on function public.lugares_abertos_total() from public, anon;
grant execute on function public.lugares_abertos_total() to authenticated, service_role;

comment on table public.lugares_abertos is 'FSQ OS Places (Foursquare, Apache 2.0) recortado. Carga: ferramentas/fsq-os-places/. Powered by Foursquare.';
