-- GuiaXpert — 03/Nov/2026: chave da viagem.
-- As reservas de uma viagem passam a ser embaralhadas com uma chave da própria viagem.
-- Quem é da viagem (dono ou membro convidado) recebe essa chave só por estar logado: abre as reservas
-- e os QR Codes em qualquer aparelho, sem PIN e sem QR de outro celular. Quem não é da viagem não recebe.
create table if not exists public.guiaxpert_viagem_segredo (
  viagem_id uuid primary key,
  segredo   text not null,
  criado_em timestamptz not null default now()
);
alter table public.guiaxpert_viagem_segredo enable row level security;
revoke all on public.guiaxpert_viagem_segredo from public, anon, authenticated;

create or replace function public.guiaxpert_segredo_viagem(p_viagem uuid)
returns text language plpgsql security definer set search_path to '' as $function$
declare v text; n int;
begin
  if auth.uid() is null then raise exception 'sem-sessao' using errcode = '42501'; end if;
  if not exists (select 1 from public.guiaxpert_viagens_acesso() a(viagem_id, papel) where a.viagem_id = p_viagem) then
    raise exception 'fora-da-viagem' using errcode = '42501';
  end if;
  select count(*) into n from public.cofre_segredo_uso where user_id = auth.uid() and quando > now() - interval '1 hour';
  if n >= 60 then raise exception 'muitas-tentativas' using errcode = '42501'; end if;
  insert into public.cofre_segredo_uso (user_id) values (auth.uid());
  select segredo into v from public.guiaxpert_viagem_segredo where viagem_id = p_viagem;
  if v is null then
    v := encode(extensions.gen_random_bytes(32), 'base64');
    insert into public.guiaxpert_viagem_segredo (viagem_id, segredo) values (p_viagem, v) on conflict (viagem_id) do nothing;
    select segredo into v from public.guiaxpert_viagem_segredo where viagem_id = p_viagem;
  end if;
  return v;
end; $function$;
revoke all on function public.guiaxpert_segredo_viagem(uuid) from public, anon;
grant execute on function public.guiaxpert_segredo_viagem(uuid) to authenticated;
