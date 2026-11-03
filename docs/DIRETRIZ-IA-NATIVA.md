# Diretriz: IA nativa em todos os apps SolverONE

Vale para todos os apps de solverone.com.br e para o RootifyONE. Decidida pelo dono em 31/Out/2026.

## A regra

**Todo app nasce 100% compatível com inteligência artificial.** Qualquer coisa que a pessoa queira fazer no app pode
ser pedida em linguagem natural, por voz ou por texto, e o app resolve com IA. Em breve toda busca será IA; app sem IA
fica de fora.

## O que isso exige de cada app

1. **Um símbolo de IA sempre à mão.** Um botão com o símbolo ✦ (ou o AssistONE) visível em toda tela, no mesmo lugar.
   Toque abre uma caixa com microfone e campo de texto. Nunca escondido em menu.
2. **Falar ou digitar.** O microfone usa o reconhecimento de voz do próprio celular (Web Speech API; se não houver,
   o teclado do Android já tem microfone). Quem não quer falar digita. Resposta em texto curto; voz opcional.
3. **Contexto embutido, sem a pessoa explicar nada.** Antes de mandar o pedido para a IA, o app junta sozinho:
   onde a pessoa está (GPS, se permitido), em que tela está, o que está vendo, qual é o app e para que serve, data e
   hora, idioma, e os dados relevantes daquele app (no GuiaXpert: viagem, dia do roteiro, lugares conhecidos, previsão,
   quem viaja sem nomes). A pessoa diz "acha um lugar para almoçar" e a IA já sabe cidade, dia e com quem.
4. **A IA age, não só responde.** O pedido vira uma ação do app quando dá: achar e salvar um lugar, pôr no roteiro,
   abrir no mapa, replanejar o dia, ler um e-mail de reserva, preencher um cadastro. A IA devolve uma intenção
   estruturada (JSON) e o app executa; o que muda dado pede confirmação de um toque.
5. **Ninguém precisa criar chave.** A IA funciona de fábrica com a chave da SolverONE no servidor (função `ia` no
   Supabase), com cota por pessoa. Quem tiver chave própria no cofre usa a sua e não gasta a cota. A palavra "API"
   nunca aparece para quem usa.
6. **Privacidade como já é regra:** nome de pessoa nunca vai para a IA (só faixa, idade e cuidados); chave nunca no
   código; o que a IA sugere vem marcado para conferir; nada de inventar preço, horário ou endereço.
7. **Offline com dignidade.** Sem internet, o botão explica em uma frase e oferece o caminho manual (marcar no mapa,
   digitar). O pedido pode ficar guardado para rodar quando o sinal voltar.
8. **Uma coisa só para a pessoa, vários chaveamentos por trás.** Catálogo aberto, OpenStreetMap, Foursquare, Google,
   IA com busca na web: a pessoa vê uma lupa e um ✦. A ordem e a escolha de fonte são do app, não dela.

## Como fica no código (módulo comum `diretrizes.js`)

- `DGO.ia.perguntar(texto, { contexto, historico, limite, web })` continua sendo a porta única.
- Sem chave própria, o módulo usa o proxy do app (`cfg.ia.proxy[provedor]`), mandando o token da conta no cabeçalho
  (`cfg.ia.proxyCabecalhos`). O servidor guarda a chave e controla a cota (`ia_uso`, RPC `ia_consumir`).
- Cada app define `contextoIA()` que devolve o texto de contexto da tela atual, e `intencoesIA` com as ações que a
  IA pode disparar e como executá-las.
- Voz: `DGO.voz.ouvir()` (Web Speech API) com fallback para o teclado.

## Prova de uso

GuiaXpert 1.2.x: botão ✦ em toda tela; "acha o bar do zé perto daqui" → a IA procura na internet com GPS e cidade
da viagem, mostra opções, a pessoa confirma e o lugar entra na viagem. Sem chave de ninguém.

## Independência da IA (decidido pelo dono em 03/Nov/2026)

A IA está em todo lugar como ajuda, mas **nenhuma automação essencial depende dela**. Primeiro regras (datas, códigos,
empresas conhecidas, mapa aberto, listas); a IA entra só quando as regras não dão conta, e sempre com conferência da
pessoa ("Detectei isto: confere?"). Motivo: o custo das IAs pode subir e modelos baratos podem ser piores; o app tem
que continuar útil sem elas.
