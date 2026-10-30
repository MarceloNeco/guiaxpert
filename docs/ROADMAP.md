# GuiaXpert — roadmap

Os quatro jeitos de montar o guia, combinados com o dono em 30/Out/2026:

| Jeito | Como | Situação |
|---|---|---|
| 1. Pacote pronto | SolverONE monta a cidade; RootifyONE publica; família baixa e usa offline | ✅ 0.1.0 (Gramado e Canela) |
| 2. Busca aberta, sem IA | OpenStreetMap (Overpass) perto do destino | ✅ 0.1.0 · Wikivoyage: v0.2 · blogs: só com servidor |
| 3. Com a IA da pessoa | chave no cofre comum (`DGO.ia`), roteiro sob medida | ✅ 0.1.0 (gera opção nova; conferir) |
| 4. Agente de IA completo | reorganiza o dia se chover, lê reservas, avisa lotação | 🔜 exige servidor (Edge Function) |

## v0.2 (próxima)

1. **Mapa sem internet de verdade.** Hoje os pontos e o GPS funcionam offline, mas o fundo do mapa não. Plano:
   arquivo de mapa por cidade em **PMTiles** (recorte do OpenStreetMap, 10–30 MB, licença ODbL), hospedado junto
   do pacote e guardado no aparelho só no Wi-Fi (`DGO.rede.pedirPesado`), desenhado com protomaps-leaflet.
   Baixar tiles do OSM em massa é proibido pela política deles: por isso arquivo próprio.
2. **Tela de códigos no RootifyONE** (criar, listar com uso, desativar) usando `admin_criar_codigo`,
   `admin_listar_codigos`, `admin_desativar_codigo`.
3. **Nuvem**: tabelas `guiaxpert_*` com RLS, fila subindo, mesma viagem no celular da esposa e da sogra.
4. **Compartilhar viagem** com a família (convite), cada um vê o roteiro e marca favoritos.
5. **Importar reserva** de PDF/print/e-mail lido no aparelho (OCR do módulo comum), sem mandar para servidor.
6. **Notificação** do próximo item e do clima da véspera (`DGO.notificacoes`).
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
