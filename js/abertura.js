/* abertura.js — roda antes de tudo: escolhe a foto do dia e já pinta a tela de abertura e o fundo.
   A tela de abertura some quando o app está pronto (app.js) ou em 6 s, o que vier antes. */
(function () {
  'use strict';
  var FOTOS = ['cristo', 'iguacu', 'noronha', 'lencois', 'veadeiros', 'eiffel', 'kyoto', 'machu', 'muralha', 'sydney'];
  var dia = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  var id = FOTOS[dia % FOTOS.length];
  window.GX_FOTO_DO_DIA = id;
  var ab = document.getElementById('abertura-foto'); if (ab) ab.src = 'img/fundos/' + id + '-640.webp';
  var f = document.getElementById('fundo-foto'); if (f) f.src = 'img/fundos/' + id + '-fundo.webp';
  setTimeout(function () { var a = document.getElementById('abertura'); if (a) a.classList.add('sai'); }, 6000);
})();
