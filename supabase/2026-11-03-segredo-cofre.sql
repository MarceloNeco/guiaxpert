-- GuiaXpert — segredo do cofre por conta (aplicado em 03/Nov/2026 como migração guiaxpert_segredo_cofre).
-- O cofre das reservas abre sozinho em qualquer aparelho logado: a chave vai embrulhada com este segredo,
-- que o servidor só entrega ao próprio dono (auth.uid()), no máximo 30 vezes por hora.
create table if not exists public.cofre_segredo (
  user_id uuid primary key references auth.users(id) on delete cascade,
  segredo text not null,
  criado_em timestamptz not null default now()
);
create table if not exists public.cofre_segredo_uso (
  user_id uuid not null references auth.users(id) on delete cascade,
  quando timestamptz not null default now()
);
alter table public.cofre_segredo enable row level security;
alter table public.cofre_segredo_uso enable row level security;
revoke all on public.cofre_segredo, public.cofre_segredo_uso from anon, authenticated;

create or replace function public.meu_segredo_cofre()
returns text language plpgsql security definer set search_path to '' as $function$
declare v text; n int;
begin
  if auth.uid() is null then raise exception 'sem-sessao' using errcode = '42501'; end if;
  select count(*) into n from public.cofre_segredo_uso where user_id = auth.uid() and quando > now() - interval '1 hour';
  if n >= 30 then raise exception 'muitas-tentativas' using errcode = '42501'; end if;
  insert into public.cofre_segredo_uso (user_id) values (auth.uid());
  select segredo into v from public.cofre_segredo where user_id = auth.uid();
  if v is null then
    v := encode(extensions.gen_random_bytes(32), 'base64');
    insert into public.cofre_segredo (user_id, segredo) values (auth.uid(), v) on conflict (user_id) do nothing;
    select segredo into v from public.cofre_segredo where user_id = auth.uid();
  end if;
  delete from public.cofre_segredo_uso where quando < now() - interval '1 day';
  return v;
end; $function$;
revoke all on function public.meu_segredo_cofre() from public, anon;
grant execute on function public.meu_segredo_cofre() to authenticated;
