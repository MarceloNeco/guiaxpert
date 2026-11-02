-- SolverONE — digital (ou rosto) conferida no servidor para confirmar a identidade antes de mexer nas chaves.
-- Usado pela Edge Function "digital" (WebAuthn). Rodar de novo não estraga nada.
--
-- Guarda só a parte PÚBLICA da chave de acesso (passkey) de cada aparelho. A digital nunca sai do celular.
-- Depois de uma confirmação válida, a função grava confirmacao_recente (15 min) e _exigir_login_recente aceita.

create table if not exists public.digital_credenciais (
  id text primary key,                                   -- id da chave de acesso (base64url)
  user_id uuid not null references auth.users (id) on delete cascade,
  chave_publica text not null,                           -- parte pública (COSE, base64url)
  contador bigint not null default 0,                    -- contador de assinaturas (pega clone de chave)
  transportes text[],
  nome text,                                             -- ex.: "Celular" (o que a pessoa vê na lista)
  criado_em timestamptz not null default now(),
  usado_em timestamptz
);
create index if not exists digital_credenciais_user on public.digital_credenciais (user_id);

create table if not exists public.digital_desafios (
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('cadastro', 'entrar')),
  desafio text not null,
  expira timestamptz not null,
  primary key (user_id, tipo)
);

create table if not exists public.confirmacao_recente (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ate timestamptz not null,
  como text
);

-- só o servidor (service_role) mexe nessas tabelas: RLS ligado e nenhuma política para o app
alter table public.digital_credenciais enable row level security;
alter table public.digital_desafios enable row level security;
alter table public.confirmacao_recente enable row level security;
revoke all on public.digital_credenciais, public.digital_desafios, public.confirmacao_recente from anon, authenticated;

-- "login recente" agora aceita: login de verdade nos últimos N minutos (horário dentro do token assinado)
-- OU uma confirmação pela digital conferida no servidor que ainda vale.
create or replace function public._exigir_login_recente(p_minutos int default 15)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_ts bigint;
begin
  if exists (select 1 from public.confirmacao_recente c where c.user_id = auth.uid() and c.ate > now()) then
    return;
  end if;
  select max((x->>'timestamp')::bigint) into v_ts from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) x;
  if v_ts is null or to_timestamp(v_ts) < now() - make_interval(mins => p_minutos) then
    raise exception 'login-recente' using errcode = '42501', hint = 'Confirme sua identidade de novo para mexer nas chaves.';
  end if;
end; $$;
revoke all on function public._exigir_login_recente(int) from public, anon, authenticated;

-- a função "digital" pergunta, com o token da pessoa, se ela pode cadastrar uma digital agora
create or replace function public.pode_cadastrar_digital() returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._exigir_admin();
  perform public._exigir_login_recente(15);
  return true;
end; $$;
revoke all on function public.pode_cadastrar_digital() from public, anon;
grant execute on function public.pode_cadastrar_digital() to authenticated;

-- a pessoa vê as próprias digitais (sem a chave) e pode apagar uma (exige confirmação recente)
create or replace function public.minhas_digitais()
returns table (id text, nome text, criado_em timestamptz, usado_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, d.nome, d.criado_em, d.usado_em from public.digital_credenciais d where d.user_id = auth.uid() order by d.criado_em desc
$$;
revoke all on function public.minhas_digitais() from public, anon;
grant execute on function public.minhas_digitais() to authenticated;

create or replace function public.apagar_minha_digital(p_id text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public._exigir_login_recente(15);
  delete from public.digital_credenciais where id = p_id and user_id = auth.uid();
  insert into public.acesso_log (quem, acao, depois) values (auth.uid(), 'digital-apagada', jsonb_build_object('final', right(p_id, 6)));
end; $$;
revoke all on function public.apagar_minha_digital(text) from public, anon;
grant execute on function public.apagar_minha_digital(text) to authenticated;

-- limpeza: desafios vencidos não servem para nada
delete from public.digital_desafios where expira < now() - interval '1 day';
