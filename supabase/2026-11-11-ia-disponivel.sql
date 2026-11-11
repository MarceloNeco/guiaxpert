-- GuiaXpert — 11/Nov/2026 (aplicado): a IA do servidor está disponível para esta pessoa?
-- Sim quando há chave de IA guardada no Vault (srv:GEMINI_API_KEY, srv:ANTHROPIC_API_KEY, srv:OPENAI_API_KEY)
-- E a pessoa pode gastar as chaves do serviço (equipe ou convidada para uma viagem da equipe). Não devolve chave nenhuma.
create or replace function public.ia_disponivel()
returns table(disponivel boolean, provedores text[])
language sql stable security definer set search_path = '' as $$
  with ch as (
    select array_agg(lower(replace(replace(substr(s.name, 5), '_API_KEY', ''), '_KEY', '')) order by s.name) as p
    from vault.secrets s
    where s.name in ('srv:GEMINI_API_KEY', 'srv:ANTHROPIC_API_KEY', 'srv:OPENAI_API_KEY')
  )
  select (public.pode_usar_chaves_servico() and coalesce(array_length(ch.p, 1), 0) > 0), case when public.pode_usar_chaves_servico() then ch.p else null end
  from ch;
$$;
revoke all on function public.ia_disponivel() from public, anon;
grant execute on function public.ia_disponivel() to authenticated;
