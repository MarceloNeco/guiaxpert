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
    linkRota: function (l, origem, modo) {
      var dest = l.lat != null ? l.lat + ',' + l.lng : (l.nome + ' ' + (l.endereco || ''));
      var u = 'https://www.google.com/maps/dir/?api=1&travelmode=' + (modo === 'pe' ? 'walking' : 'driving') + '&destination=' + encodeURIComponent(dest);
      if (origem && origem.lat != null) u += '&origin=' + encodeURIComponent(origem.lat + ',' + origem.lng);
      return u;
    },
    /* ROTA pelas ruas, dentro do app (dono aprovou em 21/Nov/2026, regra zero): serviço aberto do OpenStreetMap
       (routing.openstreetmap.de, da FOSSGIS — o mesmo do site openstreetmap.org), sem chave e sem custo.
       Só vão os dois pontos (arredondados a ~10 m), nunca nome ou dado pessoal. As últimas rotas ficam no aparelho;
       sem internet (ou se o serviço falhar) devolve a linha reta com km e tempo estimados ({ reta: true }).
       modo: 'carro' | 'pe'. Resolve { km, min, linha: [[lat, lng]…], reta? } — nunca rejeita. */
    rota: function (o, d, modo) {
      var pe = modo === 'pe', f4 = function (x) { return (+x).toFixed(4); };
      var chave = (pe ? 'p' : 'c') + [o.lat, o.lng, d.lat, d.lng].map(f4).join(',');
      var guard = {};
      try { guard = JSON.parse(localStorage.getItem('guiaxpert.rotas') || '{}') || {}; } catch (e) { guard = {}; }
      var reta = function () {
        var km = Geo.distancia(o, d) * (pe ? 1.25 : 1.35);
        return { km: km, min: pe ? Math.max(1, Math.round(km / 4.5 * 60)) : Math.max(2, Math.round(km / 30 * 60)), linha: [[o.lat, o.lng], [d.lat, d.lng]], reta: true };
      };
      if (guard[chave]) return Promise.resolve(guard[chave]);
      if (navigator.onLine === false || !window.fetch) return Promise.resolve(reta());
      var url = 'https://routing.openstreetmap.de/' + (pe ? 'routed-foot/route/v1/foot/' : 'routed-car/route/v1/driving/') +
        f4(o.lng) + ',' + f4(o.lat) + ';' + f4(d.lng) + ',' + f4(d.lat) + '?overview=full&geometries=geojson';
      var ctl = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
      return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { if (!r.ok) throw new Error('rota'); return r.json(); }).then(function (j) {
        clearTimeout(t);
        var rt = j && j.code === 'Ok' && j.routes && j.routes[0];
        if (!rt || !rt.geometry) throw new Error('rota');
        var res = { km: rt.distance / 1000, min: Math.max(1, Math.round(rt.duration / 60)), em: Date.now(),
          linha: rt.geometry.coordinates.map(function (c) { return [+c[1].toFixed(5), +c[0].toFixed(5)]; }) };
        guard[chave] = res;
        Object.keys(guard).sort(function (a, b) { return (guard[b].em || 0) - (guard[a].em || 0); }).slice(15).forEach(function (k) { delete guard[k]; });
        try { localStorage.setItem('guiaxpert.rotas', JSON.stringify(guard)); } catch (e) {}
        return res;
      }).catch(function () { clearTimeout(t); return reta(); });
    },
    /* "12 min", "1 h 05" */
    tempoTxt: function (min) { if (min == null) return ''; if (min < 60) return min + ' min'; var hh = Math.floor(min / 60), mm = min % 60; return hh + ' h' + (mm ? ' ' + (mm < 10 ? '0' : '') + mm : ''); },
    linkWaze: function (l) {
      return l.lat != null ? 'https://waze.com/ul?navigate=yes&ll=' + l.lat + ',' + l.lng : 'https://waze.com/ul?q=' + encodeURIComponent(l.nome + ' ' + (l.endereco || ''));
    }
  };

  window.Geo = Geo;
})();
