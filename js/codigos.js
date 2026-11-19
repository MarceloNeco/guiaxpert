/* =====================================================================
   codigos.js — lê QR e códigos de cartão de embarque/ingresso de qualquer
   lugar: câmera, foto, print, PDF, TXT ou imagem colada. Tudo no aparelho,
   sem internet e sem IA.

   - Leitor do próprio celular (BarcodeDetector: QR, Aztec, PDF417, Data
     Matrix) quando existe; senão jsQR (só QR), tentando vários tamanhos,
     cores invertidas e recortes (foto de tela torta, QR pequeno no print).
   - Acha VÁRIOS códigos na mesma imagem (cobre o achado e procura de novo).
   - PDF: desenha cada página com o pdf.js (carregado só quando precisa).
   - Cartão de embarque (padrão IATA "BCBP", o texto que começa com "M1"):
     nome, localizador, de/para, companhia, voo, dia, assento e sequência.
   Nada sai do aparelho.
   ===================================================================== */
(function () {
  'use strict';
  var libsQR = null, libsPdf = null;
  function script(src) {
    return new Promise(function (ok, erro) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { erro(new Error('lib ' + src)); }; document.head.appendChild(s); });
  }
  function carregarJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (!libsQR) libsQR = script('vendor/qr/jsqr.js').catch(function (e) { libsQR = null; throw e; });
    return libsQR;
  }
  function carregarPdf() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!libsPdf) libsPdf = script('vendor/pdfjs/pdf.min.js').then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
      return window.pdfjsLib;
    }).catch(function (e) { libsPdf = null; throw e; });
    return libsPdf;
  }

  var detector = null;
  function nativo() {
    if (detector !== null) return Promise.resolve(detector);
    if (!('BarcodeDetector' in window)) { detector = false; return Promise.resolve(false); }
    return Promise.resolve(window.BarcodeDetector.getSupportedFormats ? window.BarcodeDetector.getSupportedFormats() : ['qr_code']).then(function (fs) {
      var quero = ['qr_code', 'aztec', 'pdf417', 'data_matrix'].filter(function (f) { return fs.indexOf(f) > -1; });
      detector = quero.length ? new window.BarcodeDetector({ formats: quero }) : false;
      return detector;
    }).catch(function () { detector = false; return false; });
  }

  /* qualquer coisa desenhável → canvas com no máximo "max" pixels no lado maior */
  function paraCanvas(src, max) {
    var w = src.naturalWidth || src.videoWidth || src.width, hh = src.naturalHeight || src.videoHeight || src.height;
    var k = Math.min(1, (max || 1600) / Math.max(w, hh));
    var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(hh * k));
    var cx = cv.getContext('2d', { willReadFrequently: true });
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    cx.drawImage(src, 0, 0, cv.width, cv.height);
    return cv;
  }
  /* contraste: foto de tela fica cinza e com moiré; esticar o cinza ajuda o jsQR */
  function contrastar(cv) {
    var cx = cv.getContext('2d', { willReadFrequently: true }), im = cx.getImageData(0, 0, cv.width, cv.height), p = im.data, min = 255, max = 0, i, y;
    for (i = 0; i < p.length; i += 16) { y = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000; if (y < min) min = y; if (y > max) max = y; }
    var esc = max - min > 20 ? 255 / (max - min) : 1;
    for (i = 0; i < p.length; i += 4) { y = ((p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000 - min) * esc; y = y < 0 ? 0 : y > 255 ? 255 : y; p[i] = p[i + 1] = p[i + 2] = y; }
    cx.putImageData(im, 0, 0);
    return cv;
  }
  function jsqrEm(cv, x, y, w, hh, inverter) {
    var im = cv.getContext('2d', { willReadFrequently: true }).getImageData(x, y, w, hh);
    var r = window.jsQR(im.data, im.width, im.height, { inversionAttempts: inverter ? 'attemptBoth' : 'dontInvert' });
    if (!r || !r.data) return null;
    var xs = [r.location.topLeftCorner.x, r.location.topRightCorner.x, r.location.bottomLeftCorner.x, r.location.bottomRightCorner.x];
    var ys = [r.location.topLeftCorner.y, r.location.topRightCorner.y, r.location.bottomLeftCorner.y, r.location.bottomRightCorner.y];
    return { texto: r.data, caixa: { x: x + Math.min.apply(null, xs), y: y + Math.min.apply(null, ys), w: Math.max.apply(null, xs) - Math.min.apply(null, xs), h: Math.max.apply(null, ys) - Math.min.apply(null, ys) } };
  }
  function cobrir(cv, c) {
    var cx = cv.getContext('2d'), m = Math.max(c.w, c.h) * .12;
    cx.fillStyle = '#fff'; cx.fillRect(c.x - m, c.y - m, c.w + 2 * m, c.h + 2 * m);
  }
  /* jsQR (o celular sem leitor próprio): tenta tamanhos do mais rápido ao mais detalhado e PARA no primeiro que acha;
     nesse mesmo tamanho procura os outros códigos (vários cartões num print). Nada achado: recortes (QR pequeno),
     e por último cores invertidas (tela escura). */
  function lerComJsQR(src, max, lados) {
    var achados = [], vistos = {}, limite = max || 8;
    function varrer(cv, inverter) {
      for (var n = 0; n < limite; n++) { var r = jsqrEm(cv, 0, 0, cv.width, cv.height, inverter); if (!r) break; if (!vistos[r.texto]) { vistos[r.texto] = 1; achados.push(r.texto); } cobrir(cv, r.caixa); }
    }
    var tam = lados || [1000, 700, 1500];
    for (var k = 0; k < tam.length && !achados.length; k++) varrer(contrastar(paraCanvas(src, tam[k])));
    if (achados.length || lados) return achados;
    var cv = contrastar(paraCanvas(src, 1500)), w = cv.width, hh = cv.height, tw = Math.round(w * .6), th = Math.round(hh * .6);
    [[0, 0], [w - tw, 0], [0, hh - th], [w - tw, hh - th], [(w - tw) / 2, (hh - th) / 2]].forEach(function (o) {
      var r = jsqrEm(cv, Math.round(o[0]), Math.round(o[1]), tw, th); if (r && !vistos[r.texto]) { vistos[r.texto] = 1; achados.push(r.texto); cobrir(cv, r.caixa); }
    });
    if (!achados.length) varrer(contrastar(paraCanvas(src, 1000)), true);
    return achados;
  }
  /* devolve [{ texto, formato }] (sem repetidos) */
  function lerImagem(src, op) {
    op = op || {};
    return nativo().then(function (det) {
      if (!det) return [];
      return det.detect(paraCanvas(src, op.lados ? op.lados[0] : 1800)).then(function (rs) { return rs.map(function (r) { return { texto: r.rawValue, formato: r.format }; }); }).catch(function () { return []; });
    }).then(function (nat) {
      if (nat.length) return nat;   /* o leitor do próprio celular já acha todos os códigos da imagem */
      return carregarJsQR().then(function () {
        var vistos = {}; nat.forEach(function (x) { vistos[x.texto] = 1; });
        return nat.concat(lerComJsQR(src, op.max, op.lados).filter(function (t) { return !vistos[t]; }).map(function (t) { return { texto: t, formato: 'qr_code' }; }));
      }).catch(function () { return nat; });
    }).then(function (ls) { return ls.filter(function (x) { return x.texto && String(x.texto).trim(); }); });
  }
  function imagemDeBlob(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob).catch(function () { return imgTag(blob); });
    return imgTag(blob);
  }
  function imgTag(blob) {
    return new Promise(function (ok, erro) { var u = URL.createObjectURL(blob), im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { URL.revokeObjectURL(u); erro(new Error('imagem')); }; im.src = u; });
  }
  /* arquivo (ou imagem colada): { codigos:[{texto, formato}], texto, previa (dataURL), paginas, erro } */
  function lerArquivo(file) {
    var nome = String(file.name || '').toLowerCase(), tipo = String(file.type || '').toLowerCase();
    if (tipo === 'application/pdf' || /\.pdf$/.test(nome)) return lerPdf(file);
    if (/^text\//.test(tipo) || /\.(txt|eml|html?)$/.test(nome)) return file.text().then(function (t) {
      t = /\.html?$/.test(nome) || /html/.test(tipo) ? t.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ') : t;
      var linhas = t.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(function (x) { return /^M[1-4][A-Z\/ ]{10,}/.test(x); });
      return { codigos: linhas.map(function (x) { return { texto: x, formato: 'texto' }; }), texto: t };
    });
    return imagemDeBlob(file).then(function (im) {
      var previa = paraCanvas(im, 900).toDataURL('image/jpeg', .82);
      return lerImagem(im).then(function (cs) { return { codigos: cs, previa: previa }; });
    }).catch(function () { return { codigos: [], erro: 'ilegivel' }; });
  }
  function lerPdf(file) {
    return Promise.all([carregarPdf(), file.arrayBuffer()]).then(function (r) {
      return r[0].getDocument({ data: new Uint8Array(r[1]), isEvalSupported: false }).promise;
    }).then(function (doc) {
      var n = Math.min(doc.numPages, 10), todos = [], vistos = {}, previa = null, texto = '';
      function pagina(i) {
        if (i > n) return null;
        return doc.getPage(i).then(function (pg) {
          var vp = pg.getViewport({ scale: 2.2 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
          var cx = cv.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
          return pg.render({ canvasContext: cx, viewport: vp }).promise.then(function () {
            if (!previa) previa = paraCanvas(cv, 900).toDataURL('image/jpeg', .8);
            return pg.getTextContent().then(function (tc) { texto += tc.items.map(function (x) { return x.str; }).join(' ') + '\n'; }).catch(function () {});
          }).then(function () { return lerImagem(cv); }).then(function (cs) { cs.forEach(function (c) { if (!vistos[c.texto]) { vistos[c.texto] = 1; todos.push(c); } }); return pagina(i + 1); });
        });
      }
      return pagina(1).then(function () { return { codigos: todos, previa: previa, texto: texto, paginas: doc.numPages }; });
    }).catch(function (e) {
      var senha = e && (e.name === 'PasswordException' || /password/i.test(e.message || ''));
      return { codigos: [], erro: senha ? 'senha' : 'ilegivel' };
    });
  }

  /* ---------- cartão de embarque (IATA BCBP, parte obrigatória) ----------
     M1 NOME/SOBRENOME(20) E PNR(7) DE(3) PARA(3) CIA(3) VOO(5) DIA-DO-ANO(3) CLASSE(1) ASSENTO(4) SEQ(5) STATUS(1)… */
  function bcbp(txt, anoRef) {
    var t = String(txt || '');
    if (!/^M[1-4]/.test(t) || t.length < 58) return null;
    var nome = t.slice(2, 22).trim(), pnr = t.slice(23, 30).trim(), de = t.slice(30, 33), para = t.slice(33, 36);
    var cia = t.slice(36, 39).trim(), voo = t.slice(39, 44).trim().replace(/^0+/, ''), jd = +t.slice(44, 47), classe = t.slice(47, 48);
    var assento = t.slice(48, 52).trim().replace(/^0+/, ''), seq = t.slice(52, 57).trim().replace(/^0+/, '');
    if (!/^[A-Z]{3}$/.test(de) || !/^[A-Z]{3}$/.test(para) || !/^[A-Z0-9]{2,3}$/.test(cia) || !voo) return null;
    var partes = nome.split('/'), pessoa = partes.length > 1 ? (partes[1] + ' ' + partes[0]) : nome;
    pessoa = pessoa.replace(/\s+(MR|MRS|MS|MISS|MSTR|CHD|INF)$/, '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }).trim();
    var data = null;
    if (jd >= 1 && jd <= 366) {
      var ano = anoRef || new Date().getFullYear();
      var dt = new Date(Date.UTC(ano, 0, 1) + (jd - 1) * 86400000);
      data = dt.toISOString().slice(0, 10);
    }
    return { pessoa: pessoa, localizador: pnr, de: de, para: para, cia: cia, voo: voo, data: data, classe: classe, assento: assento, seq: seq };
  }

  window.Codigos = { lerImagem: lerImagem, lerArquivo: lerArquivo, bcbp: bcbp, nativo: nativo, paraCanvas: paraCanvas };
})();
