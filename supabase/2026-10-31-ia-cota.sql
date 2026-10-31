-- SolverONE — cota de IA por pessoa para a função 'ia' (chave da SolverONE no servidor).
-- Quem tem chave própria não passa por aqui. Rodar de novo não estraga nada.

create table if not exists public.ia_uso (
  user_id   uuid not null references auth.users(id) on delete cascade,
  app       text not null,
  dia       date not null default current_date,
  chamadas  integer not null default 0,
  primary key (user_id, app, dia)
);
alter table public.ia_uso enable row level security;
revoke all on public.ia_uso from anon, authenticated;

-- conta uma chamada; devolve { ok, restante_dia, restante_mes }. Limites por app ficam aqui (simples de mudar).
create or replace function public.ia_consumir(p_app text, p_limite_dia integer default 60, p_limite_mes integer default 900)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dia integer; v_mes integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'motivo', 'sem-conta'); end if;
  select coalesce(sum(chamadas), 0) into v_mes from public.ia_uso where user_id = v_uid and app = p_app and dia >= date_trunc('month', current_date)::date;
  select coalesce(chamadas, 0) into v_dia from public.ia_uso where user_id = v_uid and app = p_app and dia = current_date;
  v_dia := coalesce(v_dia, 0);
  if v_dia >= p_limite_dia then return jsonb_build_object('ok', false, 'motivo', 'cota-dia', 'restante_dia', 0, 'restante_mes', greatest(p_limite_mes - v_mes, 0)); end if;
  if v_mes >= p_limite_mes then return jsonb_build_object('ok', false, 'motivo', 'cota-mes', 'restante_dia', greatest(p_limite_dia - v_dia, 0), 'restante_mes', 0); end if;
  insert into public.ia_uso (user_id, app, dia, chamadas) values (v_uid, p_app, current_date, 1)
    on conflict (user_id, app, dia) do update set chamadas = public.ia_uso.chamadas + 1;
  return jsonb_build_object('ok', true, 'restante_dia', p_limite_dia - v_dia - 1, 'restante_mes', p_limite_mes - v_mes - 1);
end $$;
revoke all on function public.ia_consumir(text, integer, integer) from public, anon;
grant execute on function public.ia_consumir(text, integer, integer) to authenticated, service_role;

comment on table public.ia_uso is 'Cota de IA por pessoa/app/dia para a função ia (chave da SolverONE). Sem conteúdo das perguntas.';
