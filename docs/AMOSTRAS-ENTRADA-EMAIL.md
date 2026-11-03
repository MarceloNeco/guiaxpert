# Amostras para o robô do roteiro@solverone.com.br (item E1 do roadmap)

Casos reais da viagem a Gramado (Nov/2026), descritos **sem dado pessoal e sem código de ingresso**, para guiar o leitor
por regras (sem IA na maioria das vezes). Recebidos em 02–03/Nov/2026. Os arquivos originais não ficam no repositório.

## Como os e-mails chegam

- **Encaminhados** (ex.: Yahoo Mail no iPhone): o corpo começa com "Enviado do Yahoo Mail para iPhone", depois
  "Iniciar mensagem encaminhada:" e "Em <dia da semana>, <mês> <dia>, <ano>, <hora>, <Remetente> <email> escreveu:".
  O robô tem que achar o **remetente original** nessa linha (é ele que diz qual regra usar), não o de quem encaminhou.
- **Anexos em PDF** trazem o que importa (data, hora, código, QR). O texto do e-mail às vezes não tem a data.
- **Print do WhatsApp** (foto da tela do pedido no site): precisa de leitura de imagem (OCR) — caminho mais caro.

## 1. Ingressos.com.br / Natal Luz — "Pedido Confirmado"

- Remetente: `reservas@ingressos.com.br`. Assunto: "Pedido Confirmado".
- Corpo: "Olá, <Nome>. Seu pedido **OR-xxxxxxxx** foi confirmado com sucesso." + tabela ITEM | QTD | PREÇO
  ("O Grande Desfile de Natal" 2 × R$ 572,00; 1 × R$ 396,00; 1 × R$ 396,00), forma de pagamento, Total.
- **Não tem data nem hora no corpo.** Sozinho, vira "ideia/pendente"; junta com o comprovante ou os ingressos (PDF).
- Regra: `OR-[0-9a-f]{8}` = número do pedido.

## 2. Ingressos.com.br — "Acesse seus pedidos"

- Mesmo remetente. Só um botão de acesso que expira em 24 h. **Sem dado de reserva: ignorar** (e nunca seguir o link).

## 3. Ingresso individual em PDF (plataforma ElevenTickets, um PDF por pessoa)

- Texto: "INGRESSO AGÊNCIA" + **código de 12 caracteres** (A–Z e 0–9, começa com "1030"), "Data/Horário: 20/Novembro/2026
  20:00:00", setor ("Cadeiras D"), número (ex.: 329), categoria (Inteira, Idoso, "Menor com até 15 anos"), nome do
  evento ("O Grande Desfile de Natal | 20/Novembro/2026 20:00:00").
- **O QR code contém exatamente o código** (o app redesenha o QR a partir do código; validado uma vez na entrada).
- O nome do arquivo trazia o nome da pessoa ("Natal_luz_<Nome>.pdf"); o PDF em si não traz.
- Local não aparece: em 2026 o desfile é nos pavilhões do **Expogramado** (Av. Borges de Medeiros, 4111) — vem do catálogo.

## 4. Comprovante do pedido em PDF (ingressos.com.br)

- Pedido OR-…, itens com **data, categoria, setor e hora** ("20/11/2026, Inteira, Cadeira de Pista, 20:00"),
  quantidade, preço, subtotal, desconto por cupom, total, parcelas, regra de cancelamento (7 dias após a compra,
  e não a menos de 48 h do evento).
- Traz **dados pessoais do comprador** (documento parcial, endereço, telefone, e-mail): o robô **descarta** tudo isso.

## 5. Parque Terra Mágica Florybal (plataforma Planne)

- Remetente: `noreply@planne.com.br`. Assunto: "Parque Terra Mágica Florybal - Sua compra foi confirmada com sucesso!"
- Corpo: "O identificador do seu pedido é **XXXXXXXXXX**" (10 caracteres A–Z/0–9), "O seu voucher está anexado",
  contato do parque, endereço (RS 466, 1630, km 5, Caracol, Canela).
- **5 anexos PDF** "voucher-parque-…": um por pessoa, com **código de barras** (não QR), "Pedido #…",
  produto "Passaporte Terra Mágica Florybal", "Utilizar em: dd/mm/aa", quantidade e tipo (adulto, menor…).
- O app precisa mostrar **código de barras** também (não só QR).

## 6. Print do pedido no site (WhatsApp)

- Tela "Itens do pedido" de natalluz.ingressos.com.br: mesmos itens do caso 1, com data, categoria e hora,
  subtotal, total, "Pago", operadora, parcelas. Lido por OCR; serve para conferir.

## Regras que saem daqui

1. Classificar pelo **remetente original** (ingressos.com.br, planne.com.br, companhias aéreas, hotéis, locadoras).
2. Juntar peças do mesmo pedido (e-mail sem data + PDF com data) pelo número do pedido.
3. Um ingresso por pessoa: código, categoria, setor/número; **QR ou código de barras** a partir do código.
4. Descartar dado pessoal do comprador; guardar só o necessário, embaralhado no cofre.
5. Ignorar e-mails sem reserva ("Acesse seus pedidos", marketing).
6. Data dentro de uma viagem → compromisso fixo 🔒 dessa viagem; senão, perguntar "Para qual viagem?".
