-- GuiaXpert — 03/Nov/2026: membros da viagem recebem as reservas dessa viagem.
-- O conteúdo continua embaralhado com a chave do cofre (só abre quem trouxe a chave pelo QR do outro celular);
-- título, data e local (campo agenda) ficam visíveis para quem é da viagem, para o roteiro mostrar o compromisso 🔒.
-- Cofre e pessoas continuam de cada um. Aplicado em 03/Nov/2026.
drop policy if exists "guiaxpert_dados: ver" on public.guiaxpert_dados;
create policy "guiaxpert_dados: ver" on public.guiaxpert_dados for select using (
  ((select auth.uid()) = user_id)
  or ((loja = any (array['viagens','roteiros','lugares','favoritos','reservas'])) and (viagem_id in (select a.viagem_id from public.guiaxpert_viagens_acesso() a(viagem_id, papel))))
  or ((loja = 'pessoas') and public.guiaxpert_pessoa_compartilhada(id, user_id))
);
-- Observação: o registro do cofre ("recuperacao") sobe com o id "recuperacao:<user_id>", porque a chave primária
-- da tabela é (loja, id) e um id fixo bateria entre contas diferentes (feito no app 1.5.20, nuvem.js).
