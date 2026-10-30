/* =====================================================================
   biometria.js — digital ou rosto NESTE aparelho (WebAuthn + PRF)

   Depois do primeiro login, a pessoa liga "Digital ou rosto". O celular
   cria uma chave de acesso (passkey) só deste app e, a cada leitura da
   digital/rosto, devolve o mesmo SEGREDO (extensão PRF). Desse segredo
   saem duas chaves AES-GCM:
     - "sessao": tranca a sessão guardada ao sair, para voltar sem senha;
     - "cofre":  abre as reservas no lugar do PIN.
   Nada disso sai do aparelho. Sem PRF (celular antigo), a função não
   liga: não existe "trava de enfeite" que só esconde a tela.
   Requisito: Chrome no Android ou Safari no iOS 18+ (passkey do aparelho).
   ===================================================================== */
(function () {
  'use strict';
  var GUARDA = 'guiaxpert.bio';
  var SAL_PRF = new TextEncoder().encode('guiaxpert:bio:v1:prf-salt-000000').slice(0, 32);
  var enc = new TextEncoder();

  function aleatorio(n) { var b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function deB64(s) { var t = atob(s), b = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b; }
  function ler() { try { return JSON.parse(localStorage.getItem(GUARDA) || 'null'); } catch (e) { return null; } }
  function gravar(v) { try { if (v) localStorage.setItem(GUARDA, JSON.stringify(v)); else localStorage.removeItem(GUARDA); } catch (e) {} }

  /* segredo PRF → chave AES por finalidade (HKDF-SHA256) */
  function chaves(segredo) {
    return crypto.subtle.importKey('raw', segredo, 'HKDF', false, ['deriveKey']).then(function (base) {
      var d = function (info) {
        return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode('guiaxpert:' + info) },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
      };
      return Promise.all([d('sessao'), d('cofre')]).then(function (k) { return { sessao: k[0], cofre: k[1] }; });
    });
  }
  function erro(e) {
    var n = e && e.name;
    var x = new Error(n === 'NotAllowedError' ? 'cancelado' : n === 'InvalidStateError' ? 'ja-existe' : (e && e.message) || 'falhou');
    x.original = e; return x;
  }

  var Bio = {
    ligada: function () { return !!ler(); },

    /* o aparelho tem digital/rosto e o navegador fala WebAuthn? (PRF só dá para saber ao criar) */
    suportada: function () {
      if (!window.PublicKeyCredential || !window.isSecureContext) return Promise.resolve(false);
      var f = PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
      return f ? f.call(PublicKeyCredential).catch(function () { return false; }) : Promise.resolve(false);
    },

    /* liga: cria a chave de acesso e já devolve as chaves (uma leitura, às vezes duas) */
    ligar: function (rotulo) {
      return navigator.credentials.create({ publicKey: {
        rp: { name: 'GuiaXpert', id: location.hostname },
        user: { id: aleatorio(16), name: rotulo || 'GuiaXpert', displayName: rotulo || 'GuiaXpert' },
        challenge: aleatorio(32),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
        timeout: 60000,
        extensions: { prf: { eval: { first: SAL_PRF } } }
      } }).catch(function (e) { throw erro(e); }).then(function (cred) {
        var ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
        if (!ext.prf || ext.prf.enabled === false) throw new Error('sem-prf');
        gravar({ id: b64(cred.rawId), em: new Date().toISOString() });
        if (ext.prf.results && ext.prf.results.first) return chaves(ext.prf.results.first);
        /* alguns aparelhos só entregam o segredo numa leitura separada */
        return Bio.chaves().catch(function (e) { gravar(null); throw e; });
      });
    },

    /* pede a digital/rosto e devolve { sessao, cofre } */
    chaves: function () {
      var g = ler();
      if (!g) return Promise.reject(new Error('desligada'));
      return navigator.credentials.get({ publicKey: {
        challenge: aleatorio(32), rpId: location.hostname, timeout: 60000, userVerification: 'required',
        allowCredentials: [{ type: 'public-key', id: deB64(g.id) }],
        extensions: { prf: { eval: { first: SAL_PRF } } }
      } }).catch(function (e) { throw erro(e); }).then(function (a) {
        var ext = a.getClientExtensionResults ? a.getClientExtensionResults() : {};
        if (!ext.prf || !ext.prf.results || !ext.prf.results.first) throw new Error('sem-prf');
        return chaves(ext.prf.results.first);
      });
    },

    /* desliga neste aparelho (a chave de acesso pode continuar no gerenciador de senhas; sem uso) */
    desligar: function () { gravar(null); },

    /* utilitários para quem guarda coisas com a chave "sessao" */
    cifrar: function (chave, obj) {
      var iv = aleatorio(12);
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, chave, enc.encode(JSON.stringify(obj))).then(function (c) { return { iv: b64(iv), dados: b64(c) }; });
    },
    decifrar: function (chave, blob) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(blob.iv) }, chave, deB64(blob.dados)).then(function (p) { return JSON.parse(new TextDecoder().decode(p)); });
    }
  };

  window.Bio = Bio;
})();
