/* =====================================================================
   montador.js — monta um roteiro SEM IA, só com regras (pedido do dono,
   20/Nov/2026: "o Guia precisa montar sozinho").

   Entrada: os dias da viagem, os lugares que o app conhece (guia pronto,
   Wikivoyage, Wikidata, OpenStreetMap, lugares guardados) e o ponto de
   partida (hotel ou centro do destino).
   Regras:
   - quantos programas por dia vem do ritmo (tranquilo 2, equilibrado 3,
     intenso 4); dia de chegada e de ida embora são mais curtos;
   - escolhe os melhores (gosto do grupo, fonte confiável, fama, criança);
   - junta no mesmo dia o que fica perto (grupos por distância);
   - em cada dia, a ordem é a de quem sai do hotel e vai ao mais perto;
   - horários pela duração típica + tempo de carro; almoço perto do
     programa da hora, jantar perto do hotel;
   - nunca repete lugar. Tudo no aparelho.
   ===================================================================== */
(function () {
  'use strict';
  var R = 6371;
  function km(a, b) {
    var dLa = (b.lat - a.lat) * Math.PI / 180, dLo = (b.lng - a.lng) * Math.PI / 180;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function hm(min) { min = Math.round(min / 5) * 5; var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
  var POR_DIA = { tranquilo: 2, leve: 2, equilibrado: 3, intenso: 4 };

  function montar(op) {
    var dias = op.dias || [], n = dias.length, base = op.base;
    if (!n || !base) return { dias: [], usados: [] };
    var per = POR_DIA[op.ritmo] || 3;
    var cap = dias.map(function (d, i) { return n === 1 ? per : (i === 0 || i === n - 1) ? Math.max(1, per - 2) : per; });
    var carro = op.carro || function (k) { return Math.max(5, Math.round(k * 2.2)); };
    var dur = op.duracao || function () { return null; };
    var ok = function (l) { return l && l.lat != null && l.lng != null && km(base, l) <= (op.raioKm || 45); };
    var vistos = {};
    var lugares = (op.lugares || []).filter(function (l) {
      if (!ok(l)) return false;
      var k = String(l.nome || '').toLowerCase().replace(/\s+/g, ' ').trim(); if (!k || vistos[k]) return false; vistos[k] = 1; return true;
    });
    var atr = lugares.filter(function (l) { return l.categoria === 'atracao'; });
    var comer = lugares.filter(function (l) { return l.categoria === 'comer'; });
    /* nota de cada atração: gosto do grupo, fonte, fama (ordem em que veio), criança */
    atr.forEach(function (l, i) {
      var s = 1 + (1 - i / Math.max(1, atr.length)) * 0.8;
      if (op.gosto) s += 2 * (op.gosto(l) || 0);
      if (l.confianca === 'oficial') s += 1; else if (l.confianca === 'guia') s += 0.5;
      if (op.comCriancas && /ótimo|otimo|crian|kids|infantil/i.test(String(l.criancas || '') + ' ' + String(l.descricao || ''))) s += 1;
      if (op.evitar && op.evitar[l.id]) s -= 10;
      l._s = s;
    });
    var total = cap.reduce(function (a, b) { return a + b; }, 0);
    var escolhidos = atr.slice().sort(function (a, b) { return b._s - a._s; }).slice(0, total);
    var k = Math.min(n, escolhidos.length);
    /* sementes afastadas entre si (uma por dia), as perto do hotel ficam para os dias curtos */
    var sementes = [];
    if (k) sementes.push({ lat: escolhidos[0].lat, lng: escolhidos[0].lng });
    while (sementes.length < k) {
      var melhor = null, mv = -1;
      escolhidos.forEach(function (l) { var d = Math.min.apply(null, sementes.map(function (s) { return km(s, l); })); var v = d * (0.5 + l._s / 4); if (v > mv) { mv = v; melhor = l; } });
      sementes.push({ lat: melhor.lat, lng: melhor.lng });
    }
    var ordemDias = dias.map(function (d, i) { return i; }).sort(function (a, b) { return cap[a] - cap[b]; });
    sementes.sort(function (a, b) { return km(base, a) - km(base, b); });
    var semDia = []; ordemDias.forEach(function (di, j) { semDia[di] = sementes[j] || base; });
    var grupos;
    for (var volta = 0; volta < 3; volta++) {
      grupos = dias.map(function () { return []; });
      var resta = cap.slice();
      escolhidos.forEach(function (l) {
        var opcoes = dias.map(function (d, i) { return i; }).filter(function (i) { return resta[i] > 0; });
        if (!opcoes.length) return;
        opcoes.sort(function (a, b) { return km(semDia[a], l) - km(semDia[b], l); });
        grupos[opcoes[0]].push(l); resta[opcoes[0]]--;
      });
      grupos.forEach(function (g, i) {
        if (!g.length) return;
        semDia[i] = { lat: g.reduce(function (a, l) { return a + l.lat; }, 0) / g.length, lng: g.reduce(function (a, l) { return a + l.lng; }, 0) / g.length };
      });
    }
    var usadosComer = {}, usados = [];
    function comerPerto(p, raio) {
      var c = comer.filter(function (l) { return !usadosComer[l.id]; }).sort(function (a, b) { return km(p, a) - km(p, b); })[0];
      return c && km(p, c) <= (raio || 5) ? c : null;
    }
    var saida = grupos.map(function (g, i) {
      /* ordem: do hotel ao mais perto, depois ao mais perto do anterior */
      var resto = g.slice(), ordem = [], atual = base;
      while (resto.length) { resto.sort(function (a, b) { return km(atual, a) - km(atual, b); }); atual = resto.shift(); ordem.push(atual); }
      var chegada = n > 1 && i === 0, partida = n > 1 && i === n - 1;
      var t = chegada ? 14 * 60 : (op.ritmo === 'tranquilo' || op.ritmo === 'leve') ? 10 * 60 : 9 * 60 + 30;
      var itens = [], prev = base, almocou = chegada;
      ordem.forEach(function (l, j) {
        var d = km(prev, l); t += d > 0.3 ? carro(d) : 0;
        if (!almocou && t >= 12 * 60) {
          var c = comerPerto(prev, 5);
          var hA = Math.max(t, 12 * 60);
          itens.push({ hora: hm(hA), fim: hm(hA + 75), titulo: c ? op.textos.almoco + ': ' + c.nome : op.textos.almoco + (prev !== base && prev.nome ? ' · ' + op.textos.perto + ' ' + prev.nome : ''), lugarId: c ? c.id : null, nota: null });
          if (c) { usadosComer[c.id] = 1; usados.push(c); prev = c; }
          t = hA + 75; almocou = true; d = km(prev, l); t += d > 0.3 ? carro(d) : 0;
        }
        if (partida && t > 13 * 60) return;
        var m = dur(l) || (l.categoria === 'atracao' ? 90 : 60);
        itens.push({ hora: hm(t), fim: hm(t + m), titulo: l.nome, lugarId: l.id, nota: null });
        usados.push(l); t += m; prev = l;
      });
      if (!almocou && !partida && itens.length) {
        var c2 = comerPerto(prev, 5), hA2 = Math.max(t, 12 * 60);
        if (hA2 < 15 * 60) { itens.push({ hora: hm(hA2), fim: hm(hA2 + 75), titulo: c2 ? op.textos.almoco + ': ' + c2.nome : op.textos.almoco + (prev !== base && prev.nome ? ' · ' + op.textos.perto + ' ' + prev.nome : ''), lugarId: c2 ? c2.id : null, nota: null }); if (c2) { usadosComer[c2.id] = 1; usados.push(c2); } }
      }
      if (!partida && comer.length) {
        var j2 = comerPerto(base, 6);
        if (j2) { itens.push({ hora: '19:30', fim: '21:00', titulo: op.textos.jantar + ': ' + j2.nome, lugarId: j2.id, nota: null }); usadosComer[j2.id] = 1; usados.push(j2); }
      }
      itens.sort(function (a, b) { return a.hora < b.hora ? -1 : 1; });
      return { itens: itens };
    });
    return { dias: saida, usados: usados };
  }

  window.Montador = { montar: montar, _km: km };
})();
