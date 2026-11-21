/* =====================================================================
   ajuda-busca.js — o "cérebro" das respostas do AssistONE, sem internet e sem IA
   (pedido do dono, 21/Nov/2026). O personagem e o balão são o AssistONE oficial da
   plataforma (assistone.js, cópia do master do RootifyONE); este arquivo só acha a resposta.

   Entende uma pergunta digitada ou falada e sugere a resposta pelas
   palavras-chave, tolerando:
   - falta de acento e maiúsculas ("remarcacao" = "Remarcação");
   - erro de digitação (uma ou duas letras trocadas em palavras maiores);
   - outros tempos e formas do verbo ("remarco", "remarquei", "remarcar",
     "remarcando" → "remarc"), plural e diminutivo simples.
   Tudo no aparelho. A IA, quando existir, é só uma opção a mais.

   Uso: var m = AssistBusca.motor([{ id, chaves: ['remarcar', 'mudar data'], ... }]);
        m.buscar('como remarco o ingresso?') → [{ item, nota }] (melhores primeiro)
   Feito para ser levado aos outros apps da plataforma (componente comum).
   ===================================================================== */
(function () {
  'use strict';
  var VAZIAS = ('a o e as os um uma uns umas de do da dos das no na nos nas em ao aos para pra pro por com sem que qual quais quando onde como ' +
    'eu meu minha meus minhas me mim voce vc seu sua isso esse essa este esta aqui la ai tem ter tenho ha e ou se ja nao sim mais muito ' +
    'faco fazer faz posso pode consigo quero queria gostaria preciso precisa the to of in on at for how do i my is it can what where when').split(' ');
  var VZ = {}; VAZIAS.forEach(function (w) { VZ[w] = 1; });
  /* algumas formas irregulares viram a mesma raiz */
  var TROCAS = { agenda: 'agenda', agendas: 'agenda', remarquei: 'remarc', marquei: 'marc', fiquei: 'fic', cheguei: 'cheg', paguei: 'pag', apaguei: 'apag', liguei: 'lig', expliquei: 'explic', coloquei: 'coloc', toquei: 'toc', busquei: 'busc', choveu: 'chov', chove: 'chov', chuva: 'chuv', chuvoso: 'chuv', qr: 'qrcod', qrcode: 'qrcod' };
  var SUF = ['amentos', 'imentos', 'amento', 'imento', 'acoes', 'icoes', 'acao', 'icao', 'zinhos', 'zinhas', 'zinho', 'zinha', 'inhos', 'inhas', 'inho', 'inha',
    'ariam', 'eriam', 'iriam', 'aram', 'eram', 'iram', 'avam', 'iam', 'ando', 'endo', 'indo', 'aria', 'eria', 'iria', 'aste', 'este', 'iste',
    'amos', 'emos', 'imos', 'ados', 'idos', 'adas', 'idas', 'ado', 'ido', 'ada', 'ida', 'ava', 'ara', 'era', 'ira', 'ar', 'er', 'ir', 'ou', 'eu', 'iu', 'ei', 'ai', 'oes', 'aes',
    'es', 'as', 'os', 'am', 'em', 'a', 'e', 'o', 's', 'i'];
  function semAcento(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  /* mesma ideia, palavras diferentes (verbo, substantivo, sinônimo, inglês): todas viram uma raiz só.
     [raiz comum, raízes exatas, começos] — ex.: reagendar, reagendamento, remarcação, adiar → "remarc" */
  var SINON = [
    ['remarc', ['adiar', 'adie', 'adi', 'reschedul'], ['reagend', 'remarc', 'reprogram', 'adiament', 'postergu', 'posterg', 'reschedul']],
    ['cancel', ['anul', 'desist'], ['cancel', 'desmarc', 'desistenci', 'anulac']],
    ['reembols', ['refund'], ['reembols', 'estorn', 'devoluc', 'devolv', 'ressarc']],
    ['reserv', ['marc', 'bok', 'boking', 'boked'], ['reserv', 'agend', 'marcac']],
    ['compr', ['pag', 'pagar', 'pago', 'paga', 'comp', 'buy', 'bought', 'paid'], ['compr', 'adquir', 'aquisica', 'pagament', 'purchas']],
    ['ingress', ['ticket', 'tickets', 'vouch'], ['ingress', 'bilhet', 'passaport']]
  ];
  var SIN_EXATA = { agenda: 'agenda' }, SIN_INICIO = [];   /* "agenda de hoje" é a programação, não um agendamento */
  SINON.forEach(function (g) { g[1].forEach(function (w) { SIN_EXATA[w] = g[0]; }); g[2].forEach(function (p) { SIN_INICIO.push([p, g[0]]); }); });
  function comum(w) {
    if (SIN_EXATA[w]) return SIN_EXATA[w];
    for (var i = 0; i < SIN_INICIO.length; i++) if (w.indexOf(SIN_INICIO[i][0]) === 0) return SIN_INICIO[i][1];
    /* com erro de digitação ("reagnedar", "resevar", "cancelr"): uma letra a mais, a menos, trocada ou invertida */
    /* só palavras do tamanho da raiz: "compartilhar" não é erro de "comprar" */
    if (w.length >= 5) for (var j = 0; j < SIN_INICIO.length; j++) { var p = SIN_INICIO[j][0]; if (p.length < 5 || w.length > p.length + 2) continue; if (dist(w.slice(0, p.length + 1), p, 1) <= 1 || dist(w.slice(0, p.length), p, 1) <= 1) return SIN_INICIO[j][1]; }
    return w;
  }
  function raiz(w) {
    if (TROCAS[w]) return TROCAS[w];
    if (w.length <= 3) return w;
    for (var i = 0; i < SUF.length; i++) {
      var s = SUF[i];
      if (w.length - s.length >= 4 && w.slice(-s.length) === s) { w = w.slice(0, -s.length); break; }
    }
    /* "remarque" (subjuntivo) → "remarc"; "cancel" ok */
    return w.replace(/qu$/, 'c').replace(/gu$/, 'g').replace(/c$/, 'c');
  }
  function palavras(t) {
    /* letras dobradas ("cancellar", "comprra") contam uma vez; z vira s ("rezerva") */
    return semAcento(t).replace(/[^a-z0-9\s]/g, ' ').replace(/([a-z])\1+/g, '$1').replace(/z/g, 's')
      .split(/\s+/).filter(function (w) { return w && !VZ[w]; }).map(raiz).map(comum).filter(function (w) { return w.length >= 2; });
  }
  /* distância de edição; duas letras invertidas ("agned" × "agend") contam como um erro só */
  function dist(a, b, lim) {
    if (Math.abs(a.length - b.length) > lim) return lim + 1;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      var menor = Infinity;
      for (j = 1; j <= b.length; j++) {
        var c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        if (d[i][j] < menor) menor = d[i][j];
      }
      if (menor > lim) return lim + 1;
    }
    return d[a.length][b.length];
  }
  /* quão parecidas são duas raízes: 1 igual; .85 uma começa com a outra; .7 com um erro de digitação; 0 nada */
  function parecido(a, b) {
    if (a === b) return 1;
    if (a.length >= 4 && b.length >= 4 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return 0.85;
    var lim = Math.min(a.length, b.length) >= 8 ? 2 : Math.min(a.length, b.length) >= 5 ? 1 : 0;
    return lim && dist(a, b, lim) <= lim ? 0.7 : 0;
  }
  function motor(itens) {
    var base = itens.map(function (it) {
      return { item: it, frases: (it.chaves || []).map(function (c) { return palavras(c); }).filter(function (f) { return f.length; }) };
    });
    return {
      buscar: function (pergunta, max) {
        var q = palavras(pergunta);
        if (!q.length) return [];
        var res = base.map(function (b) {
          var melhor = 0;
          b.frases.forEach(function (f) {
            /* cada palavra da chave procura a melhor parecida na pergunta; frase inteira presente vale mais */
            var soma = 0;
            f.forEach(function (w) { var m = 0; q.forEach(function (x) { var p = parecido(w, x); if (p > m) m = p; }); soma += m; });
            var cobre = soma / f.length, nota = cobre * (0.6 + 0.4 * Math.min(1, f.length / 2));
            if (cobre >= 0.99 && f.length > 1) nota += 0.3;
            if (nota > melhor) melhor = nota;
          });
          /* desempate: quantas palavras da pergunta esta resposta cobre (por qualquer chave) */
          var todas = [].concat.apply([], b.frases), cobertas = q.filter(function (x) { return todas.some(function (w) { return parecido(w, x) >= 0.7; }); }).length;
          if (melhor) melhor += 0.25 * cobertas / q.length;
          return { item: b.item, nota: melhor };
        }).filter(function (r) { return r.nota >= 0.55; }).sort(function (a, b) { return b.nota - a.nota; });
        return res.slice(0, max || 3);
      }
    };
  }
  window.AssistBusca = { motor: motor, _palavras: palavras, _raiz: raiz, _dist: dist };
})();
