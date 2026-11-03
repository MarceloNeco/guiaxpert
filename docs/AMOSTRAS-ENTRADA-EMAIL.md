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
- **5 anexos PDF** "voucher-parque-terra-magica-florybal-<nº>.pdf": um por pessoa. Texto: "Pedido #XXXXXXXXXX",
  número de 10 dígitos (é o do código de barras), "Utilizar em: dd/mm/aaaa", "Quantidade: Passaporte Adulto |
  Infantil (4 a 15 anos) | Melhor Idade: 1", Nome e Sobrenome de quem usa, **Voucher** (8 caracteres) e **Senha**
  (6 caracteres), comprador, valor, regras (reagendar só 24 h antes; 0–3 anos isentos; 60+ com RG/CNH).
- **Código de barras ITF** (2 de 5 intercalado), desenhado em vetor: só aparece lendo a página renderizada
  (pdftoppm + leitor), não nas imagens do PDF. O app desenha ITF e Code 128 (`js/barras.js`, conferido com leitor).

## 6. Print do pedido no site (WhatsApp)

- Tela "Itens do pedido" de natalluz.ingressos.com.br: mesmos itens do caso 1, com data, categoria e hora,
  subtotal, total, "Pago", operadora, parcelas. Lido por OCR; serve para conferir.

## 7. Fazendinha Estação Natureza (São Paulo, Ipiranga) — "Seu ingresso para a Estação Natureza"

- Recebido em 03/Nov/2026 (print do Gmail). Remetente: `ingressos@estacaonatureza.com.br`.
- Corpo em HTML com **um QR Code em imagem** dentro do e-mail (não é anexo). O QR contém **exatamente o "Número do
  ingresso"** (11 dígitos), que também aparece em texto, como link.
- Campos em texto: "Número do ingresso", "Titular do Bilhete" (nome: descartar), "Tipo De Ingresso" ("Combo 4
  Ingressos" = **um QR para 4 pessoas**), "Localização" (nome do lugar), "Instruções" (endereço, como link de mapa),
  telefones de contato.
- **Sem data**: o horário vem "00:00 -03" e não há dia (ingresso aberto; neste caso, remarcado por chuva, vale 1 mês).
  O robô não inventa data: pergunta "Para qual dia?" ou usa a data que a pessoa escrever ao encaminhar
  ("sábado 7/11"). Com a data, o app escolhe a viagem que cobre o dia ou **cria um passeio de um dia** (1.5.24).
- Regra: QR do corpo lido por imagem (zxing) **ou**, mais barato, o número em texto vira o QR (validado: igual).

## Regras que saem daqui

1. Classificar pelo **remetente original** (ingressos.com.br, planne.com.br, companhias aéreas, hotéis, locadoras).
2. Juntar peças do mesmo pedido (e-mail sem data + PDF com data) pelo número do pedido.
3. Um ingresso por pessoa: código, categoria, setor/número; **QR ou código de barras** a partir do código.
4. Descartar dado pessoal do comprador; guardar só o necessário, embaralhado no cofre.
5. Ignorar e-mails sem reserva ("Acesse seus pedidos", marketing).
6. Data dentro de uma viagem → compromisso fixo 🔒 dessa viagem; sem viagem nessa data → cria um passeio de um dia.
7. Sem data (ingresso aberto) → pergunta o dia; aceita a data escrita por quem encaminhou o e-mail.
