/* =====================================================================
   barras.js — desenha código de barras (ingresso, voucher) em SVG,
   sem biblioteca de fora e sem internet.
   Formatos: CODE128 (o mais comum em voucher) e ITF (2 de 5 intercalado,
   só números). Barras.svg(texto, formato) devolve o texto do SVG.
   ===================================================================== */
(function () {
  'use strict';
  /* larguras das barras/espaços de cada símbolo do Code 128 (padrão ISO/IEC 15417) */
  var C128 = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];

  function code128(t) {
    var s = String(t), cod = [];
    var soDigitos = /^\d+$/.test(s) && s.length % 2 === 0 && s.length >= 4;
    if (soDigitos) {                       /* conjunto C: dois dígitos por símbolo (mais curto) */
      cod.push(105);
      for (var i = 0; i < s.length; i += 2) cod.push(+s.substr(i, 2));
    } else {                               /* conjunto B: letras, números e sinais */
      cod.push(104);
      for (var j = 0; j < s.length; j++) { var c = s.charCodeAt(j); if (c < 32 || c > 127) throw new Error('caractere'); cod.push(c - 32); }
    }
    var soma = cod[0];
    for (var k = 1; k < cod.length; k++) soma += cod[k] * k;
    cod.push(soma % 103); cod.push(106);
    return cod.map(function (n) { return C128[n]; }).join('');   /* larguras alternando barra, espaço, barra… */
  }
  /* ITF: dígitos em pares; um vai nas barras, o outro nos espaços */
  var ITF = { 0: 'nnwwn', 1: 'wnnnw', 2: 'nwnnw', 3: 'wwnnn', 4: 'nnwnw', 5: 'wnwnn', 6: 'nwwnn', 7: 'nnnww', 8: 'wnnwn', 9: 'nwnwn' };
  function itf(t) {
    var s = String(t).replace(/\D/g, ''); if (s.length % 2) s = '0' + s;
    var w = '1111';                        /* início: barra fina, espaço fino, barra fina, espaço fino */
    for (var i = 0; i < s.length; i += 2) {
      var a = ITF[s[i]], b = ITF[s[i + 1]];
      for (var k = 0; k < 5; k++) w += (a[k] === 'w' ? '3' : '1') + (b[k] === 'w' ? '3' : '1');
    }
    return w + '311';                      /* fim: barra larga, espaço fino, barra fina */
  }

  var Barras = {
    svg: function (texto, formato) {
      var larguras = String(formato || '').toUpperCase() === 'ITF' ? itf(texto) : code128(texto);
      var x = 10, alt = 90, barras = '';
      for (var i = 0; i < larguras.length; i++) {
        var w = +larguras[i];
        if (i % 2 === 0) barras += '<rect x="' + x + '" y="0" width="' + w + '" height="' + alt + '"/>';
        x += w;
      }
      var total = x + 10;
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + alt + '" preserveAspectRatio="none" shape-rendering="crispEdges">' +
        '<rect width="' + total + '" height="' + alt + '" fill="#fff"/><g fill="#000">' + barras + '</g></svg>';
    }
  };
  window.Barras = Barras;
})();
