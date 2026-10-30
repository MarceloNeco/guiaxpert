/* =====================================================================
   contexto.js — onde a pessoa está: numa VIAGEM ou em EXPLORAR

   - Viagem: tudo (mapa, lista, roteiro, reservas) é só daquela viagem.
   - Explorar: onde o GPS está (ou uma cidade buscada), sem viagem.
   O chip do cabeçalho mostra o contexto e troca em um toque.
   Guardado em meta 'contexto' = { modo, viagemId }. Evento 'gx:contexto'.
   ===================================================================== */
(function () {
  'use strict';
  var atual = { modo: 'viagem', viagemId: null };

  var Contexto = {
    modo: function () { return atual.modo; },
    viagemId: function () { return atual.viagemId; },
    emViagem: function () { return atual.modo === 'viagem'; },
    automatico: function () { return !!atual.auto; },

    carregar: function () {
      return Banco.meta('contexto', null).then(function (c) {
        if (c && c.modo) { atual = c; return; }
        /* ninguém escolheu ainda: entra na viagem em curso ou na próxima; senão, Explorar (e fica "automático") */
        return Banco.listar('viagens').then(function (vs) {
          vs.sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
          var hoje = new Date().toISOString().slice(0, 10);
          var v = vs.filter(function (x) { return x.fim >= hoje; })[0] || vs[vs.length - 1];
          atual = v ? { modo: 'viagem', viagemId: v.id, auto: true } : { modo: 'explorar', viagemId: null, auto: true };
        });
      }).then(function () { return atual; });
    },
    definir: function (modo, viagemId) {
      atual = { modo: modo, viagemId: modo === 'viagem' ? (viagemId || null) : null };
      return Promise.all([Banco.definirMeta('contexto', atual), modo === 'viagem' && viagemId ? Banco.definirMeta('viagem-atual', viagemId) : Promise.resolve()])
        .then(function () { document.dispatchEvent(new CustomEvent('gx:contexto', { detail: atual })); return atual; });
    },

    /* texto do chip: "🧳 Gramado, nov" ou "🌍 Explorar" */
    rotulo: function (viagem, T, lg) {
      if (atual.modo !== 'viagem' || !viagem) return '🌍 ' + T('explorar');
      var nome = viagem.destinoTexto || viagem.nome || '';
      var mes = viagem.inicio ? ({ pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] }[lg === 'en' ? 'en' : 'pt'][+viagem.inicio.slice(5, 7) - 1]) : '';
      return '🧳 ' + nome.split(/,|\(| e | and /)[0].trim().slice(0, 16) + (mes ? ', ' + mes : '');
    }
  };

  window.Contexto = Contexto;
})();
