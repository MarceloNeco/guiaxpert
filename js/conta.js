/* =====================================================================
   conta.js — conta SolverONE (Supabase) e quem pode usar o GuiaXpert

   - Login por REST, sem biblioteca (padrão SolverONE). A sessão fica na
     chave COMUM solverone.sessao.v1: entrou num app, vale em todos.
   - Antes de renovar o token, relê a chave (outra aba/app pode ter renovado).
   - Quem pode usar (decidido no RootifyONE, conferido pelo BANCO):
       a) conta liberada na plataforma (lista de liberados / plano ativo);
       b) código de degustação válido, resgatado por esta conta.
     O app pergunta ao banco pela função acesso_app('guiaxpert').
   - Sem internet: vale a última resposta por GUIAXPERT_CONFIG.DIAS_SEM_INTERNET
     dias (e nunca depois da validade do acesso).
   - Link de volta com #access_token só é aceito se ESTE aparelho pediu
     (marcador guiaxpert.contaPedido), senão pergunta "Foi você?".
   ===================================================================== */
(function () {
  'use strict';
  var cfg = window.GUIAXPERT_CONFIG || {};
  var CHAVE = 'solverone.sessao.v1', ACESSO = 'dgo:guiaxpert:acesso', PEDIDO = 'guiaxpert.contaPedido';
  var VOLTA = 'guiaxpert.volta'; /* sessão trancada pela digital/rosto (só existe com biometria ligada) */
  var APP = 'guiaxpert';
  var renovando = null;

  function ler(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function gravar(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function base() { return String(cfg.SUPABASE_URL || '').replace(/\/+$/, ''); }
  function cab(token) {
    var h = { 'apikey': cfg.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }
  function voltaPara() { return location.origin + location.pathname; }
  function json(r) {
    return r.text().then(function (t) {
      var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
      if (!r.ok) {
        var e2 = new Error((j && (j.error_description || j.msg || j.message || j.error)) || ('http-' + r.status));
        e2.status = r.status; e2.codigo = j && (j.code || j.error_code); throw e2;
      }
      return j;
    });
  }
  function guardarSessao(j, email) {
    var s = { access_token: j.access_token, refresh_token: j.refresh_token,
      expira: Date.now() + ((j.expires_in || 3600) - 60) * 1000,
      email: email || (j.user && j.user.email) || '', nome: (j.user && j.user.user_metadata && j.user.user_metadata.name) || '',
      desde: new Date().toISOString() };
    gravar(CHAVE, s);
    return s;
  }

  var Conta = {
    sessao: function () { return ler(CHAVE); },
    temServidor: function () { return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base()) && /^sb_publishable_/.test(cfg.SUPABASE_PUBLISHABLE_KEY || ''); },

    entrar: function (email, senha) {
      return fetch(base() + '/auth/v1/token?grant_type=password', { method: 'POST', headers: cab(), body: JSON.stringify({ email: email, password: senha }) })
        .then(json).then(function (j) { return guardarSessao(j, email); });
    },
    criarConta: function (email, senha) {
      gravar(PEDIDO, { em: Date.now() });
      return fetch(base() + '/auth/v1/signup?redirect_to=' + encodeURIComponent(voltaPara()), { method: 'POST', headers: cab(), body: JSON.stringify({ email: email, password: senha }) })
        .then(json).then(function (j) { if (j && j.access_token) guardarSessao(j, email); return j; });
    },
    esqueci: function (email) {
      gravar(PEDIDO, { em: Date.now() });
      return fetch(base() + '/auth/v1/recover?redirect_to=' + encodeURIComponent(voltaPara()), { method: 'POST', headers: cab(), body: JSON.stringify({ email: email }) }).then(json);
    },
    google: function () {
      gravar(PEDIDO, { em: Date.now() });
      location.href = base() + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(voltaPara());
    },

    /* volta do Google / confirmação: o token chega no endereço depois do # */
    lerVolta: function (hashInicial) {
      /* o endereço pode já ter sido trocado pela navegação do app: use o que chegou no carregamento */
      var h = hashInicial || location.hash || '';
      if (h.indexOf('access_token=') < 0) return Promise.resolve(null);
      var p = {}; h.replace(/^#/, '').split('&').forEach(function (x) { var kv = x.split('='); p[kv[0]] = decodeURIComponent(kv[1] || ''); });
      history.replaceState(null, '', location.pathname);
      var pedido = ler(PEDIDO), recente = pedido && Date.now() - pedido.em < 2 * 24 * 3600 * 1000;
      gravar(PEDIDO, null);
      return fetch(base() + '/auth/v1/user', { headers: cab(p.access_token) }).then(json).then(function (u) {
        return { tokens: p, email: u.email, recente: recente, confirmar: function () {
          return guardarSessao({ access_token: p.access_token, refresh_token: p.refresh_token, expires_in: +p.expires_in || 3600, user: u }, u.email);
        } };
      });
    },

    /* token válido (renova uma vez só por vez) */
    token: function () {
      var s = ler(CHAVE);
      if (!s) return Promise.resolve(null);
      if (Date.now() < s.expira) return Promise.resolve(s.access_token);
      if (renovando) return renovando;
      renovando = fetch(base() + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: cab(), body: JSON.stringify({ refresh_token: s.refresh_token }) })
        .then(json).then(function (j) {
          var atual = ler(CHAVE);
          /* outra aba já renovou enquanto isso: fica com a dela */
          if (atual && atual.refresh_token !== s.refresh_token && Date.now() < atual.expira) return atual.access_token;
          return guardarSessao(j, s.email).access_token;
        }).catch(function (e) {
          if (e.status === 400 || e.status === 401) gravar(CHAVE, null);
          throw e;
        }).then(function (t) { renovando = null; return t; }, function (e) { renovando = null; throw e; });
      return renovando;
    },

    /* código de 6 números por e-mail (sem senha). Só para quem já tem conta. */
    enviarCodigo: function (email) {
      gravar(PEDIDO, { em: Date.now() });
      return fetch(base() + '/auth/v1/otp?redirect_to=' + encodeURIComponent(voltaPara()), { method: 'POST', headers: cab(),
        body: JSON.stringify({ email: email, create_user: false }) }).then(json);
    },
    confirmarCodigo: function (email, codigo) {
      return fetch(base() + '/auth/v1/verify', { method: 'POST', headers: cab(),
        body: JSON.stringify({ type: 'email', email: email, token: String(codigo || '').replace(/\D/g, '') }) })
        .then(json).then(function (j) { gravar(PEDIDO, null); return guardarSessao(j, email); });
    },

    /* digital/rosto: ao sair, a sessão fica trancada neste aparelho em vez de encerrada */
    esquecerVolta: function () { gravar(VOLTA, null); },
    temVolta: function () { var v = ler(VOLTA); return v ? { email: v.email } : null; },
    sairTrancando: function (chaveSessao) {
      var s = ler(CHAVE);
      if (!s) return Promise.resolve();
      return Bio.cifrar(chaveSessao, s).then(function (blob) {
        gravar(VOLTA, { email: s.email, blob: blob, em: Date.now() });
        gravar(CHAVE, null); gravar(ACESSO, null);
      });
    },
    voltar: function (chaveSessao) {
      var v = ler(VOLTA);
      if (!v) return Promise.reject(new Error('sem-volta'));
      return Bio.decifrar(chaveSessao, v.blob).then(function (s) {
        s.expira = 0; gravar(CHAVE, s);             /* força renovar: confere no servidor */
        return Conta.token();
      }).then(function (t) {
        if (!t) throw new Error('volta-expirou');
        gravar(VOLTA, null); return ler(CHAVE);
      }).catch(function (e) {
        if (e && (e.status === 400 || e.status === 401 || e.message === 'volta-expirou')) { gravar(VOLTA, null); gravar(CHAVE, null); throw new Error('volta-expirou'); }
        throw e;
      });
    },

    sair: function () {
      var s = ler(CHAVE);
      gravar(CHAVE, null); gravar(ACESSO, null); gravar(VOLTA, null);
      if (s && navigator.onLine) fetch(base() + '/auth/v1/logout?scope=local', { method: 'POST', headers: cab(s.access_token) }).catch(function () {});
    },

    /* RPC sem login (só o que o servidor libera para anônimos, ex.: ver de quem é um convite) */
    rpcPublico: function (nome, args) {
      return fetch(base() + '/rest/v1/rpc/' + nome, { method: 'POST', headers: cab(null), body: JSON.stringify(args || {}) }).then(json);
    },
    /* conta pelo convite: código + senha nova; a conta nasce confirmada e já entra */
    contaPeloConvite: function (token, codigo, senha) {
      return fetch(base() + '/functions/v1/convite-conta', { method: 'POST', headers: cab(null), body: JSON.stringify({ token: token, codigo: codigo, senha: senha }) })
        .then(function (r) { return r.json().catch(function () { return { erro: 'servidor' }; }); })
        .then(function (j) { if (j && j.ok) return Conta.entrar(j.email, senha).then(function () { return j; }); return j; });
    },
    rpc: function (nome, args) {
      return Conta.token().then(function (t) {
        if (!t) throw new Error('sem-sessao');
        return fetch(base() + '/rest/v1/rpc/' + nome, { method: 'POST', headers: cab(t), body: JSON.stringify(args || {}) }).then(json);
      });
    },

    /* quem pode usar o app agora? */
    acesso: function () {
      if (cfg.ACESSO === 'aberto') return Promise.resolve({ liberado: true, origem: 'aberto' });
      var guardado = ler(ACESSO);
      function doCache() {
        if (!guardado) return { liberado: false, motivo: Conta.sessao() ? 'sem-internet' : 'sem-conta' };
        var prazo = (cfg.DIAS_SEM_INTERNET || 7) * 86400000;
        var ok = guardado.liberado && Date.now() - guardado.conferido < prazo && (!guardado.ate || Date.parse(guardado.ate) > Date.now());
        return Object.assign({}, guardado, { liberado: !!ok, offline: true, motivo: ok ? null : 'conferir' });
      }
      if (!Conta.sessao()) return Promise.resolve({ liberado: false, motivo: 'sem-conta' });
      if (!navigator.onLine) return Promise.resolve(doCache());
      return Conta.rpc('acesso_app', { p_app: APP }).then(function (r) {
        var x = Array.isArray(r) ? r[0] : r;
        var res = { liberado: !!(x && x.liberado), origem: x && x.origem, ate: x && x.valida_ate, plano: x && x.plano, conferido: Date.now() };
        gravar(ACESSO, res);
        return res;
      }).catch(function (e) {
        if (e.message === 'sem-sessao') return { liberado: false, motivo: 'sem-conta' };
        if (e.codigo === 'PGRST202') return { liberado: false, motivo: 'sql-faltando' };
        return doCache();
      });
    },

    resgatarCodigo: function (codigo) {
      codigo = String(codigo || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (codigo.length < 6) return Promise.reject(new Error('codigo-curto'));
      return Conta.rpc('resgatar_codigo', { p_app: APP, p_codigo: codigo }).then(function (r) {
        var x = Array.isArray(r) ? r[0] : r;
        gravar(ACESSO, null);
        return x;
      });
    }
  };

  window.Conta = Conta;
})();
