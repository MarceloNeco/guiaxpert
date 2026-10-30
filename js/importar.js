/* =====================================================================
   importar.js — e-mail de reserva vira reserva (como o TripIt, sem ler
   a caixa de entrada)

   A pessoa compartilha o e-mail com o app (Android: "Compartilhar" →
   GuiaXpert) ou cola o texto. Tudo é lido AQUI no aparelho:
   - por regras (Azul, GOL, LATAM, Booking, Airbnb, Localiza, Movida,
     Decolar e padrões gerais: localizador, voo, datas, check-in);
   - com a chave de IA da pessoa, qualquer e-mail (sem nomes: o texto
     vai inteiro, então a pessoa é avisada e confirma antes).
   Só grava no cofre depois que a pessoa aceita cada reserva encontrada.
   ===================================================================== */
(function () {
  'use strict';
  var MESES = { jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12 };

  function limpar(t) { return String(t || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n'); }
  function iso(ano, mes, dia) { return ano + '-' + ('0' + mes).slice(-2) + '-' + ('0' + dia).slice(-2); }
  /* datas: 18/11/2026, 18/11, 18 de novembro de 2026, 18 nov 2026, 2026-11-18, Nov 18, 2026 */
  function datas(t, anoPadrao) {
    var out = [], m, re;
    re = /(\d{4})-(\d{2})-(\d{2})/g; while ((m = re.exec(t))) out.push({ i: m.index, d: m[1] + '-' + m[2] + '-' + m[3] });
    re = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g; while ((m = re.exec(t))) { var a = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : anoPadrao; if (+m[2] <= 12 && +m[1] <= 31) out.push({ i: m.index, d: iso(a, +m[2], +m[1]) }); }
    re = /\b(\d{1,2})\s*(?:de\s+)?([a-zç]{3})[a-zç]*\.?\s*(?:de\s+)?(\d{4})?/gi; while ((m = re.exec(t))) { var mm = MESES[m[2].toLowerCase().slice(0, 3)]; if (mm) out.push({ i: m.index, d: iso(m[3] || anoPadrao, mm, +m[1]) }); }
    re = /\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/g; while ((m = re.exec(t))) { var m2 = MESES[m[1].toLowerCase()]; if (m2) out.push({ i: m.index, d: iso(m[3], m2, +m[2]) }); }
    return out.sort(function (a, b) { return a.i - b.i; });
  }
  function horas(t) { var out = [], m, re = /\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/g; while ((m = re.exec(t))) out.push({ i: m.index, h: ('0' + m[1]).slice(-2) + ':' + m[2] }); return out; }
  function perto(lista, i, max) { var best = null; lista.forEach(function (x) { var d = Math.abs(x.i - i); if (d <= (max || 400) && (!best || d < best.d)) best = { d: d, v: x }; }); return best && best.v; }
  function codigo(t) {
    var m = t.match(/(?:localizador|c[oó]digo (?:da |de )?(?:reserva|confirma[çc][aã]o)|n[uú]mero (?:da |de )?(?:reserva|confirma[çc][aã]o)|confirmation (?:number|code)|booking (?:number|reference)|reservation (?:number|code)|PNR|record locator|reference)\s*[:#nº°.]*\s*([A-Z0-9]{5,12})/i);
    return m ? m[1].toUpperCase() : null;
  }

  var Importar = {
    /* devolve candidatos { tipo, titulo, quando, codigo, local, nota, fonte } */
    porRegras: function (texto) {
      var t = limpar(texto), out = [], ano = String(new Date().getFullYear());
      var ds = datas(t, ano), hs = horas(t), cod = codigo(t);
      var baixo = t.toLowerCase();
      /* voos: companhia + número */
      var cia = /\b(azul|gol|latam|tap|american|united|delta|air france|klm|lufthansa|iberia|avianca|copa|emirates|ryanair|easyjet)\b/i.exec(t);
      var re = /\b(AD|G3|LA|JJ|TP|AA|UA|DL|AF|KL|LH|IB|AV|CM|EK|FR|U2)\s?(\d{3,4})\b/g, m, vistos = {};
      while ((m = re.exec(t))) {
        var num = m[1] + ' ' + m[2]; if (vistos[num]) continue; vistos[num] = 1;
        var d = perto(ds, m.index), h = perto(hs, m.index, 250);
        var trecho = t.slice(Math.max(0, m.index - 150), m.index + 200);
        var rota = /\(([A-Z]{3})\)[^\n]{0,40}?\(([A-Z]{3})\)/.exec(trecho) || /\b([A-Z]{3})\s*(?:→|->|-|–|para|to|a)\s*([A-Z]{3})\b/.exec(trecho);
        out.push({ tipo: 'voo', titulo: 'Voo ' + (cia ? cia[1].charAt(0).toUpperCase() + cia[1].slice(1).toLowerCase() + ' ' : '') + num + (rota ? ' ' + rota[1] + ' → ' + rota[2] : ''),
          quando: d ? d.d + (h ? 'T' + h.h : '') : '', codigo: cod, local: rota ? rota[1] : '', nota: '', fonte: 'regras' });
      }
      /* hotel: check-in / check-out */
      if (/check-?in/i.test(baixo) && /(hotel|pousada|hostel|booking|airbnb|resort|inn\b)/i.test(baixo)) {
        var ci = /check-?in[^0-9]{0,40}/i.exec(t), co = /check-?out[^0-9]{0,40}/i.exec(t);
        var dIn = ci && perto(ds, ci.index + ci[0].length, 60), dOut = co && perto(ds, co.index + co[0].length, 60);
        var nome = /\b(?:hotel|pousada|hostel|resort)\s+[A-ZÀ-Ú][\wÀ-ú'&.\- ]{2,40}/i.exec(t);
        var end = /(?:endere[çc]o|address)\s*[:\-]?\s*([^\n]{8,120})/i.exec(t);
        out.push({ tipo: 'hotel', titulo: nome ? nome[0].trim() : (/(airbnb)/i.test(t) ? 'Airbnb' : 'Hotel'), quando: dIn ? dIn.d + 'T14:00' : '', codigo: cod,
          local: end ? end[1].trim() : '', nota: (dIn ? 'Check-in ' + dIn.d.split('-').reverse().join('/') : '') + (dOut ? ' · Check-out ' + dOut.d.split('-').reverse().join('/') : ''), fonte: 'regras' });
      }
      /* carro: locadora + retirada */
      var loc = /\b(localiza|movida|unidas|hertz|avis|sixt|europcar|budget|foco|alamo|enterprise)\b/i.exec(t);
      if (loc && /(retirada|pick-?up|devolu|return|drop-?off|loca[çc][aã]o|rental)/i.test(baixo)) {
        var ret = /(retirada|pick-?up)[^0-9]{0,60}/i.exec(t), dev = /(devolu[çc][aã]o|return|drop-?off)[^0-9]{0,60}/i.exec(t);
        var dR = ret && perto(ds, ret.index + ret[0].length, 80), hR = ret && perto(hs, ret.index + ret[0].length, 120), dD = dev && perto(ds, dev.index + dev[0].length, 80);
        var lugar = /(?:loja|agência|agencia|local de retirada|pick-?up location)\s*[:\-]?\s*([^\n]{6,100})/i.exec(t);
        out.push({ tipo: 'carro', titulo: 'Carro ' + loc[1].charAt(0).toUpperCase() + loc[1].slice(1).toLowerCase(), quando: dR ? dR.d + (hR ? 'T' + hR.h : '') : '', codigo: cod,
          local: lugar ? lugar[1].trim() : '', nota: dD ? 'Devolução ' + dD.d.split('-').reverse().join('/') : '', fonte: 'regras' });
      }
      /* ingresso / restaurante: só se nada acima e houver código */
      if (!out.length && cod) {
        var ing = /(ingresso|ticket|entrada|parque|show|espet[aá]culo)/i.test(baixo), rest = /(restaurante|mesa|reserva de mesa|jantar|almo[çc]o)/i.test(baixo);
        var ass = /^(?:assunto|subject)\s*:\s*(.+)$/im.exec(t);
        out.push({ tipo: ing ? 'ingresso' : rest ? 'restaurante' : 'outro', titulo: ass ? ass[1].trim().slice(0, 80) : (ing ? 'Ingresso' : rest ? 'Restaurante' : 'Reserva'),
          quando: ds[0] ? ds[0].d + (hs[0] ? 'T' + hs[0].h : '') : '', codigo: cod, local: '', nota: '', fonte: 'regras' });
      }
      return out;
    },

    /* com a IA da pessoa: devolve a mesma lista; o texto inteiro vai para a IA (a pessoa confirma antes) */
    porIA: function (texto, idioma) {
      if (!window.DGO || !DGO.ia || !DGO.ia.provedoresProntos || !DGO.ia.provedoresProntos().length) return Promise.reject(new Error('sem-ia'));
      var pergunta = 'Extraia as reservas deste e-mail. Responda SÓ com JSON: {"reservas":[{"tipo":"voo|hotel|carro|ingresso|restaurante|outro","titulo":"…","quando":"AAAA-MM-DDTHH:MM ou AAAA-MM-DD","codigo":"localizador ou código","local":"endereço ou aeroporto","nota":"check-out, devolução, observações curtas"}]}. ' +
        'Não invente: campo desconhecido fica "". Títulos curtos em ' + (idioma === 'en' ? 'inglês' : 'português') + '.\n\nE-MAIL:\n' + limpar(texto).slice(0, 12000);
      return DGO.ia.perguntar(pergunta, { contexto: 'Você lê e-mails de confirmação de viagem e devolve só JSON.', limite: 2000 }).then(function (txt) {
        var i = txt.indexOf('{'), f = txt.lastIndexOf('}');
        if (i < 0 || f < i) throw new Error('ia-formato');
        var j = JSON.parse(txt.slice(i, f + 1));
        return (j.reservas || []).filter(function (r) { return r && r.titulo; }).map(function (r) {
          return { tipo: ['voo', 'hotel', 'carro', 'ingresso', 'restaurante'].indexOf(r.tipo) > -1 ? r.tipo : 'outro', titulo: String(r.titulo).slice(0, 100), quando: String(r.quando || '').slice(0, 16),
            codigo: String(r.codigo || '').slice(0, 40), local: String(r.local || '').slice(0, 160), nota: String(r.nota || '').slice(0, 500), fonte: 'ia' };
        });
      });
    },

    /* texto chegou por "Compartilhar" (manifest share_target, GET) */
    doEndereco: function () {
      var q = new URLSearchParams(location.search);
      var t = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n');
      if (!t) return null;
      history.replaceState(null, '', location.pathname + (location.hash || ''));
      return t;
    }
  };

  window.Importar = Importar;
})();
