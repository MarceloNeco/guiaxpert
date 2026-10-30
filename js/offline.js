/* =====================================================================
   offline.js — mapa de fundo que funciona sem internet

   Cada cidade com pacote pode ter um arquivo de mapa (.pmtiles: recorte do
   OpenStreetMap, ~4 MB para Gramado e Canela, zoom até a rua). O app baixa
   o arquivo INTEIRO uma vez, guarda no Cache Storage e desenha os tiles
   vetoriais no aparelho (protomaps-leaflet). Depois disso o mapa abre sem
   sinal. Nada de baixar tiles do OSM em massa (a política deles proíbe).

   "Guardar para usar sem internet" = mapa + pacote da cidade + o próprio
   app (o service worker já guarda o app).
   Licenças: dados © OpenStreetMap contributors (ODbL); estilo Protomaps.
   ===================================================================== */
(function () {
  'use strict';
  var cfg = window.GUIAXPERT_CONFIG || {};
  var CACHE = 'gx-mapas-v1';
  var libs = null, indice = null;

  function fontes() { return [cfg.MAPAS_CENTRAL, cfg.MAPAS_LOCAL].filter(Boolean); }
  function carregarLibs() {
    if (window.pmtiles && window.protomapsL) return Promise.resolve();
    if (libs) return libs;
    libs = ['vendor/pmtiles/pmtiles.js', 'vendor/pmtiles/protomaps-leaflet.js'].reduce(function (p, src) {
      return p.then(function () {
        return new Promise(function (ok, erro) {
          var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { libs = null; erro(new Error('lib ' + src)); };
          document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
    return libs;
  }
  function lerIndice() {
    if (indice) return Promise.resolve(indice);
    var fs = fontes();
    function tentar(i) {
      if (i >= fs.length) return Banco.meta('mapas-indice', null).then(function (j) { return j || { mapas: {} }; });
      return fetch(fs[i] + 'indice.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (j) { j._fonte = fs[i]; Banco.definirMeta('mapas-indice', j); return j; })
        .catch(function () { return tentar(i + 1); });
    }
    return tentar(0).then(function (j) { indice = j; return j; });
  }
  function chaveCache(cidade) { return 'gx-mapa-' + cidade; }

  /* fonte PMTiles lendo de um Blob guardado no aparelho */
  function BlobSource(blob, chave) { this.blob = blob; this.chave = chave; }
  BlobSource.prototype.getKey = function () { return this.chave; };
  BlobSource.prototype.getBytes = function (offset, length) {
    return this.blob.slice(offset, offset + length).arrayBuffer().then(function (data) { return { data: data }; });
  };

  function blobGuardado(cidade) {
    if (!window.caches) return Promise.resolve(null);
    return caches.open(CACHE).then(function (c) { return c.match(chaveCache(cidade)); })
      .then(function (r) { return r ? r.blob() : null; }).catch(function () { return null; });
  }

  var Offline = {
    /* a cidade tem mapa? → { arquivo, bytes, url } ou null */
    info: function (cidade) {
      if (!cidade) return Promise.resolve(null);
      return lerIndice().then(function (j) {
        var m = j.mapas && j.mapas[cidade]; if (!m) return null;
        return Object.assign({}, m, { id: cidade, url: (j._fonte || fontes()[0] || 'mapas/') + m.arquivo });
      });
    },
    estado: function (cidade) {
      return Promise.all([Offline.info(cidade), Banco.meta('mapa-guardado-' + cidade, null)]).then(function (r) {
        return { temMapa: !!r[0], bytes: r[0] ? r[0].bytes : 0, guardado: !!r[1], em: r[1] && r[1].em, versao: r[1] && r[1].versao };
      });
    },

    /* baixa o arquivo inteiro (com progresso 0..1) e guarda; devolve o Blob */
    baixar: function (cidade, aoProgresso) {
      return Offline.info(cidade).then(function (m) {
        if (!m) throw new Error('sem-mapa');
        return fetch(m.url).then(function (r) {
          if (!r.ok) throw new Error('http-' + r.status);
          var total = +r.headers.get('content-length') || m.bytes || 0, lido = 0, partes = [];
          var leitor = r.body && r.body.getReader ? r.body.getReader() : null;
          if (!leitor) return r.blob();
          function passo() {
            return leitor.read().then(function (x) {
              if (x.done) return new Blob(partes, { type: 'application/octet-stream' });
              partes.push(x.value); lido += x.value.length;
              if (aoProgresso && total) aoProgresso(Math.min(1, lido / total), lido, total);
              return passo();
            });
          }
          return passo();
        }).then(function (blob) {
          return caches.open(CACHE).then(function (c) { return c.put(chaveCache(cidade), new Response(blob, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(blob.size) } })); })
            .then(function () { return Banco.definirMeta('mapa-guardado-' + cidade, { em: new Date().toISOString(), bytes: blob.size, versao: m.versao }); })
            .then(function () { return blob; });
        });
      });
    },

    /* "Guardar esta viagem": mapa + pacote. aoProgresso(fracao, texto) */
    guardarViagem: function (cidade, aoProgresso) {
      var passos = [];
      if (cidade) passos.push(function () { return Pacotes.carregar(cidade).catch(function () { return null; }); });
      passos.push(function () {
        return Offline.info(cidade).then(function (m) { if (!m) return null; return Offline.baixar(cidade, function (f) { if (aoProgresso) aoProgresso(f); }); });
      });
      return passos.reduce(function (p, f) { return p.then(f); }, Promise.resolve()).then(function () { return Offline.estado(cidade); });
    },
    apagar: function (cidade) {
      return caches.open(CACHE).then(function (c) { return c.delete(chaveCache(cidade)); }).then(function () { return Banco.definirMeta('mapa-guardado-' + cidade, null); });
    },

    /* fundo vetorial no mapa Leaflet; resolve true se desenhou, false se não há mapa desta cidade */
    fundo: function (m, cidade) {
      if (!cidade) return Promise.resolve(false);
      return Offline.info(cidade).then(function (info) {
        if (!info) return false;
        return carregarLibs().then(function () { return blobGuardado(cidade); }).then(function (blob) {
          /* sem cópia guardada: baixa agora (são poucos MB) e já deixa guardado */
          return blob || (navigator.onLine ? Offline.baixar(cidade) : null);
        }).then(function (blob) {
          if (!blob) return false;
          var pm = new pmtiles.PMTiles(new BlobSource(blob, chaveCache(cidade) + ':' + blob.size));
          var escuro = document.documentElement.getAttribute('data-tema') === 'escuro' ||
            (!document.documentElement.getAttribute('data-tema') && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
          var camada = protomapsL.leafletLayer({ url: pm, flavor: escuro ? 'dark' : 'light', lang: (window.DGO && DGO.idioma && DGO.idioma()) === 'en' ? 'en' : 'pt',
            attribution: '© OpenStreetMap · Protomaps', maxDataZoom: info.zoomMax || 15, maxZoom: 19 });
          camada.addTo(m);
          return true;
        });
      }).catch(function (e) { console.warn('GuiaXpert: mapa offline', e && e.message); return false; });
    }
  };

  window.Offline = Offline;
})();
