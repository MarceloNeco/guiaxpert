# Créditos e licenças de terceiros

| O quê | Origem | Licença | Como entra |
|---|---|---|---|
| Fonte Overpass (letra da tela) | https://github.com/RedHatOfficial/Overpass | SIL Open Font License 1.1 (`vendor/fontes/OFL.txt`) | arquivo no repositório (`vendor/fontes/`), sem Google Fonts |
| Mapa sem internet: `pmtiles` 4.3.0 e `protomaps-leaflet` 5.1.0 | https://github.com/protomaps | BSD-3-Clause | arquivos em `vendor/pmtiles/`, carregados só quando o mapa abre |
| Recorte de mapa `mapas/gramado.pmtiles` | OpenStreetMap via build diário do Protomaps (2026-10-29) | ODbL 1.0 — "© OpenStreetMap contributors" | arquivo no repositório e em `solverone-dados/conteudo/guiaxpert/mapas/` |
| QR: `qrcode-generator` 2.0.4 (Kazuhiko Arase, MIT) e `jsQR` 1.4.0 (Cosmo Wolfe, Apache-2.0) | npm | MIT / Apache-2.0 | `vendor/qr/`, carregados só ao transferir o cofre |
| PDF do roteiro: `jsPDF` 2.5.1 (James Hall, yWorks) e `html2canvas` 1.4.1 (Niklas von Hertzen) | npm | MIT (`vendor/pdf/LICENSE-*.txt`) | `vendor/pdf/`, carregados só quando a pessoa gera um PDF |
| Leaflet 1.9.4 (mapa) | https://leafletjs.com | BSD-2-Clause | arquivo no repositório (`vendor/leaflet/`), carregado só quando o mapa abre |
| Dados de mapa, lugares e endereços (Descobrir, mapa, coordenadas do pacote) | OpenStreetMap | ODbL 1.0 — "© OpenStreetMap contributors" | consultados na hora (Overpass, Nominatim, tiles) e coordenadas guardadas no pacote |
| Previsão do tempo (1ª opção) | Open-Meteo (https://open-meteo.com) | CC BY 4.0 (dados), uso não comercial grátis | consultada na hora; a tela cita a fonte |
| Previsão do tempo (reserva) | MET Norway (https://api.met.no) | CC BY 4.0 / NLOD | só se a 1ª falhar; a tela cita a fonte |
| Previsão do tempo (reserva) | wttr.in (https://wttr.in), dados World Weather Online | uso livre, sem garantia | só se as duas falharem; a tela cita a fonte |
| Pacote Gramado e Canela | pesquisa GuiaXpert (out/2026) em blogs, guias e sites oficiais | texto próprio; fontes citadas em `pacotes/gramado.json` (`fonte`) e no relatório de pesquisa | arquivo no repositório |
| Módulo comum `diretrizes.js`, `sw.js` | SolverONE (Marcelo Neco) | do autor | arquivo no repositório |
| Ícones e pictogramas | criados para o GuiaXpert | do autor | `icone-*.png` e SVG no código |

Atenção para o uso comercial (hoje o uso é pessoal): a Open-Meteo é grátis para uso não comercial; a MET Norway permite uso comercial com crédito; com assinatura paga do GuiaXpert,
ou contrata o plano comercial (US$ 29/mês, set/2026) ou passa a previsão por um servidor com chave. Os tiles do
OpenStreetMap são para uso leve; uso pesado (muitos usuários) exige provedor próprio (MapTiler, Stadia) via servidor.

## Fotos da home (img/fundos/)

Wikimedia Commons, licenças CC BY-SA 4.0, CC BY-SA 3.0, CC BY 3.0 br e CC0; autores e links em `img/fundos/creditos.json`
e no botão 📷 do app. Recortadas em 16:10 e convertidas para WebP (640 e 1280 px). Sem pessoas.
