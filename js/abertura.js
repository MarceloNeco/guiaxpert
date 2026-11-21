/* abertura.js — roda antes de tudo: escolhe a foto de fundo do app (uma diferente a cada abertura).
   A tela de abertura é uma colagem fixa (Cristo, Eiffel, Coliseu, Machu Picchu), montada no index.html.
   A tela de abertura some quando o app está pronto (app.js) ou em 6 s, o que vier antes. */
(function () {
  'use strict';
  var FOTOS = ['cristo', 'coliseu', 'oia', 'eiffel', 'taj', 'masp', 'iguacu', 'machu', 'guanabara', 'sydney', 'muralha', 'noronha', 'lencois', 'veadeiros'];   /* só lugares (comida fica no carrossel) */
  /* a cada abertura, o próximo cartão-postal da lista (os 6 mais famosos primeiro) */
  var n = 0; try { n = (+localStorage.getItem('guiaxpert.abertura') || 0) % FOTOS.length; localStorage.setItem('guiaxpert.abertura', String(n + 1)); } catch (e) { n = Math.floor(Math.random() * 6); }
  var id = FOTOS[n];
  window.GX_FOTO_DO_DIA = id;
  var f = document.getElementById('fundo-foto'); if (f) f.src = 'img/fundos/' + id + '-fundo.webp';
  setTimeout(function () { var a = document.getElementById('abertura'); if (a) a.classList.add('sai'); }, 6000);
  /* fotos da abertura entram suaves quando chegam; o app espera elas aparecerem e deixa à vista um instante
     (dono, 21/Nov/2026: "aparece a foto e já desaparece") — GX_ABERTURA_PRONTA diz quando já pode sair */
  var imgs = [].slice.call(document.querySelectorAll('#abertura .ab-f img')), faltam = imgs.length, t0 = Date.now();
  window.GX_ABERTURA_PRONTA = new Promise(function (ok) {
    function uma(img) { img.classList.add('ok'); if (--faltam <= 0) setTimeout(ok, 1400); }
    if (!faltam) ok();
    imgs.forEach(function (img) { if (img.complete && img.naturalWidth) uma(img); else { img.addEventListener('load', function () { uma(img); }); img.addEventListener('error', function () { if (--faltam <= 0) ok(); }); } });
    setTimeout(ok, 2600);   /* nunca segura mais que isso */
  });
})();
