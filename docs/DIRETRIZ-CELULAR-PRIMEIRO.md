# Diretriz permanente: celular primeiro

Vale para todos os apps de solverone.com.br. Decidida pelo dono em 31/Out/2026.

99% das pessoas usam estes apps pelo celular: montam o roteiro, consultam, veem o mapa, traçam a rota, conferem
informação, olham o número da reserva. O desktop tem que ficar bonito, mas é o celular que manda.

## O que isso exige

1. **Desenhar primeiro na tela de 390 px**, com o polegar: ações principais na metade de baixo, botões de pelo menos
   44 px, uma pergunta por tela, letra de 17 px no corpo, campos que não fazem o navegador dar zoom.
2. **Testar sempre no celular de verdade** (Chrome e Samsung Internet no Android, Safari no iPhone) e no simulador
   de 390 × 844 antes de publicar. O desktop é conferido depois, em 1280 px.
3. **Peso e rede:** cada tela carrega o mínimo; imagens em WebP com dois tamanhos (640 e 1280) e `srcset`; nada
   pesado antes de a pessoa pedir; funciona sem internet no que importa (roteiro, mapa guardado, reservas).
4. **Sem distração onde a pessoa está usando:** foto, movimento e enfeite só nas telas de entrada (home, lista de
   viagens, entrar). Roteiro, mapa, reservas e formulários ficam limpos.
5. **Gestos do celular respeitados:** botão Voltar do Android volta um passo e nunca fecha o app; arrastar o mapa não
   rola a página; toque duplo não dá zoom; teclado não esconde o botão de salvar.
6. **Instalável:** oferece "adicionar à tela inicial" uma vez, com "não mostrar mais"; ícone, nome curto, tela cheia.
7. **Texto curto e humano**, como se fosse dito em voz alta para alguém que não é do computador.

## Como conferir

Cada versão publicada passa por: simulador 390 × 844 (prints das telas principais), simulador 1280 × 800, e um
teste real no celular do dono. Regressões de rolagem, zoom e botão Voltar são bugs de prioridade máxima.
