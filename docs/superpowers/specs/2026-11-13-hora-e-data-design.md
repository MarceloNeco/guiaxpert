# Hora e data — desenho (aprovado pelo dono em 13/Nov/2026)

Protótipos: https://claude.ai/artifact/NtkHCbcZBF6Vu6zEpTiwL2 ("Hora e data", versão 2).

## Por quê
Digitar "930" no celular é lento e sujeito a erro; voltar mês a mês até 1979 num calendário é a pior experiência de data.
O dono pediu um híbrido de "arrastar para cima e para baixo" (roda) e relógio, com atalhos rápidos e o horário mais provável,
ícones elegantes (nada de emoji) e as melhores práticas no celular e no computador.

## Abordagens consideradas
1. Roda (iPhone, Uber) — rápida com o dedão; ruim para ver o dia.
2. Relógio (Android/Material) — dois toques; anel de dentro pequeno.
3. Arrastar na linha do dia (Calendário iPhone, Google Agenda) — ótimo para ver conflitos; mais trabalho; fica como opção futura.
4. Híbrido (escolhido): atalhos + roda + relógio; no computador, digitar + lista de 15 em 15 min (padrão do Google Agenda na web).

## O que foi feito (1.5.58)
- `campoHora(id, valor, opc)` continua devolvendo o `<input>` (o resto do app não muda). `Seletor.hora` liga:
  - celular (ponteiro grosso): sem teclado; tocar abre a folha com atalhos (mais provável = fim do anterior + carro),
    duração em botões no "Até" (com a duração típica do guia), roda e relógio; a preferência fica guardada.
  - computador: digitar continua; ao focar, lista de 15 em 15 min com atalhos e, no "Até", a duração ao lado; setas ±15 min.
- `campoData`: o ícone de calendário abre o calendário do app (título "mês ano" leva aos anos → meses → dias; teclado:
  setas e Page Up/Down). `caixa.opcCalendario` aceita `vista: 'anos'` (nascimento), `min`, `anoMin/anoMax`.
- Nova viagem: botão "Escolher ida e volta no calendário" (meses rolando na vertical, noites, fins de semana em negrito,
  dias passados bloqueados); os campos continuam aceitando digitar.

## Ficou para o construtor
- A linha do dia de arrastar (protótipo 3 da versão 1) como terceira forma, quando o dono pedir.
- Data de nascimento: não há campo de nascimento no app hoje; quando houver, usar `opcCalendario = { vista: 'anos' }`.
