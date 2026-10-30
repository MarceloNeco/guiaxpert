/* =====================================================================
   pacotes.js — pacotes de cidade (lugares + opções de roteiro prontas)

   De onde vêm, nesta ordem:
   1) o central, publicado pelo RootifyONE em /solverone-dados/conteudo/guiaxpert/pacotes/
   2) a cópia que vem junto com o app (pacotes/)
   3) a cópia guardada no aparelho (para abrir sem internet)
   O formato está em docs/FORMATO-PACOTE.md.
   ===================================================================== */
(function () {
  'use strict';
  var cfg = window.GUIAXPERT_CONFIG || {};

  function baixar(url) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 6000) : null;
    return fetch(url, { cache: 'no-cache', signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error('http-' + r.status);
      return r.json();
    });
  }
  function valido(p) {
    return p && p.formato === 1 && typeof p.id === 'string' && Array.isArray(p.lugares) && Array.isArray(p.roteiros);
  }
  function deCadaFonte(arquivo, teste) {
    var fontes = [cfg.PACOTES_CENTRAL, cfg.PACOTES_LOCAL].filter(Boolean);
    return fontes.reduce(function (p, base) {
      return p.catch(function () {
        return baixar(base + arquivo).then(function (j) { if (!teste(j)) throw new Error('formato'); return j; });
      });
    }, Promise.reject(new Error('inicio')));
  }

  var Pacotes = {
    indice: function () {
      return deCadaFonte('indice.json', function (j) { return j && Array.isArray(j.pacotes); }).then(function (j) {
        Banco.definirMeta('pacotes-indice', j);
        return j.pacotes;
      }).catch(function () {
        return Banco.meta('pacotes-indice', { pacotes: [] }).then(function (j) { return j.pacotes || []; });
      });
    },

    /* carrega um pacote; guarda cópia no aparelho para usar sem internet */
    carregar: function (id) {
      if (!/^[a-z0-9-]{2,40}$/.test(id || '')) return Promise.reject(new Error('id'));
      return deCadaFonte(id + '.json', valido).then(function (p) {
        p.baixadoEm = new Date().toISOString();
        return Banco.gravar('pacotes', p).then(function () { return p; });
      }).catch(function () {
        return Banco.ler('pacotes', id).then(function (p) {
          if (!p) throw new Error('sem-pacote');
          p.offline = true;
          return p;
        });
      });
    },

    nome: function (p, idioma) { return p && p.nome ? (p.nome[idioma] || p.nome.pt) : ''; }
  };

  window.Pacotes = Pacotes;
})();
