/* =====================================================================
   clima.js — previsão do tempo, sem chave e sem cadastro
   Tenta, nesta ordem, até um responder:
     1) Open-Meteo   (16 dias, chance de chuva)
     2) MET Norway   (10 dias, instituto de meteorologia da Noruega, mundo todo)
     3) wttr.in      (3 dias)
   Cada serviço é transformado no mesmo formato de dia:
     { data:'AAAA-MM-DD', codigo (WMO), max, min, chuva (%), vento (km/h) }
   Guarda a última previsão por 1 h no aparelho; sem internet, mostra a
   guardada. Só a coordenada do destino vai para o serviço (nunca a da
   pessoa sem ela pedir). Avisos: chuva, frio, calor, vento.
   ===================================================================== */
(function () {
  'use strict';
  var CODIGOS = { 0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️', 45: '🌫', 48: '🌫', 51: '🌦', 53: '🌦', 55: '🌧', 61: '🌦', 63: '🌧', 65: '🌧', 71: '🌨', 73: '🌨', 75: '❄️', 80: '🌦', 81: '🌧', 82: '⛈', 95: '⛈', 96: '⛈', 99: '⛈' };
  var TEMPO_LIMITE = 9000;

  function buscar(u) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, TEMPO_LIMITE) : null;
    return fetch(u, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }, function (e) { if (t) clearTimeout(t); throw e; });
  }
  function maisFrequente(lista) {
    var n = {}, melhor = null;
    lista.forEach(function (x) { n[x] = (n[x] || 0) + 1; if (melhor == null || n[x] > n[melhor]) melhor = x; });
    return melhor;
  }
  function pior(lista) { return lista.reduce(function (a, b) { return Math.max(a, b); }, 0); }

  /* ---------- 1) Open-Meteo ---------- */
  function openMeteo(lat, lng) {
    return buscar('https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(3) + '&longitude=' + lng.toFixed(3) +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max' +
      '&timezone=auto&forecast_days=16').then(function (j) {
      var d = j.daily || {};
      return (d.time || []).map(function (data, i) {
        return { data: data, codigo: d.weather_code[i], max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]),
                 chuva: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
                 vento: d.wind_speed_10m_max ? Math.round(d.wind_speed_10m_max[i]) : null };
      });
    });
  }

  /* ---------- 2) MET Norway ---------- */
  function codigoMet(s) {
    s = String(s || '').replace(/_(day|night|polartwilight)$/, '');
    if (/thunder/.test(s)) return 95;
    if (/snow|sleet/.test(s)) return /heavy/.test(s) ? 75 : 71;
    if (/rain/.test(s)) return /heavy/.test(s) ? 65 : /light/.test(s) ? (/showers/.test(s) ? 80 : 61) : (/showers/.test(s) ? 81 : 63);
    if (s === 'fog') return 45;
    if (s === 'cloudy') return 3;
    if (s === 'partlycloudy') return 2;
    if (s === 'fair') return 1;
    if (s === 'clearsky') return 0;
    return 3;
  }
  /* a MET manda chuva em mm, não em %; vira uma chance aproximada */
  function chanceDeMm(mm) { return mm >= 5 ? 85 : mm >= 2 ? 70 : mm >= 0.5 ? 50 : mm > 0 ? 30 : 5; }
  function metNorway(lat, lng) {
    /* hora local aproximada pelo fuso solar (a MET responde em UTC) */
    var fuso = Math.round(lng / 15) * 3600 * 1000;
    return buscar('https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=' + lat.toFixed(4) + '&lon=' + lng.toFixed(4)).then(function (j) {
      var porDia = {};
      (j.properties && j.properties.timeseries || []).forEach(function (p) {
        var dia = new Date(Date.parse(p.time) + fuso).toISOString().slice(0, 10), x = p.data || {};
        var g = porDia[dia] || (porDia[dia] = { temps: [], cods: [], mm: 0, vento: [], prob: [] });
        var det = x.instant && x.instant.details || {};
        if (det.air_temperature != null) g.temps.push(det.air_temperature);
        if (det.wind_speed != null) g.vento.push(det.wind_speed * 3.6);
        var bloco = x.next_1_hours || x.next_6_hours;
        if (bloco) {
          if (bloco.summary) g.cods.push(codigoMet(bloco.summary.symbol_code));
          if (bloco.details && bloco.details.precipitation_amount != null) g.mm += bloco.details.precipitation_amount;
          if (bloco.details && bloco.details.probability_of_precipitation != null) g.prob.push(bloco.details.probability_of_precipitation);
        }
      });
      return Object.keys(porDia).sort().filter(function (k) { return porDia[k].temps.length; }).map(function (k) {
        var g = porDia[k], chuvoso = g.cods.filter(function (c) { return c >= 51; });
        return { data: k,
                 codigo: chuvoso.length >= g.cods.length / 3 && chuvoso.length ? pior(chuvoso) : maisFrequente(g.cods),
                 max: Math.round(Math.max.apply(null, g.temps)), min: Math.round(Math.min.apply(null, g.temps)),
                 chuva: g.prob.length ? Math.round(pior(g.prob)) : chanceDeMm(g.mm),
                 vento: g.vento.length ? Math.round(pior(g.vento)) : null };
      });
    });
  }

  /* ---------- 3) wttr.in ---------- */
  var WWO = { 113: 0, 116: 2, 119: 3, 122: 3, 143: 45, 248: 45, 260: 45, 176: 80, 263: 51, 266: 53, 293: 61, 296: 61, 299: 63, 302: 63,
              305: 65, 308: 65, 353: 80, 356: 81, 359: 82, 200: 95, 386: 95, 389: 95, 392: 95, 395: 75 };
  function codigoWwo(c) { c = +c; return WWO[c] != null ? WWO[c] : (c >= 179 && c <= 377 ? 71 : 3); }
  function wttr(lat, lng) {
    return buscar('https://wttr.in/' + lat.toFixed(3) + ',' + lng.toFixed(3) + '?format=j1').then(function (j) {
      return (j.weather || []).map(function (w) {
        var hs = w.hourly || [], cods = hs.map(function (x) { return codigoWwo(x.weatherCode); }), chuvoso = cods.filter(function (c) { return c >= 51; });
        return { data: w.date,
                 codigo: chuvoso.length >= cods.length / 3 && chuvoso.length ? pior(chuvoso) : maisFrequente(cods),
                 max: Math.round(+w.maxtempC), min: Math.round(+w.mintempC),
                 chuva: hs.length ? pior(hs.map(function (x) { return +x.chanceofrain || 0; })) : null,
                 vento: hs.length ? pior(hs.map(function (x) { return +x.windspeedKmph || 0; })) : null };
      });
    });
  }

  var FONTES = [
    { nome: 'Open-Meteo', ir: openMeteo },
    { nome: 'MET Norway', ir: metNorway },
    { nome: 'wttr.in', ir: wttr }
  ];
  function tentar(i, lat, lng) {
    if (i >= FONTES.length) return Promise.reject(new Error('sem-clima'));
    return FONTES[i].ir(lat, lng).then(function (dias) {
      if (!dias || !dias.length) throw new Error('vazio');
      return { em: Date.now(), dias: dias, fonte: FONTES[i].nome };
    }).catch(function () { return tentar(i + 1, lat, lng); });
  }

  var Clima = {
    icone: function (c) { return CODIGOS[c] || '🌡'; },

    previsao: function (lat, lng) {
      var chave = 'clima:' + lat.toFixed(2) + ',' + lng.toFixed(2);
      return Banco.meta(chave, null).then(function (g) {
        if (g && Date.now() - g.em < 3600 * 1000) return g;
        return tentar(0, lat, lng).then(function (res) {
          Banco.definirMeta(chave, res);
          return res;
        }).catch(function () {
          if (g) { g.antiga = true; return g; }
          throw new Error('sem-clima');
        });
      });
    },

    /* previsão completa no Google (o mesmo cartão de tempo do celular); só abre com toque */
    linkCompleto: function (nome) {
      return 'https://www.google.com/search?q=' + encodeURIComponent('previsão do tempo ' + (nome || ''));
    },

    /* avisos práticos de um dia (textos em textos.js) */
    /* sens = { calor, frio }: alguém do grupo sente mais → avisa antes */
    avisos: function (dia, sens) {
      var a = [];
      if (!dia) return a;
      sens = sens || {};
      if (dia.chuva != null && dia.chuva >= 50) a.push('climaChuva');
      if (dia.min != null && dia.min <= (sens.frio ? 14 : 10)) a.push('climaFrio');
      if (dia.max != null && dia.max >= (sens.calor ? 27 : 30)) a.push('climaCalor');
      if (dia.vento != null && dia.vento >= 45) a.push('climaVento');
      return a;
    },

    _fontes: FONTES
  };

  window.Clima = Clima;
})();
