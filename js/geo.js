/* =====================================================================
   geo.js — localização do aparelho (GPS), distâncias e links de rota

   Regras (diretrizes SolverONE):
   - Só pede a localização depois de um toque da pessoa.
   - A posição fica só na memória e numa cópia aproximada no aparelho
     (3 casas ≈ 100 m). Nunca vai para a nuvem nem para a IA.
   - Funciona sem internet: o GPS vem do satélite.
   ===================================================================== */
(function () {
  'use strict';
  var ultima = null;

  var Geo = {
    disponivel: function () { return 'geolocation' in navigator; },
    ultima: function () { return ultima; },

    /* lê a posição agora (toque da pessoa) */
    agora: function () {
      if (!Geo.disponivel()) return Promise.reject(new Error('sem-gps'));
      return new Promise(function (ok, erro) {
        navigator.geolocation.getCurrentPosition(function (p) {
          ultima = { lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy), em: Date.now() };
          try { localStorage.setItem('dgo:guiaxpert:pos', JSON.stringify({ lat: +ultima.lat.toFixed(3), lng: +ultima.lng.toFixed(3), em: ultima.em })); } catch (e) {}
          ok(ultima);
        }, function (e) {
          erro(new Error(e.code === 1 ? 'negado' : e.code === 3 ? 'demorou' : 'indisponivel'));
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      });
    },

    /* sem pedir de novo: só se o navegador já deu a permissão */
    seJaPermitido: function () {
      if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(null);
      return navigator.permissions.query({ name: 'geolocation' }).then(function (s) {
        return s.state === 'granted' ? Geo.agora().catch(function () { return null; }) : null;
      }).catch(function () { return null; });
    },

    /* distância em km (fórmula de haversine) */
    distancia: function (a, b) {
      if (!a || !b || a.lat == null || b.lat == null) return null;
      var R = 6371, rad = Math.PI / 180;
      var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
      var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * R * Math.asin(Math.sqrt(h));
    },
    /* estimativa simples de carro na serra: 30 km/h na cidade, sem trânsito ao vivo */
    minutosCarro: function (km) { return km == null ? null : Math.max(2, Math.round(km * 1.3 / 30 * 60)); },
    formatarKm: function (km) { return km == null ? '' : km < 1 ? Math.round(km * 1000) + ' m' : (km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)) + ' km'; },

    /* links que abrem o app de mapas (não precisam de chave) */
    linkMapa: function (l) {
      var q = l.lat != null ? l.lat + ',' + l.lng : (l.nome + ' ' + (l.endereco || ''));
      return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
    },
    linkRota: function (l, origem) {
      var dest = l.lat != null ? l.lat + ',' + l.lng : (l.nome + ' ' + (l.endereco || ''));
      var u = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(dest);
      if (origem && origem.lat != null) u += '&origin=' + encodeURIComponent(origem.lat + ',' + origem.lng);
      return u;
    },
    linkWaze: function (l) {
      return l.lat != null ? 'https://waze.com/ul?navigate=yes&ll=' + l.lat + ',' + l.lng : 'https://waze.com/ul?q=' + encodeURIComponent(l.nome + ' ' + (l.endereco || ''));
    }
  };

  window.Geo = Geo;
})();
