# Chaves do serviço (Gemini, Tripadvisor, Foursquare, Google)

As chaves são cadastradas **pelo próprio GuiaXpert**, por quem é dono ou admin da equipe. Valem em qualquer aparelho
(celular, computador), porque ficam no servidor, não no aparelho.

## Jornada no app

1. Entre no GuiaXpert com a sua conta (marceloneco@gmail.com já é admin).
2. ☰ → **Configurações** → cartão **🔐 Chaves do serviço** (só aparece para a equipe).
3. Em cada serviço: **Cadastrar**. A janela mostra:
   1. o passo a passo do site do serviço, com o botão que abre a página certa;
   2. o campo para colar a chave (escondido, com 👁 para conferir e 📋 para colar);
   3. **Salvar cifrada**.
4. Se o seu login tiver mais de 15 minutos, o app pede **"Confirme que é você"** (senha ou código por e-mail).
5. O app salva e **testa sozinho**: "✓ Funcionou" ou o motivo da recusa.
6. Depois, a linha mostra **"Ligada · termina em …4f2a · data"**. Botões: Trocar, Testar, Apagar.
   "Ver quem mexeu e quando" mostra o histórico (sem a chave).

Ordem sugerida: **Gemini** (faz o ✦ IA funcionar para todos), **Foursquare**, **Google** (opcional), **Tripadvisor** (pago por resultado, ver abaixo).

**Tripadvisor mudou (2026):** a Content API virou **Terra API** (terra.tripadvisor.com). No plano Discover, os primeiros
1.000 resultados são grátis uma única vez por conta; depois, cerca de US$ 0,015 por lugar devolvido (cada busca do app
pede até 5). Só o número do lugar pode ser guardado. A chave fica em Terra Dashboard → Overview → "My API Key".

## Quem usa as chaves

Ninguém recebe a chave. A regra decide só quem **gasta** dela:

| Quem | Usa as chaves do serviço? |
|---|---|
| Você e a equipe (dono/admin) | Sim |
| Quem você convidou para uma viagem sua (ex.: Roberta em Gramado) | Sim, em todo o app |
| Outra família que usa o app com conta própria | **Não.** O ✦ IA pede que ela cadastre a própria chave de IA; a busca segue com OpenStreetMap. |

A regra está no banco (`pode_usar_chaves_servico`) e as funções do servidor conferem a cada pedido.
Para abrir para um cliente pagante no futuro, basta acrescentar o plano dele nessa regra.

## Por que é seguro

| Camada | O que acontece |
|---|---|
| Quem pode | Só contas da tabela `equipe` com papel `dono` ou `admin`. O banco confere em cada chamada; esconder o botão não é a proteção. |
| Prova de que é você | Salvar ou apagar exige login de verdade nos últimos 15 minutos (o horário fica dentro do token assinado). Celular desbloqueado na mão de outra pessoa não basta. |
| No caminho | HTTPS até o Supabase. |
| Guardada | **Supabase Vault**: cifrada no disco; a chave de cifra fica fora do banco. |
| Leitura | Só o servidor (`service_role`) lê o valor, pela função `chave_servico`. O app, o navegador e a própria tela de admin nunca recebem a chave de volta: só os 4 últimos caracteres. |
| No aparelho | Nada fica salvo. O campo é apagado ao salvar ou fechar. |
| Rastro | Cada mudança vai para `acesso_log` (quem, quando, qual serviço, 4 últimos caracteres). Nunca o valor. |
| Nomes | Só 4 nomes aceitos (`GEMINI_API_KEY`, `TRIPADVISOR_KEY`, `FOURSQUARE_KEY`, `GOOGLE_PLACES_KEY`). |

Se uma chave vazar (colou em lugar errado, por exemplo): apague no site do serviço, crie outra e use **Trocar**.

## Para o RootifyONE

A mesma jornada pode ir para o RootifyONE chamando as mesmas funções do banco, logado com uma conta da equipe:
`sou_admin_equipe()`, `admin_status_chaves()`, `admin_salvar_chave(p_nome, p_valor)`, `admin_apagar_chave(p_nome)`,
`admin_historico_chaves()`. Erro `login-recente` (42501) = pedir a senha ou o código por e-mail e tentar de novo.
SQL: `supabase/2026-11-01-chaves-do-servico.sql` (aplicado em 01/Nov/2026).

## Alternativa antiga (ainda funciona)

As funções também aceitam a chave nos Secrets do Supabase (Edge Functions → Secrets), com o mesmo nome.
O cofre do app tem preferência. Para a função `ia`, os nomes `GEMINI_API_KEY` e `GEMINI_KEY` valem.

## Ajustes opcionais (Secrets do Supabase)

| Nome | Padrão | Para que serve |
|---|---|---|
| `IA_LIMITE_DIA` | 60 | Perguntas ao ✦ por pessoa por dia, usando a chave da SolverONE |
| `IA_LIMITE_MES` | 900 | O mesmo, por mês |
| `GEMINI_MODELO` | gemini-flash-latest | Trocar o modelo do Gemini |
