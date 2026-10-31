# GuiaXpert — roadmap

Os quatro jeitos de montar o guia, combinados com o dono em 30/Out/2026:

| Jeito | Como | Situação |
|---|---|---|
| 1. Pacote pronto | SolverONE monta a cidade; RootifyONE publica; família baixa e usa offline | ✅ 0.1.0 (Gramado e Canela) |
| 2. Busca aberta, sem IA | OpenStreetMap (Overpass) perto do destino | ✅ 0.1.0 · Wikivoyage: v0.2 · blogs: só com servidor |
| 3. Com a IA da pessoa | chave no cofre comum (`DGO.ia`), roteiro sob medida | ✅ 0.1.0 (gera opção nova; conferir) |
| 4. Agente de IA | replaneja o dia se chover, responde sobre a viagem, lê e-mail de reserva | ✅ 1.0.0 (com a chave da pessoa) · avisos de lotação/push: exigem servidor |

## Feito até a 1.0.0 (31/Out/2026)

Explorar vs. Viagem, mapa com lista e pontos do dia, mapa offline (PMTiles) de Gramado, reservas na conta (cifradas) com
QR/código para outro celular, e-mail → reserva, família (membros, convites, cartão para quem fica em casa), IA (tela, replanejar, guia).

## Próximos

0. **Lugares comerciais sem limite de cache**: hoje a função `lugares` usa o Foursquare Places API (chave no servidor,
   500 chamadas/mês grátis, termos do pago-por-uso proíbem guardar os dados). Para uso em escala: (a) contrato Enterprise
   com o Foursquare, ou (b) subir a base aberta **FSQ OS Places** (Apache 2.0, 100 M lugares, pode copiar e guardar)
   no Postgres do Supabase com PostGIS + pg_trgm, recortada por país, e entregar também nos pacotes offline. Preferir (b).
   **Pronto e opcional (31/Out/2026):** tabela `lugares_abertos` + `buscar_lugares_abertos` (vazios), script
   `ferramentas/fsq-os-places/recortar.py` e a função `lugares` já escolhe a base aberta quando não há chave. Falta só
   baixar os parquet e carregar (ver `ferramentas/fsq-os-places/README.md`).
1. **Mapa offline para cidades sem pacote**: Edge Function que recorta o PMTiles sob demanda (`pmtiles extract`). Hoje só cidades com pacote.
2. **Tela de códigos no RootifyONE** (criar, listar com uso, desativar) usando `admin_criar_codigo`,
   `admin_listar_codigos`, `admin_desativar_codigo`.
3. **Push** (próximo item, clima da véspera, 'a família mudou o roteiro'): exige Edge Function + VAPID.
4. **Encaminhar e-mail** para `reservas@` (Edge Function de entrada) e OCR de print/PDF de reserva.
5. **Localização da família ao vivo** (só no app nativo).
7. Barra de baixo configurável (favoritos, diretriz) e AssistONE com ajuda por tela.
8. Mais pacotes (Bonito, Foz, Serra Gaúcha vinícolas…), cada um com data de verificação.

## APK Android (fora da loja) e lojas

- **APK = o mesmo site empacotado** com **TWA** (Trusted Web Activity) pelo Bubblewrap do Google. Mesmo código,
  ícone próprio, tela cheia, notificação. Passos: `npx @bubblewrap/cli init --manifest https://solverone.com.br/guiaxpert/manifest.json`
  → `build` → gera `app-release-signed.apk`. Exige publicar `/.well-known/assetlinks.json` **na raiz do domínio**
  (repositório do Portal). Depois, o mesmo pacote vai para a Play Store sem refazer.
- **iPhone:** fora da loja não existe APK; usa-se o app instalado pelo Safari (funciona offline e com notificação
  no iOS 16.4+). App Store: conta Apple (US$ 99/ano) + empacotar com Capacitor e acrescentar recursos nativos
  (a Apple recusa app que é "só um site").
- **GPS com o app fechado** (acompanhar a família) só no app nativo.

## Decisões pendentes do dono

- Anúncios no GuiaXpert (público premium): hoje desligados.
- Planos: o que o visitante, o degustação e o premium podem usar (`servicos/guiaxpert.json` está com tudo liberado e `aConfirmar`).
- Hoje o uso é pessoal. Clima: Open-Meteo com reserva automática em MET Norway e wttr.in. Se um dia vender assinatura: MET Norway como 1ª opção (permite uso comercial) ou plano comercial da Open-Meteo; tiles do OSM por provedor próprio.
- Registrar a marca GuiaXpert no INPI (classes 9, 35, 39, 41, 42) e o domínio `guiaxpert.com.br`.
