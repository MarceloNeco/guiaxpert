/* =====================================================================
   digital.js — digital ou rosto CONFERIDA NO SERVIDOR (Edge Function "digital")

   Diferente de biometria.js (que só destranca coisas neste aparelho), aqui o
   servidor confere a assinatura da chave de acesso (passkey) e libera, por
   15 minutos, o que exige "confirme que é você" (mexer nas chaves do serviço).
   Usado só pela equipe (dono/admin). O aparelho guarda apenas o id da chave
   de acesso cadastrada aqui, para saber se oferece o botão.
   ===================================================================== */
(function () {
  'use strict';
  var GUARDA = 'guiaxpert.digital-servidor';

  function b64u(buf) {
    var s = '', b = new Uint8Array(buf);
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function deB64u(t) {
    t = String(t).replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '=';
    var s = atob(t), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  function ler() { try { return JSON.parse(localStorage.getItem(GUARDA) || 'null'); } catch (e) { return null; } }
  function gravar(v) { try { if (v) localStorage.setItem(GUARDA, JSON.stringify(v)); else localStorage.removeItem(GUARDA); } catch (e) {} }

  /* opções que vieram do servidor (texto) → o formato que o navegador pede (bytes) */
  function paraCriar(o) {
    var p = Object.assign({}, o, { challenge: deB64u(o.challenge), user: Object.assign({}, o.user, { id: deB64u(o.user.id) }) });
    p.excludeCredentials = (o.excludeCredentials || []).map(function (c) { return Object.assign({}, c, { id: deB64u(c.id) }); });
    return p;
  }
  function paraEntrar(o) {
    var p = Object.assign({}, o, { challenge: deB64u(o.challenge) });
    p.allowCredentials = (o.allowCredentials || []).map(function (c) { return Object.assign({}, c, { id: deB64u(c.id) }); });
    return p;
  }
  /* resposta do navegador (bytes) → texto para o servidor */
  function respostaCriar(c) {
    var r = c.response;
    return { id: c.id, rawId: b64u(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment || undefined,
      clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {},
      response: { clientDataJSON: b64u(r.clientDataJSON), attestationObject: b64u(r.attestationObject),
        transports: r.getTransports ? r.getTransports() : undefined } };
  }
  function respostaEntrar(c) {
    var r = c.response;
    return { id: c.id, rawId: b64u(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment || undefined,
      clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {},
      response: { clientDataJSON: b64u(r.clientDataJSON), authenticatorData: b64u(r.authenticatorData),
        signature: b64u(r.signature), userHandle: r.userHandle ? b64u(r.userHandle) : undefined } };
  }
  function erro(e) {
    var n = e && e.name;
    var x = new Error(n === 'NotAllowedError' ? 'cancelado' : n === 'InvalidStateError' ? 'ja-existe' : (e && e.message) || 'falhou');
    x.original = e; return x;
  }

  var Digital = {
    /* conversões expostas para o teste */
    _paraCriar: paraCriar, _paraEntrar: paraEntrar, _respostaCriar: respostaCriar, _respostaEntrar: respostaEntrar,

    temNeste: function () { return !!ler(); },
    esquecer: function () { gravar(null); },
    suportada: function () { return window.Bio ? Bio.suportada() : Promise.resolve(false); },

    /* chamar(acao, extra) → Promise<{status, j}> : o app passa a função que fala com o servidor */
    cadastrar: function (chamar, nome) {
      return chamar('opcoes-cadastro').then(function (r) {
        if (r.status !== 200) { var x = new Error(r.j.erro || ('http-' + r.status)); x.status = r.status; throw x; }
        return navigator.credentials.create({ publicKey: paraCriar(r.j) }).catch(function (e) { throw erro(e); });
      }).then(function (cred) {
        return chamar('cadastrar', { resposta: respostaCriar(cred), nome: nome || '', app: 'guiaxpert' });
      }, function (e) {
        /* o celular já tem uma chave de acesso desta conta no servidor (só o aparelho tinha esquecido): passa a usar */
        if (e.message === 'ja-existe') { gravar({ id: null, em: new Date().toISOString() }); return { status: 200, j: { ok: true, id: null } }; }
        throw e;
      }).then(function (r) {
        if (r.status !== 200 || !r.j.ok) { var x = new Error(r.j.erro || ('http-' + r.status)); x.status = r.status; throw x; }
        gravar({ id: r.j.id, em: new Date().toISOString() });
        return true;
      });
    },
    confirmar: function (chamar) {
      return chamar('opcoes-entrar').then(function (r) {
        if (r.status === 404) { gravar(null); throw new Error('sem-digital'); }
        if (r.status !== 200) throw new Error(r.j.erro || ('http-' + r.status));
        return navigator.credentials.get({ publicKey: paraEntrar(r.j) }).catch(function (e) { throw erro(e); });
      }).then(function (a) {
        return chamar('entrar', { resposta: respostaEntrar(a) });
      }).then(function (r) {
        if (r.status !== 200 || !r.j.ok) throw new Error(r.j.erro || ('http-' + r.status));
        return true;
      });
    }
  };
  window.Digital = Digital;
})();
