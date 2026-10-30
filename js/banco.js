/* =====================================================================
   banco.js — onde o GuiaXpert guarda os dados no aparelho (IndexedDB)

   POR QUE ASSIM
   - Cada "loja" tem o mesmo formato da tabela que vai existir no Supabase
     (id uuid, criado_em, atualizado_em, versao, apagado). Ir para a nuvem
     depois = mandar estes registros, sem converter nada.
   - Toda mudança entra na "fila" (outbox). Hoje a fila só cresce; quando a
     conta na nuvem for ligada, ela sobe o que estiver pendente.
   - Apagar é "apagado: true" (soft delete), para a sincronia saber o que sumiu.

   LOJAS (= futuras tabelas guiaxpert_*)
     pessoas     quem viaja (perfil reaproveitado entre viagens)
     viagens     datas, destino (pacote), quem vai, estadias, preferências
     roteiros    opções de roteiro de uma viagem (várias por viagem)
     favoritos   lugares e roteiros marcados com ★
     lugares     lugares que a pessoa acrescentou ou salvou da busca
     reservas    voos, hotel, carro… (conteúdo cifrado pelo cofre)
     pacotes     cópia offline dos pacotes de cidade
     meta        ajustes soltos (chave → valor)
     fila        mudanças esperando para subir à nuvem
   ===================================================================== */
(function () {
  'use strict';
  var NOME = 'guiaxpert', VERSAO_BANCO = 1;
  var LOJAS = ['pessoas', 'viagens', 'roteiros', 'favoritos', 'lugares', 'reservas', 'pacotes', 'meta', 'fila'];
  var promessa = null;

  function abrir() {
    if (promessa) return promessa;
    promessa = new Promise(function (ok, erro) {
      if (!('indexedDB' in window)) { erro(new Error('sem-indexeddb')); return; }
      var r = indexedDB.open(NOME, VERSAO_BANCO);
      r.onupgradeneeded = function () {
        var db = r.result;
        LOJAS.forEach(function (n) {
          if (!db.objectStoreNames.contains(n)) {
            var s = db.createObjectStore(n, { keyPath: n === 'meta' ? 'chave' : (n === 'fila' ? 'seq' : 'id'), autoIncrement: n === 'fila' });
            if (n === 'roteiros' || n === 'reservas') s.createIndex('viagem_id', 'viagem_id', { unique: false });
          }
        });
      };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { erro(r.error); };
    });
    return promessa;
  }

  function tx(loja, modo, fazer) {
    return abrir().then(function (db) {
      return new Promise(function (ok, erro) {
        var t = db.transaction(loja, modo), s = t.objectStore(loja), res;
        res = fazer(s);
        t.oncomplete = function () { ok(res && res.result !== undefined ? res.result : res); };
        t.onerror = function () { erro(t.error); };
        t.onabort = function () { erro(t.error); };
      });
    });
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  var Banco = {
    uuid: uuid,

    /* lê um registro (null se não existe ou está apagado) */
    ler: function (loja, id) {
      return tx(loja, 'readonly', function (s) { return s.get(id); }).then(function (r) {
        return r && !r.apagado ? r : null;
      });
    },

    /* lista tudo que não foi apagado; filtro opcional */
    listar: function (loja, filtro) {
      return tx(loja, 'readonly', function (s) { return s.getAll(); }).then(function (lista) {
        lista = (lista || []).filter(function (r) { return !r.apagado; });
        return filtro ? lista.filter(filtro) : lista;
      });
    },

    /* grava (cria ou atualiza) e põe na fila da nuvem */
    gravar: function (loja, obj) {
      var agora = new Date().toISOString();
      obj = Object.assign({}, obj);
      if (loja !== 'meta' && loja !== 'pacotes') {
        if (!obj.id) obj.id = uuid();
        if (!obj.criado_em) obj.criado_em = agora;
        obj.atualizado_em = agora;
        obj.versao = (obj.versao || 0) + 1;
        obj.apagado = !!obj.apagado;
      }
      return tx(loja, 'readwrite', function (s) { s.put(obj); }).then(function () {
        if (loja === 'meta' || loja === 'pacotes') return obj;
        return Banco.enfileirar(loja, obj.id, obj.apagado ? 'apagar' : 'gravar').then(function () {
          document.dispatchEvent(new CustomEvent('gx:dados', { detail: { loja: loja, id: obj.id } }));
          return obj;
        });
      });
    },

    apagar: function (loja, id) {
      return tx(loja, 'readonly', function (s) { return s.get(id); }).then(function (r) {
        if (!r) return null;
        r.apagado = true;
        return Banco.gravar(loja, r);
      });
    },

    enfileirar: function (loja, id, acao) {
      return tx('fila', 'readwrite', function (s) { s.add({ loja: loja, id: id, acao: acao, quando: new Date().toISOString() }); });
    },
    pendentes: function () { return tx('fila', 'readonly', function (s) { return s.count(); }); },

    /* ajustes soltos */
    meta: function (chave, padrao) {
      return tx('meta', 'readonly', function (s) { return s.get(chave); }).then(function (r) {
        return r ? r.valor : padrao;
      });
    },
    definirMeta: function (chave, valor) {
      return tx('meta', 'readwrite', function (s) { s.put({ chave: chave, valor: valor }); });
    },

    /* LGPD: exportar e apagar tudo (nunca bloqueados) */
    exportarTudo: function () {
      var saida = { app: 'guiaxpert', formato: 1, em: new Date().toISOString(), dados: {} };
      return LOJAS.filter(function (n) { return n !== 'fila' && n !== 'pacotes'; }).reduce(function (p, n) {
        return p.then(function () {
          return tx(n, 'readonly', function (s) { return s.getAll(); }).then(function (l) { saida.dados[n] = l; });
        });
      }, Promise.resolve()).then(function () { return saida; });
    },
    apagarTudo: function () {
      return abrir().then(function (db) {
        db.close(); promessa = null;
        return new Promise(function (ok) {
          var r = indexedDB.deleteDatabase(NOME);
          r.onsuccess = r.onerror = r.onblocked = function () { ok(); };
        });
      });
    },

    /* quanto o app ocupa no aparelho */
    espaco: function () {
      if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
      return navigator.storage.estimate();
    }
  };

  window.Banco = Banco;
})();
