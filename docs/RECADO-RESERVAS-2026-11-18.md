# Recado do dono — Reservas (18/Nov/2026, véspera da viagem)

Pedido: **não desenvolver agora**. Análise e teste intenso marcados para **quinta 19/Nov, 17h (Brasília)**, quando os créditos reiniciam.

Insumos no Drive: https://drive.google.com/drive/folders/14hhTlMXtLo9qWZiyoHMdrtT94S_KFRaO?usp=drive_link
- print da tela de Reservas que não funciona;
- 4 prints do check-in online (cartões de embarque com QR) que a Roberta tirou no celular;
- 4 fotos que o dono tirou da tela do computador mostrando esses prints (simulam o escaneamento pela câmera do celular, não arquivo direto).

## O que está errado
1. **Escanear com a câmera não funciona** (celular e computador): quando reconhece um QR, a câmera fecha, mas não carrega os dados e não salva o QR na reserva. Não dá para saber se leu ou não.
2. **"E-mail"**: não está claro como funciona. O dono tem o e-mail do check-in; pode colar o texto, mas os QR vêm em anexo. Não testou.
3. **"Nova"** (nova reserva, ex.: tipo voo): não tem onde colocar imagem nem arquivo. Não supre a necessidade.

## O que ele quer
- **Escanear de verdade**: foto da câmera de uma tela de computador ou de um papel → reconhecer o QR.
- **Enviar arquivo**: PNG, JPEG ou PDF guardado no computador ou no celular.
- **Colar imagem** da área de transferência (copiar e colar).
- Em todos os casos: **ler o conteúdo do QR e redesenhar um QR limpo** (não guardar a foto torta), salvo na reserva certa, pronto para embarcar.
- Aproveitar do texto do e-mail colado o que der (voo, data, localizador).

## Prioridade
"Reserva é fundamental nesse aplicativo; se não funcionar, ele não tem apelo para outras coisas." Microfone, Tripadvisor e Foursquare ficam depois (não testados de verdade pelo dono).

## Para a quinta
Baixar os 8 arquivos do Drive, testar escanear (as 4 fotos), enviar arquivo e colar (os 4 prints) no app, nos dois aparelhos (celular e computador), achar a causa do "fecha a câmera e não salva" e corrigir tudo acima, com teste intenso antes de publicar.

## Complemento do dono (18/Nov): a jornada da reserva, por etapas — pilar do app
As reservas da viagem **já existiam**; o que falta é **atualizar a reserva existente** quando chega o artefato final (QR, código de barras, o que for), mais perto da data. Não adianta escanear se o app não sabe **onde** pôr.

Reconstruir a jornada (e desenhar isso antes de codar, com os passos do cadastro):
1. **Planejar:** a viagem nasce sem passagem — só a data de ida (sem horário) e as preferências.
2. **Comprar:** chega o e-ticket com o **localizador** (e horário, voo, assentos) → completa a reserva que já existe.
3. **Check-in / embarque:** perto da data chegam os **QR/códigos de barras** (um por pessoa) → **penduram na reserva existente** (no voo daquele localizador), não criam outra.

Inteligência esperada ao escanear, enviar arquivo ou colar:
- ler o QR/código, **reconhecer a qual reserva pertence** (pelo localizador, voo, data, nome) e oferecer "Juntar ao voo LA1234 de 20/Nov (localizador ABC123)";
- se houver mais de uma possível, perguntar qual; se não houver nenhuma, oferecer criar;
- um QR por pessoa, mostrado limpo (redesenhado), pronto para o embarque, também sem internet.

## Complemento 2 (18/Nov): todas as formas de carregar o QR, fluidas, no celular e no computador
- **Câmera** do celular (e do computador), lendo foto de tela ou de papel.
- **Enviar arquivo:** PDF, PNG, JPG, TXT e outros formatos comuns.
- **Colar da área de transferência:** ex. "Copiar" uma foto no WhatsApp e colar dentro do GuiaXpert; **mostrar a imagem colada** antes de ler.
- Testar cada forma nas versões de **celular e de computador**.

## Complemento 3 (18/Nov): o que é a entrada "E-mail" — esclarecer e explorar
- Hoje não está claro se é só **colar o corpo do e-mail**. Precisa de explicação na tela.
- **Colar o texto, sem IA:** reconhecer por regras os elementos (localizador, número do voo, datas e horários, aeroportos, nomes, códigos de bilhete/e-ticket) e propor completar a reserva certa.
- **Encaminhar o e-mail** para um endereço da SolverONE (ex.: roteiro@solverone.com.br), que lê o e-mail e os anexos e pendura na viagem — já está no ROADMAP como E1 (crítico); entra junto nesta análise.
- **PDF com senha:** improvável em viagem, mas prever o aviso ("este PDF pede senha") em vez de falhar calado.
- **O robô do e-mail abre os anexos e os links** (confirmado com o dono em 18/Nov), desde que não peçam senha:
  - anexos: PDF, imagens (PNG/JPG), .pkpass (Apple Wallet), .ics (convite de calendário), TXT/HTML — procura QR, código de barras e dados da reserva;
  - links no corpo: só de sites conhecidos (companhias aéreas, hotéis, locadoras, ingressos), só para ler, sem clicar em "confirmar/cancelar"; se o link pedir login, avisa e pede o print ou o PDF;
  - arquivo ou link com senha: avisa "pede senha" em vez de falhar calado.
