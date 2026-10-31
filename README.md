# GuiaXpert — seu guia, do seu jeito (v0.1.0)

Roteiros sob medida para a família, que funcionam sem internet. Uma solução SolverONE.
Detalhes técnicos em `ARQUITETURA.md`. Roadmap em `docs/ROADMAP.md`.

## 1. Rodar no computador

Dê dois cliques em **`INICIAR-GUIAXPERT-LOCAL.bat`** (Windows) ou **`INICIAR-GUIAXPERT-LOCAL.command`** (Mac).
Abre em http://localhost:5500. Para desligar, feche a janela preta.
Não abra o `index.html` com dois cliques: como arquivo solto, o login não funciona.

Para testar sem login (só no seu computador): em `config.js` troque `ACESSO: 'obrigatorio'` por `ACESSO: 'aberto'`.
**Volte para `'obrigatorio'` antes de publicar.**

## 2. Ligar o acesso por convite (uma vez)

> **Já feito em 30/Out/2026** no projeto solverone-app. Os passos abaixo ficam para referência (rodar de novo não estraga nada).

1. Entre no Supabase → projeto **solverone-app** → **SQL Editor** → **New query**.
2. Abra `supabase/2026-10-30-acesso-por-app-e-codigos.sql`, copie tudo, cole e clique em **Run**.
3. Deve aparecer "Success. No rows returned".

Pronto. A partir daí entra no GuiaXpert:
- **quem você liberou** no RootifyONE (Usuários → Supabase → liberar e-mail / pré-liberação), ou
- **quem usar um código de degustação** válido.

### Criar um código de degustação

Até a tela do RootifyONE ficar pronta (ver `docs/ROADMAP.md`). O SQL Editor não serve para isso (lá ninguém está
"logado", e só dono/admin da equipe pode criar código). Use uma das duas formas:

- **Pelo próprio GuiaXpert, logado com a sua conta de dono:** aperte F12 → aba Console → cole
  `Conta.rpc('admin_criar_codigo', {p_app:'guiaxpert', p_dias:7, p_usos_max:5, p_nota:'Família X'}).then(console.log)`.
  O código aparece **uma vez** (ex.: `GU-K7QM-3XPA`). Repasse para a pessoa.
- **Código de teste fixo** (só para o primeiro teste): rode o `insert` comentado no fim do SQL. O código é `GX-TESTE-1234`.
  Desative depois de testar.

A pessoa abre o GuiaXpert, cria a conta (ou entra), digita o código e fica liberada pelos dias do código.

### Código de 6 números no e-mail (opcional)

O "Receber código por e-mail" já funciona com o link do e-mail. Para o e-mail trazer também o código de 6 números:
Supabase → Authentication → Emails → **Magic link** → acrescente no texto: `Seu código: {{ .Token }}`. Vale para todos os apps.

## 2b. Busca de restaurantes e bares (Foursquare, opcional)

O OpenStreetMap não tem todo comércio. A função `supabase/functions/lugares` consulta o Foursquare Places com uma chave
que fica **só no servidor**. Para ligar: crie a chave em https://foursquare.com/developers (projeto → Service API Key),
depois Supabase → projeto solverone-app → Edge Functions → Secrets → `FOURSQUARE_KEY` = a chave. Sem a chave a busca
segue só com OpenStreetMap. A função pede só campos "Pro" (nome, endereço, telefone, site); horário, nota e foto são
cobrados à parte pelo Foursquare. Uso: 500 chamadas/mês grátis (junho/2026) e sem guardar dados em cache pelos termos
do plano pago-por-uso; ver `docs/ROADMAP.md` para o caminho com a base aberta FSQ OS Places.

## 2c. "Procurar no Google" (opcional)

Quando a busca não acha, o cartão "Vamos achar juntos?" oferece a lista do Google (Places Autocomplete) pela função
`supabase/functions/google-lugares`. Para ligar: Google Cloud → APIs e serviços → ativar **Places API (New)** → criar
chave restrita a essa API → Supabase → Edge Functions → Secrets → `GOOGLE_PLACES_KEY`. Grátis até 10 mil buscas/mês.
Regra do Google que o app respeita: a lista aparece só ao vivo e sem mapa, com "powered by Google"; no roteiro fica o
nome que a pessoa confirma, o ponto achado pelo endereço na base aberta e o ID do Google (único dado dele que pode ficar).

## 3. Publicar

1. Crie o repositório **guiaxpert** (público, como os outros apps) e suba estes arquivos.
2. Settings → Pages → Branch `main` / pasta raiz → Save. O endereço será `solverone.com.br/guiaxpert/`.
3. No Supabase → Authentication → URL Configuration → Redirect URLs, confira que `https://solverone.com.br/**` está lá
   (é o que faz o "esqueci a senha" e o Google voltarem para o app).
4. A cada versão nova: suba o número no `versoes.json` **e** a `VERSAO` no `sw.js`.

## 4. Instalar no celular

- **Android (Chrome):** abra o endereço → menu ⋮ → **Instalar app**. (No navegador da Samsung, instale pelo Chrome.)
- **iPhone (Safari):** abra o endereço → Compartilhar → **Adicionar à Tela de Início**.
- **APK Android** (fora da loja, como a Betano fazia antes da aprovação): ver `docs/ROADMAP.md` → "APK".

## Privacidade

Viagens, pessoas e roteiros ficam **só no aparelho**. Reservas e comida/alergias ficam **embaralhadas** com o PIN.
Para a IA vão só idades e cuidados, nunca nomes. "Conta → Baixar meus dados" e "Apagar tudo" sempre funcionam.
