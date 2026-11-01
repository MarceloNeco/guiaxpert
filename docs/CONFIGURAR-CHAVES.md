# Configurar as chaves do GuiaXpert

Todas as chaves ficam **num lugar só**: os segredos das Edge Functions do Supabase. Nenhuma vai no código nem no
celular de ninguém. O app já está pronto para cada uma: assim que o segredo é salvo, a função passa a usar, sem
publicar nada de novo.

## Onde cadastrar

Supabase → projeto **solverone-app** → **Edge Functions** → aba **Secrets** → **Add new secret**.
Endereço direto: https://supabase.com/dashboard/project/qvdvkqydhnadhewcidia/functions/secrets

Em cada uma: **Name** = o nome exato da tabela abaixo; **Value** = a chave colada; **Save**.

## As quatro chaves, na ordem que eu faria

| Ordem | Nome do segredo | O que liga | Onde criar | Custo |
|---|---|---|---|---|
| 1 | `GEMINI_KEY` | O botão ✦ IA funciona para quem não tem chave (sogra, idosos) | https://aistudio.google.com/apikey | Cota grátis diária; o AI Studio mostra o limite |
| 2 | `FOURSQUARE_KEY` | Bares e restaurantes na lupa | https://foursquare.com/developers | 500 buscas/mês grátis |
| 3 | `TRIPADVISOR_KEY` | Restaurantes, hotéis e atrações na lupa | https://www.tripadvisor.com/developers | 5.000 chamadas/mês grátis, pede cartão |
| 4 | `GOOGLE_PLACES_KEY` | Botão "Procurar no Google" no "Vamos achar juntos?" | https://console.cloud.google.com | 10.000 buscas/mês grátis, pede conta de faturamento |

### 1. Gemini (a mais importante)
1. Entre em https://aistudio.google.com/apikey com a sua conta Google.
2. **Create API key** → escolha ou crie um projeto → copie a chave (começa com `AIza`).
3. Supabase → Secrets → `GEMINI_KEY`.

Observação: no plano grátis, o Google pode usar as perguntas para melhorar os produtos dele. O app nunca manda nome
de ninguém. Se um dia quiser evitar isso, é só ativar o faturamento no projeto (plano pago).

### 2. Foursquare
1. https://foursquare.com/developers → entrar → aceitar os termos.
2. **Create a new project** → dentro do projeto, **Generate Service API Key** → copie.
3. Supabase → Secrets → `FOURSQUARE_KEY`.

### 3. Tripadvisor
1. https://www.tripadvisor.com/developers → criar conta de desenvolvedor da **Content API** (pede cartão, não cobra
   dentro da cota).
2. Criar a chave. Em restrição, **não** limite por IP (a chamada sai do Supabase, cujo IP muda).
3. Supabase → Secrets → `TRIPADVISOR_KEY`.

### 4. Google Places (opcional)
1. https://console.cloud.google.com → criar projeto "GuiaXpert" → associar uma conta de faturamento.
2. **APIs e serviços → Biblioteca** → ativar **Places API (New)**.
3. **Credenciais → Criar credenciais → Chave de API** → em restrições de API, marque só **Places API (New)**.
4. Supabase → Secrets → `GOOGLE_PLACES_KEY`.

## Ajustes opcionais (também em Secrets)

| Nome | Padrão | Para que serve |
|---|---|---|
| `IA_LIMITE_DIA` | 60 | Perguntas ao ✦ por pessoa por dia, usando a chave da SolverONE |
| `IA_LIMITE_MES` | 900 | O mesmo, por mês |
| `GEMINI_MODELO` | gemini-2.0-flash | Trocar o modelo do Gemini |
| `FONTE_LUGARES` | automático | `api` força Foursquare; `aberta` força a base aberta FSQ OS Places |

## Como conferir que ligou

1. Abra https://solverone.com.br/guiaxpert/ logado, feche e abra de novo (para pegar a versão nova).
2. **Gemini:** toque em ✦ IA e escreva "acha um lugar para almoçar perto daqui". Se responder, ligou. Se aparecer
   "o assistente ainda não está ligado", a chave não foi salva com o nome certo.
3. **Foursquare / Tripadvisor:** no mapa, busque "legítimo" e toque em "Buscar na internet". O
   "Legítimo Bar & Choperia" deve vir em primeiro, com a etiqueta Foursquare ou Tripadvisor.
4. **Google:** busque algo que não existe, toque em "Vamos achar juntos?" → "Procurar no Google". Deve aparecer a
   lista com "powered by Google".
