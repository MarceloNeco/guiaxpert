/* =====================================================================
   clima.js — previsão do tempo (Open-Meteo: grátis, sem chave, sem cadastro)
   Guarda a última previsão por 1 h no aparelho; sem internet, mostra a
   guardada com a hora em que foi buscada. Só a coordenada do destino vai
   para o serviço (nunca a da pessoa sem ela pedir).
   Avisos práticos: chuva → guarda-chuva; frio → agasalho; calor → água.
   ===================================================================== */
(function () {
  'use strict';
  var URL = 'https://api.open-meteo.com/v1/forecast';
  var CODIGOS = { 0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️', 45: '🌫', 48: '🌫', 51: '🌦', 53: '🌦', 55: '🌧', 61: '🌦', 63: '🌧', 65: '🌧', 71: '🌨', 73: '🌨', 75: '❄️', 80: '🌦', 81: '🌧', 82: '⛈', 95: '⛈', 96: '⛈', 99: '⛈' };

  var Clima = {
    icone: function (c) { return CODIGOS[c] || '🌡'; },

    previsao: function (lat, lng) {
      var chave = 'clima:' + lat.toFixed(2) + ',' + lng.toFixed(2);
      return Banco.meta(chave, null).then(function (g) {
        if (g && Date.now() - g.em < 3600 * 1000) return g;
        var u = URL + '?latitude=' + lat.toFixed(3) + '&longitude=' + lng.toFixed(3) +
          '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max' +
          '&timezone=auto&forecast_days=16';
        return fetch(u).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (j) {
          var d = j.daily || {}, dias = (d.time || []).map(function (data, i) {
            return { data: data, codigo: d.weather_code[i], max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]),
                     chuva: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null, vento: d.wind_speed_10m_max ? Math.round(d.wind_speed_10m_max[i]) : null };
          });
          var res = { em: Date.now(), dias: dias };
          Banco.definirMeta(chave, res);
          return res;
        }).catch(function () {
          if (g) { g.antiga = true; return g; }
          throw new Error('sem-clima');
        });
      });
    },

    /* avisos práticos de um dia (textos em textos.js) */
    avisos: function (dia) {
      var a = [];
      if (!dia) return a;
      if (dia.chuva != null && dia.chuva >= 50) a.push('climaChuva');
      if (dia.min != null && dia.min <= 10) a.push('climaFrio');
      if (dia.max != null && dia.max >= 30) a.push('climaCalor');
      if (dia.vento != null && dia.vento >= 45) a.push('climaVento');
      return a;
    }
  };

  window.Clima = Clima;
})();
