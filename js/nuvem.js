/* =====================================================================
   nuvem.js — viagens, roteiros e pessoas na conta (Supabase)

   - Tabela única guiaxpert_dados (user_id, loja, id, dados, atualizado_em,
     versao, apagado, recebido_em). O banco só deixa cada um ver o seu (RLS).
   - Sincronizar = BAIXAR o que mudou desde a última vez (recebido_em) e
     depois SUBIR a fila do aparelho. Conflito: vence o mais novo
     (atualizado_em), registro por registro.
   - NÃO SOBE: reservas e "restricoes" de pessoas (comida/alergias). Ficam
     só no aparelho, embaralhadas.
   - Aparelho usado por outra conta: não mistura (guarda o dono em meta).
   ===================================================================== */
(function () {
  'use strict';
  var cfg = window.GUIAXPERT_CONFIG || {};
  var LOJAS = ['pessoas', 'viagens', 'roteiros', 'favoritos', 'lugares'];
  var rodando = null, relogio = null;

  function base() { return String(cfg.SUPABASE_URL || '').replace(/\/+$/, '') + '/rest/v1/guiaxpert_dados'; }
  function cab(t, extra) { return Object.assign({ apikey: cfg.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, extra || {}); }
  function ok(r) { if (!r.ok) { var e = new Error('nuvem-' + r.status); e.status = r.status; throw e; } return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null; }); }

  /* o que vai para a nuvem: sem dado sensível */
  function limpar(loja, obj) {
    var o = Object.assign({}, obj);
    if (loja === 'pessoas') delete o.restricoes;
    Object.keys(o).forEach(function (k) { if (k.charAt(0) === '_') delete o[k]; });
    return o;
  }

  function baixar(t) {
    return Banco.meta('nuvem-cursor', '1970-01-01T00:00:00Z').then(function (cursor) {
      var u = base() + '?select=loja,id,dados,atualizado_em,versao,apagado,recebido_em&recebido_em=gt.' + encodeURIComponent(cursor) + '&order=recebido_em.asc&limit=1000';
      return fetch(u, { headers: cab(t) }).then(ok).then(function (linhas) {
        var mudou = 0, maior = cursor;
        return (linhas || []).reduce(function (p, l) {
          return p.then(function () {
            if (l.recebido_em > maior) maior = l.recebido_em;
            if (LOJAS.indexOf(l.loja) < 0) return;
            return Banco.lerBruto(l.loja, l.id).then(function (local) {
              if (local && local.atualizado_em >= l.atualizado_em) return;
              var novo = Object.assign({}, l.dados, { id: l.id, atualizado_em: l.atualizado_em, versao: l.versao, apagado: l.apagado });
              if (local && l.loja === 'pessoas' && local.restricoes) novo.restricoes = local.restricoes;
              mudou++;
              return Banco.gravarDeFora(l.loja, novo);
            });
          });
        }, Promise.resolve()).then(function () {
          return Banco.definirMeta('nuvem-cursor', maior).then(function () { return mudou; });
        });
      });
    });
  }

  function subir(t) {
    return Banco.filaToda().then(function (filaToda) {
      /* reservas também entram na fila do aparelho, mas nunca sobem: saem da fila junto */
      var todos = (filaToda || []).map(function (f) { return f.seq; });
      var fila = (filaToda || []).filter(function (f) { return LOJAS.indexOf(f.loja) > -1; });
      if (!fila.length) return Banco.limparFila(todos).then(function () { return 0; });
      var unicos = {};
      fila.forEach(function (f) { unicos[f.loja + ':' + f.id] = f; });
      return Promise.all(Object.keys(unicos).map(function (k) { var f = unicos[k]; return Banco.lerBruto(f.loja, f.id).then(function (r) { return r && { loja: f.loja, r: r }; }); }))
        .then(function (regs) {
          var linhas = regs.filter(Boolean).map(function (x) {
            return { loja: x.loja, id: x.r.id, dados: limpar(x.loja, x.r), atualizado_em: x.r.atualizado_em || new Date().toISOString(), versao: x.r.versao || 1, apagado: !!x.r.apagado };
          });
          if (!linhas.length) return Banco.limparFila(todos).then(function () { return 0; });
          return fetch(base() + '?on_conflict=user_id,loja,id', { method: 'POST', headers: cab(t, { Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(linhas) })
            .then(ok).then(function () { return Banco.limparFila(todos); }).then(function () { return linhas.length; });
        });
    });
  }

  var Nuvem = {
    /* devolve { baixados, subidos } ou null se não deu (sem conta, sem internet, outro dono) */
    sincronizar: function () {
      if (rodando) return rodando;
      var s = Conta.sessao();
      if (!s || !navigator.onLine) return Promise.resolve(null);
      rodando = Banco.meta('nuvem-dono', null).then(function (dono) {
        if (dono && dono !== s.email) return null;               /* aparelho com dados de outra conta */
        return Conta.token().then(function (t) {
          if (!t) return null;
          return baixar(t).then(function (b) {
            return subir(t).then(function (u) {
              return (dono ? Promise.resolve() : Banco.definirMeta('nuvem-dono', s.email)).then(function () {
                return Banco.definirMeta('nuvem-ultima', new Date().toISOString());
              }).then(function () { return { baixados: b, subidos: u }; });
            });
          });
        });
      }).catch(function () { return null; }).then(function (r) { rodando = null; return r; });
      return rodando;
    },
    /* depois de mudar algo: sobe em alguns segundos (junta várias mudanças) */
    logo: function () { clearTimeout(relogio); relogio = setTimeout(function () { Nuvem.sincronizar(); }, 4000); },
    ultima: function () { return Banco.meta('nuvem-ultima', null); },
    /* LGPD: apagar o que está na conta */
    apagarTudo: function () {
      return Conta.token().then(function (t) {
        if (!t) return;
        return fetch(base() + '?loja=not.is.null', { method: 'DELETE', headers: cab(t) }).then(ok);
      });
    }
  };

  document.addEventListener('gx:dados', function (e) { if (!(e.detail && e.detail.fora)) Nuvem.logo(); });
  window.addEventListener('online', function () { Nuvem.logo(); });

  window.Nuvem = Nuvem;
})();
