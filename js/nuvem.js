/* =====================================================================
   nuvem.js — viagens, roteiros e pessoas na conta (Supabase)

   - Tabela única guiaxpert_dados (user_id, loja, id, dados, atualizado_em,
     versao, apagado, recebido_em). O banco só deixa cada um ver o seu (RLS).
   - Sincronizar = BAIXAR o que mudou desde a última vez (recebido_em) e
     depois SUBIR a fila do aparelho. Conflito: vence o mais novo
     (atualizado_em), registro por registro.
   - Reservas sobem SEMPRE cifradas (o servidor não tem a chave). Da chave,
     sobe só o embrulho pelo código de recuperação (100 bits), nunca o do
     PIN. "restricoes" de pessoas (comida/alergias) não sobem.
   - Aparelho usado por outra conta: não mistura (guarda o dono em meta).
   ===================================================================== */
(function () {
  'use strict';
  var cfg = window.GUIAXPERT_CONFIG || {};
  var LOJAS = ['pessoas', 'viagens', 'roteiros', 'favoritos', 'lugares', 'reservas', 'cofre'];
  var rodando = null, relogio = null;

  function base() { return String(cfg.SUPABASE_URL || '').replace(/\/+$/, '') + '/rest/v1/guiaxpert_dados'; }
  function cab(t, extra) { return Object.assign({ apikey: cfg.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, extra || {}); }
  function uidDo(t) { try { return JSON.parse(atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || ''; } catch (e) { return ''; } }
  function idNuvem(loja, id, uid) { return loja === 'cofre' && uid ? id + ':' + uid : id; }
  function idLocal(loja, id) { return loja === 'cofre' ? String(id).split(':')[0] : id; }
  function ok(r) { if (!r.ok) { var e = new Error('nuvem-' + r.status); e.status = r.status; throw e; } return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null; }); }

  /* o que vai para a nuvem: sem dado sensível */
  function limpar(loja, obj) {
    var o = Object.assign({}, obj);
    if (loja === 'pessoas') delete o.restricoes;
    Object.keys(o).forEach(function (k) { if (k.charAt(0) === '_') delete o[k]; });
    return o;
  }

  /* que viagens alcanço e com que papel (dono | edita | ve) → meta 'papeis' */
  function papeis(t) {
    return fetch(String(cfg.SUPABASE_URL || '').replace(/\/+$/, '') + '/rest/v1/rpc/guiaxpert_viagens_acesso', { method: 'POST', headers: cab(t), body: '{}' })
      .then(ok).then(function (ls) { var m = {}; (ls || []).forEach(function (x) { m[x.viagem_id] = x.papel; }); return Banco.definirMeta('papeis', m).then(function () { document.dispatchEvent(new CustomEvent('gx:papeis', { detail: m })); }); })
      .catch(function () {});
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
            var lid = idLocal(l.loja, l.id);
            return Banco.lerBruto(l.loja, lid).then(function (local) {
              if (local && local.atualizado_em >= l.atualizado_em) return;
              var novo = Object.assign({}, l.dados, { id: lid, atualizado_em: l.atualizado_em, versao: l.versao, apagado: l.apagado });
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
      var todos = (filaToda || []).map(function (f) { return f.seq; });
      var fila = (filaToda || []).filter(function (f) { return LOJAS.indexOf(f.loja) > -1; });
      if (!fila.length) return Banco.limparFila(todos).then(function () { return 0; });
      var unicos = {};
      fila.forEach(function (f) { unicos[f.loja + ':' + f.id] = f; });
      return Promise.all(Object.keys(unicos).map(function (k) { var f = unicos[k]; return Banco.lerBruto(f.loja, f.id).then(function (r) { return r && { loja: f.loja, r: r }; }); }))
        .then(function (regs) {
          var linhas = regs.filter(Boolean).map(function (x) {
            var vid = x.loja === 'viagens' ? x.r.id : (x.r.viagem_id || null);
            if (x.loja === 'pessoas' || x.loja === 'cofre') vid = null;
            return { loja: x.loja, id: idNuvem(x.loja, x.r.id, uidDo(t)), viagem_id: vid, dados: limpar(x.loja, x.r), atualizado_em: x.r.atualizado_em || new Date().toISOString(), versao: x.r.versao || 1, apagado: !!x.r.apagado };
          });
          if (!linhas.length) return Banco.limparFila(todos).then(function () { return 0; });
          var enviar = function (ls) {
            return fetch(base() + '?on_conflict=loja,id', { method: 'POST', headers: cab(t, { Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(ls) }).then(ok);
          };
          return enviar(linhas).catch(function (e) {
            /* alguma linha sem permissão (ex.: membro que só vê): manda uma a uma e deixa as recusadas de lado */
            if (!e || (e.status !== 403 && e.status !== 401 && e.status !== 409 && e.status !== 400)) throw e;
            return linhas.reduce(function (p, l) { return p.then(function () { return enviar([l]).catch(function (e2) { if (e2 && (e2.status === 403 || e2.status === 409 || e2.status === 400)) return null; throw e2; }); }); }, Promise.resolve());
          }).then(function () { return Banco.limparFila(todos); }).then(function () { return linhas.length; });
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
          return papeis(t).then(function () { return baixar(t); }).then(function (b) {
            return Banco.meta('cofre-subiu', 0).then(function (v) {
              if (v >= 2) return b;
              return Banco.ler('cofre', 'recuperacao').then(function (r) {
                return (r && r.recuperacao ? Banco.gravar('cofre', r) : Promise.resolve()).then(function () { return Banco.definirMeta('cofre-subiu', 2); });
              }).then(function () { return b; });
            });
          }).then(function (b) {
            return subir(t).then(function (u) {
              return (dono ? Promise.resolve() : Banco.definirMeta('nuvem-dono', s.email)).then(function () {
                return Banco.definirMeta('nuvem-ultima', new Date().toISOString());
              }).then(function () {
                if (b) document.dispatchEvent(new CustomEvent('gx:nuvem', { detail: { baixados: b } }));
                return { baixados: b, subidos: u };
              });
            });
          });
        });
      }).catch(function () { return null; }).then(function (r) { rodando = null; return r; });
      return rodando;
    },
    /* depois de mudar algo: sobe em alguns segundos (junta várias mudanças) */
    logo: function () { clearTimeout(relogio); relogio = setTimeout(function () { Nuvem.sincronizar(); }, 4000); },
    ultima: function () { return Banco.meta('nuvem-ultima', null); },
    papel: function (viagemId) { return Banco.meta('papeis', {}).then(function (m) { return m[viagemId] || 'dono'; }); },
    /* convites e membros (funções do banco) */
    criarConviteEmail: function (viagemId, papel, email) { return Conta.rpc('guiaxpert_criar_convite_email', { p_viagem: viagemId, p_papel: papel || 've', p_email: email, p_dias: 14 }).then(function (r) { return Array.isArray(r) ? r[0] : r; }); },
    criarConvite: function (viagemId, papel, dias) { return Conta.rpc('guiaxpert_criar_convite', { p_viagem: viagemId, p_papel: papel || 've', p_dias: dias || 7 }); },
    aceitarConvite: function (token, codigo) { return Conta.rpc('guiaxpert_aceitar_convite', { p_token: token, p_codigo: codigo || null }).then(function (r) { return Array.isArray(r) ? r[0] : r; }); },
    membros: function (viagemId) { return Conta.rpc('guiaxpert_listar_membros', { p_viagem: viagemId }); },
    mudarMembro: function (viagemId, userId, papel) { return Conta.rpc('guiaxpert_mudar_membro', { p_viagem: viagemId, p_user: userId, p_papel: papel }); },
    sairViagem: function (viagemId) { return Conta.rpc('guiaxpert_sair_viagem', { p_viagem: viagemId }); },
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
  /* com o app aberto: confere a cada minuto e ao voltar para a tela (a família pode ter mudado o roteiro) */
  setInterval(function () { if (!document.hidden) Nuvem.sincronizar(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) Nuvem.logo(); });

  window.Nuvem = Nuvem;
})();
