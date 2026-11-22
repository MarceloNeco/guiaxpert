-- GuiaXpert — estado do voo (dono, 22/Nov/2026: "integre com os 3 confirmadores de voo, um cobrindo o outro").
-- Três serviços, nesta ordem: AirLabs, AviationStack, AeroDataBox. As chaves ficam no Vault, como as outras
-- (Configurações → Chaves do serviço). A função voo-status consulta o primeiro que tiver chave e responder;
-- se falhar, cair a cota ou vier sem dado, passa para o próximo. Rodar de novo não estraga nada.

-- nomes de chave permitidos (os de antes + os 3 de voo)
create or replace function public._chave_nome_ok(p_nome text) returns boolean
language sql immutable set search_path = '' as $$
  select p_nome in ('GEMINI_API_KEY', 'TRIPADVISOR_KEY', 'FOURSQUARE_KEY', 'GOOGLE_PLACES_KEY',
                    'AIRLABS_KEY', 'AVIATIONSTACK_KEY', 'AERODATABOX_KEY') $$;
revoke all on function public._chave_nome_ok(text) from public, anon, authenticated;

create or replace function public.admin_status_chaves()
returns table (nome text, cadastrada boolean, final text, atualizado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._exigir_admin();
  return query
    select n.nome, d.id is not null, case when d.id is null then null else right(d.decrypted_secret, 4) end, d.updated_at
      from unnest(array['GEMINI_API_KEY', 'TRIPADVISOR_KEY', 'FOURSQUARE_KEY', 'GOOGLE_PLACES_KEY',
                        'AIRLABS_KEY', 'AVIATIONSTACK_KEY', 'AERODATABOX_KEY']) as n(nome)
      left join vault.decrypted_secrets d on d.name = 'srv:' || n.nome;
end; $$;
revoke all on function public.admin_status_chaves() from public, anon;
grant execute on function public.admin_status_chaves() to authenticated;

-- memória curta das respostas (mesmo voo para a família inteira = uma consulta só a cada poucos minutos).
-- Só o servidor lê e escreve (sem nome de pessoa: só número do voo, data e horários públicos).
create table if not exists public.guiaxpert_voo_cache (
  chave text primary key,          -- 'G31287|2026-11-22'
  dados jsonb not null,
  fonte text,
  em timestamptz not null default now()
);
alter table public.guiaxpert_voo_cache enable row level security;
revoke all on table public.guiaxpert_voo_cache from anon, authenticated;

-- 22/Nov/2026 (dono: "o voo é informação pública"): estado do voo liberado para TODO usuário logado do app,
-- não só para a equipe e os convidados. Proteção da cota grátis: memória curta (acima) + limite de consultas
-- NOVAS por pessoa por dia (o que vem da memória não conta).
create table if not exists public.guiaxpert_voo_uso (
  user_id uuid not null,
  dia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  n int not null default 0,
  primary key (user_id, dia)
);
alter table public.guiaxpert_voo_uso enable row level security;
revoke all on table public.guiaxpert_voo_uso from anon, authenticated;

create or replace function public.guiaxpert_voo_contar(p_user uuid, p_limite int)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v int;
begin
  insert into public.guiaxpert_voo_uso (user_id, dia, n) values (p_user, (now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (user_id, dia) do update set n = public.guiaxpert_voo_uso.n + 1
  returning n into v;
  return v <= p_limite;
end; $$;
revoke all on function public.guiaxpert_voo_contar(uuid, int) from public, anon, authenticated;
grant execute on function public.guiaxpert_voo_contar(uuid, int) to service_role;
