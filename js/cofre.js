/* =====================================================================
   cofre.js — guarda reservas e dados de saúde (alergias, intolerâncias)
   embaralhados no aparelho.

   COMO FUNCIONA (padrão das diretrizes SolverONE)
   - Uma chave de dados aleatória (AES-GCM 256) embaralha o conteúdo.
   - Essa chave fica guardada "embrulhada" duas vezes:
       1) pelo PIN (PBKDF2-SHA256, 600.000 rodadas, sal aleatório);
       2) pelo código de recuperação, mostrado UMA vez ao criar;
       3) se a pessoa ligar, pela digital ou rosto (biometria.js).
   - A chave aberta só existe na memória enquanto o cofre está aberto.
     Fecha sozinho depois de 5 minutos sem uso e ao sair do app.
   - Perder PIN e código = perder o que está no cofre. A tela diz isso.
   - Tentativas erradas: a partir da 5ª, espera crescente.
   ===================================================================== */
(function () {
  'use strict';
  var ITER = 600000, FECHAR_MS = 5 * 60 * 1000;
  var chave = null, relogio = null;
  var enc = new TextEncoder(), dec = new TextDecoder();

  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function deB64(s) { var t = atob(s), b = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b; }
  function aleatorio(n) { var b = new Uint8Array(n); crypto.getRandomValues(b); return b; }

  function derivar(segredo, sal) {
    return crypto.subtle.importKey('raw', enc.encode(segredo), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: ITER, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
    });
  }
  function embrulhar(dados, segredo) {
    var sal = aleatorio(16), iv = aleatorio(12);
    return derivar(segredo, sal).then(function (k) {
      return crypto.subtle.wrapKey('raw', dados, k, { name: 'AES-GCM', iv: iv });
    }).then(function (w) { return { sal: b64(sal), iv: b64(iv), chave: b64(w) }; });
  }
  function desembrulhar(pacote, segredo) {
    return derivar(segredo, deB64(pacote.sal)).then(function (k) {
      return crypto.subtle.unwrapKey('raw', deB64(pacote.chave), k, { name: 'AES-GCM', iv: deB64(pacote.iv) },
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    });
  }
  /* código de recuperação: 20 caracteres sem letras confusas (~100 bits) */
  function novoCodigo() {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = aleatorio(20), s = '';
    for (var i = 0; i < 20; i++) { s += abc[b[i] % abc.length]; if (i % 5 === 4 && i < 19) s += '-'; }
    return s;
  }
  function normalizarCodigo(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{5})(?=.)/g, '$1-'); }

  function armar() {
    clearTimeout(relogio);
    relogio = setTimeout(function () { Cofre.fechar(); }, FECHAR_MS);
  }

  var Cofre = {
    existe: function () { return Banco.meta('cofre', null).then(function (c) { return !!c; }); },
    aberto: function () { return !!chave; },

    /* cria o cofre com um PIN; devolve o código de recuperação (mostrar uma vez) */
    criar: function (pin) {
      if (!/^\d{6}$/.test(pin)) return Promise.reject(new Error('pin-formato'));
      var codigo = novoCodigo(), dados;
      return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']).then(function (k) {
        dados = k;
        return Promise.all([embrulhar(k, pin), embrulhar(k, normalizarCodigo(codigo))]);
      }).then(function (p) {
        return Banco.definirMeta('cofre', { formato: 1, pin: p[0], recuperacao: p[1], iter: ITER, criado_em: new Date().toISOString() })
          .then(function () { return Banco.gravar('cofre', { id: 'recuperacao', formato: 1, recuperacao: p[1], iter: ITER }); });
      }).then(function () {
        chave = dados; armar();
        return Banco.definirMeta('cofre-erros', { n: 0, ate: 0 });
      }).then(function () { return codigo; });
    },

    /* abre com o PIN (ou com o código de recuperação) */
    abrir: function (segredo, porCodigo) {
      return Banco.meta('cofre-erros', { n: 0, ate: 0 }).then(function (er) {
        if (er.ate && Date.now() < er.ate) {
          var e = new Error('espera'); e.segundos = Math.ceil((er.ate - Date.now()) / 1000); throw e;
        }
        return Banco.meta('cofre', null).then(function (c) {
          if (!c) throw new Error('sem-cofre');
          return desembrulhar(porCodigo ? c.recuperacao : c.pin, porCodigo ? normalizarCodigo(segredo) : segredo);
        }).then(function (k) {
          chave = k; armar();
          return Banco.definirMeta('cofre-erros', { n: 0, ate: 0 }).then(function () { return true; });
        }, function (falha) {
          if (falha && falha.message === 'sem-cofre') throw falha;
          var n = (er.n || 0) + 1, espera = n >= 5 ? Math.min(3600, 30 * Math.pow(2, n - 5)) * 1000 : 0;
          return Banco.definirMeta('cofre-erros', { n: n, ate: espera ? Date.now() + espera : 0 }).then(function () {
            var e = new Error('pin-errado'); e.tentativas = n; throw e;
          });
        });
      });
    },

    /* troca o PIN (cofre aberto); o código de recuperação continua valendo */
    trocarPin: function (novo) {
      if (!chave) return Promise.reject(new Error('fechado'));
      if (!/^\d{6}$/.test(novo)) return Promise.reject(new Error('pin-formato'));
      return Promise.all([embrulhar(chave, novo), Banco.meta('cofre', null)]).then(function (r) {
        r[1].pin = r[0];
        return Banco.definirMeta('cofre', r[1]);
      });
    },

    /* digital ou rosto (biometria.js): mais um embrulho da mesma chave de dados */
    temBio: function () { return Banco.meta('cofre', null).then(function (c) { return !!(c && c.bio); }); },
    ligarBio: function (chaveBio) {
      if (!chave) return Promise.reject(new Error('fechado'));
      var iv = aleatorio(12);
      return crypto.subtle.wrapKey('raw', chave, chaveBio, { name: 'AES-GCM', iv: iv }).then(function (w) {
        return Banco.meta('cofre', null).then(function (c) { c.bio = { iv: b64(iv), chave: b64(w) }; return Banco.definirMeta('cofre', c); });
      });
    },
    abrirComBio: function (chaveBio) {
      return Banco.meta('cofre', null).then(function (c) {
        if (!c || !c.bio) throw new Error('sem-bio');
        return crypto.subtle.unwrapKey('raw', deB64(c.bio.chave), chaveBio, { name: 'AES-GCM', iv: deB64(c.bio.iv) },
          { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      }).then(function (k) { chave = k; armar(); return true; });
    },
    desligarBio: function () {
      return Banco.meta('cofre', null).then(function (c) { if (c && c.bio) { delete c.bio; return Banco.definirMeta('cofre', c); } });
    },

    /* ---- levar o cofre para outro celular ---- */
    /* a chave crua (base64) para o QR; só com o cofre aberto, e some em 2 min */
    exportarChave: function () {
      if (!chave) return Promise.reject(new Error('fechado'));
      return crypto.subtle.exportKey('raw', chave).then(function (raw) { return b64(raw); });
    },
    /* no celular novo: chave vinda do QR + PIN novo; o código de recuperação antigo continua valendo se o embrulho veio da conta */
    importarChave: function (b64chave, pin) {
      if (!/^\d{6}$/.test(pin)) return Promise.reject(new Error('pin-formato'));
      var raw = deB64(b64chave); if (raw.length !== 32) return Promise.reject(new Error('chave-formato'));
      var dados;
      return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']).then(function (k) {
        dados = k;
        return Promise.all([embrulhar(k, pin), Banco.ler('cofre', 'recuperacao')]);
      }).then(function (r) {
        var rec = r[1] && r[1].recuperacao, codigo = null;
        var pr = rec ? Promise.resolve(rec) : (function () { codigo = novoCodigo(); return embrulhar(dados, normalizarCodigo(codigo)).then(function (w) { return Banco.gravar('cofre', { id: 'recuperacao', formato: 1, recuperacao: w, iter: ITER }).then(function () { return w; }); }); })();
        return pr.then(function (recW) {
          return Banco.definirMeta('cofre', { formato: 1, pin: r[0], recuperacao: recW, iter: ITER, criado_em: new Date().toISOString() });
        }).then(function () { chave = dados; armar(); return Banco.definirMeta('cofre-erros', { n: 0, ate: 0 }); }).then(function () { return codigo; });
      });
    },
    /* no celular novo: código de recuperação (o embrulho veio da conta) + PIN novo */
    importarPorCodigo: function (codigo, pin) {
      if (!/^\d{6}$/.test(pin)) return Promise.reject(new Error('pin-formato'));
      return Banco.ler('cofre', 'recuperacao').then(function (r) {
        if (!r || !r.recuperacao) throw new Error('sem-recuperacao');
        return desembrulhar(r.recuperacao, normalizarCodigo(codigo)).then(function (k) {
          return crypto.subtle.exportKey('raw', k).then(function (raw) { return Cofre.importarChave(b64(raw), pin); });
        });
      });
    },
    /* a conta tem um cofre (de outro celular) e este aparelho ainda não? */
    temNaConta: function () { return Banco.ler('cofre', 'recuperacao').then(function (r) { return !!(r && r.recuperacao); }); },

    fechar: function () { chave = null; clearTimeout(relogio); document.dispatchEvent(new CustomEvent('gx:cofre', { detail: { aberto: false } })); },

    cifrar: function (obj) {
      if (!chave) return Promise.reject(new Error('fechado'));
      armar();
      var iv = aleatorio(12);
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, chave, enc.encode(JSON.stringify(obj))).then(function (c) {
        return { v: 1, iv: b64(iv), dados: b64(c) };
      });
    },
    decifrar: function (blob) {
      if (!chave) return Promise.reject(new Error('fechado'));
      if (!blob) return Promise.resolve(null);
      armar();
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(blob.iv) }, chave, deB64(blob.dados)).then(function (p) {
        return JSON.parse(dec.decode(p));
      });
    }
  };

  /* sair do app (aba escondida por mais de 5 min) fecha o cofre */
  var escondidoEm = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) escondidoEm = Date.now();
    else if (escondidoEm && Date.now() - escondidoEm > FECHAR_MS) Cofre.fechar();
  });

  window.Cofre = Cofre;
})();
