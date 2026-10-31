/* =====================================================================
   descobrir.js — os jeitos de montar o guia além do pacote pronto

   2) BUSCA ABERTA, SEM IA: OpenStreetMap (Overpass). Grátis, sem chave.
      Traz restaurantes, cafés, atrações, museus, parques e mirantes num raio
      do destino. Dados © colaboradores do OpenStreetMap (licença ODbL).
   3) COM A IA DA PESSOA: usa o cofre de chaves do módulo comum (DGO.ia),
      o mesmo de todos os apps SolverONE. Monta uma opção nova de roteiro a
      partir do perfil e dos lugares. Para a IA vão só idades, papéis
      (adulto, criança, idoso), restrições e ritmo: NUNCA nomes (LGPD art. 14).
      Tudo que a IA sugere entra marcado "Gerado por IA — confira".
   ===================================================================== */
(function () {
  'use strict';
  var OVERPASS = 'https://overpass-api.de/api/interpreter';

  function categoria(t) {
    if (t.amenity === 'restaurant' || t.amenity === 'fast_food') return ['comer', 'restaurante'];
    if (t.amenity === 'cafe') return ['comer', 'cafe'];
    if (t.amenity === 'ice_cream') return ['doces', 'sorvete'];
    if (t.amenity === 'pub' || t.amenity === 'bar' || t.craft === 'brewery') return ['bebidas', 'bar'];
    if (t.shop === 'chocolate' || t.shop === 'confectionery') return ['doces', 'chocolate'];
    if (t.tourism === 'museum') return ['atracao', 'museu'];
    if (t.tourism === 'viewpoint') return ['atracao', 'mirante'];
    if (t.tourism === 'zoo' || t.tourism === 'theme_park') return ['atracao', 'parque'];
    if (t.leisure === 'park') return ['atracao', 'parque'];
    return ['atracao', null];
  }

  var Descobrir = {
    /* jeito 2: OpenStreetMap ao redor de um ponto (raio em metros) */
    perto: function (centro, raio) {
      raio = Math.min(raio || 6000, 15000);
      var a = '(around:' + raio + ',' + centro.lat.toFixed(4) + ',' + centro.lng.toFixed(4) + ')';
      var q = '[out:json][timeout:25];(' +
        'nwr["amenity"~"^(restaurant|cafe|ice_cream|pub|bar)$"]["name"]' + a + ';' +
        'nwr["tourism"~"^(attraction|museum|viewpoint|zoo|theme_park)$"]["name"]' + a + ';' +
        'nwr["shop"~"^(chocolate|confectionery)$"]["name"]' + a + ';' +
        'nwr["craft"="brewery"]["name"]' + a + ';' +
        ');out center tags 300;';
      return fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
        .then(function (r) { if (!r.ok) throw new Error('osm-' + r.status); return r.json(); })
        .then(function (j) {
          var vistos = {};
          return (j.elements || []).map(function (e) {
            var t = e.tags || {}, c = categoria(t);
            var lat = e.lat != null ? e.lat : (e.center && e.center.lat), lng = e.lon != null ? e.lon : (e.center && e.center.lon);
            var end = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
            if (t['addr:city']) end += (end ? ', ' : '') + t['addr:city'];
            return {
              id: 'osm-' + e.type + '-' + e.id, nome: t.name, categoria: c[0], subcategoria: c[1],
              descricao: t.cuisine ? t.cuisine.replace(/;/g, ', ').replace(/_/g, ' ') : null,
              endereco: end || null, site: t.website || t['contact:website'] || null,
              telefone: t.phone || t['contact:phone'] || null, horario: t.opening_hours || null,
              reserva: null, preco: null, criancas: null, confianca: 'osm', gratis: t.fee === 'no',
              lat: lat != null ? +(+lat).toFixed(5) : null, lng: lng != null ? +(+lng).toFixed(5) : null,
              fonte: 'OpenStreetMap', dieta: {
                vegetariano: t['diet:vegetarian'] === 'yes' || t['diet:vegetarian'] === 'only',
                vegano: t['diet:vegan'] === 'yes' || t['diet:vegan'] === 'only',
                semGluten: t['diet:gluten_free'] === 'yes', kosher: t['diet:kosher'] === 'yes', halal: t['diet:halal'] === 'yes'
              }
            };
          }).filter(function (l) {
            if (!l.nome || vistos[l.nome.toLowerCase()]) return false;
            vistos[l.nome.toLowerCase()] = 1; return true;
          });
        });
    },

    /* busca livre por nome ou endereço, perto de um centro.
       Duas fontes abertas em paralelo: Nominatim (endereços) e Photon/komoot (nomes, tolera erro de digitação).
       Lugares de verdade (restaurante, bar, loja, atração) vêm antes de prédio e rua. */
    buscarNome: function (texto, centro, idioma) {
      var q = String(texto || '').trim().replace(/^(o|a|os|as|the)\s+/i, '');
      if (q.length < 3) return Promise.resolve([]);
      var lg = idioma === 'en' ? 'en' : 'pt-BR';
      function deNominatim() {
        var u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&extratags=1&dedupe=1&q=' + encodeURIComponent(q);
        if (centro && centro.lat != null) u += '&viewbox=' + (centro.lng - 0.35).toFixed(3) + ',' + (centro.lat + 0.3).toFixed(3) + ',' + (centro.lng + 0.35).toFixed(3) + ',' + (centro.lat - 0.3).toFixed(3) + '&bounded=0';
        return fetch(u, { headers: { 'Accept-Language': lg } }).then(function (r) { if (!r.ok) throw new Error('osm-' + r.status); return r.json(); })
          .then(function (lista) {
            return (lista || []).map(function (x) {
              var t = { amenity: x.class === 'amenity' ? x.type : null, tourism: x.class === 'tourism' ? x.type : null, shop: x.class === 'shop' ? x.type : null, leisure: x.class === 'leisure' ? x.type : null, craft: x.class === 'craft' ? x.type : null };
              var c = categoria(t), a = x.address || {}, ex = x.extratags || {};
              var nome = x.name || (x.display_name || '').split(',')[0];
              var end = [a.road, a.house_number].filter(Boolean).join(', ') + (a.suburb || a.neighbourhood ? ', ' + (a.suburb || a.neighbourhood) : '') + (a.city || a.town || a.municipality ? ', ' + (a.city || a.town || a.municipality) : '');
              return { id: 'osm-' + (x.osm_type || 'n').charAt(0) + '-' + x.osm_id, nome: nome, categoria: c[0], subcategoria: c[1] || (x.class === 'amenity' || x.class === 'shop' ? x.type.replace(/_/g, ' ') : null),
                descricao: ex.cuisine ? ex.cuisine.replace(/;/g, ', ').replace(/_/g, ' ') : null, endereco: end || (x.display_name || '').split(',').slice(1, 4).join(',').trim() || null,
                site: ex.website || ex['contact:website'] || null, telefone: ex.phone || ex['contact:phone'] || null, horario: ex.opening_hours || null,
                reserva: null, preco: null, criancas: null, confianca: 'osm', gratis: false, lat: +(+x.lat).toFixed(5), lng: +(+x.lon).toFixed(5), fonte: 'OpenStreetMap',
                _peso: /^(amenity|shop|tourism|leisure|craft)$/.test(x.class) ? 2 : (x.class === 'building' ? 0 : 1) };
            }).filter(function (l) { return l.nome; });
          });
      }
      function dePhoton() {
        var u = 'https://photon.komoot.io/api/?limit=8&lang=' + (idioma === 'en' ? 'en' : 'default') + '&q=' + encodeURIComponent(q);
        if (centro && centro.lat != null) u += '&lat=' + centro.lat + '&lon=' + centro.lng + '&location_bias_scale=0.4&zoom=12';
        return fetch(u).then(function (r) { if (!r.ok) throw new Error('photon-' + r.status); return r.json(); })
          .then(function (j) {
            return ((j && j.features) || []).map(function (f) {
              var p = f.properties || {}, g = (f.geometry && f.geometry.coordinates) || [];
              if (!p.name || p.osm_key === 'highway' || p.osm_key === 'place' || p.osm_key === 'boundary') return null;
              var t = {}; t[p.osm_key] = p.osm_value; var c = categoria(t);
              var end = [p.street, p.housenumber].filter(Boolean).join(', ') + (p.district ? ', ' + p.district : '') + (p.city ? ', ' + p.city : '');
              return { id: 'osm-' + String(p.osm_type || 'N').charAt(0).toLowerCase() + '-' + p.osm_id, nome: p.name, categoria: c[0], subcategoria: c[1] || (p.osm_key === 'amenity' || p.osm_key === 'shop' ? String(p.osm_value).replace(/_/g, ' ') : null),
                descricao: null, endereco: end || null, site: null, telefone: null, horario: null, reserva: null, preco: null, criancas: null, confianca: 'osm', gratis: false,
                lat: +(+g[1]).toFixed(5), lng: +(+g[0]).toFixed(5), fonte: 'OpenStreetMap',
                _peso: /^(amenity|shop|tourism|leisure|craft)$/.test(p.osm_key) ? 2 : (p.osm_key === 'building' ? 0 : 1) };
            }).filter(Boolean);
          });
      }
      /* fonte comercial (Foursquare) pela função 'lugares' do Supabase: a chave fica no servidor; sem chave, ignora */
      function doServidor() {
        var cfg = window.GUIAXPERT_CONFIG || {};
        if (!cfg.SUPABASE_URL || !window.Conta || !Conta.sessao()) return Promise.resolve([]);
        return Conta.token().then(function (tk) {
          if (!tk) return [];
          var u = String(cfg.SUPABASE_URL).replace(/\/+$/, '') + '/functions/v1/lugares?q=' + encodeURIComponent(q) + '&lang=' + (idioma === 'en' ? 'en' : 'pt') +
            (centro && centro.lat != null ? '&lat=' + centro.lat + '&lng=' + centro.lng : '');
          return fetch(u, { headers: { apikey: cfg.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + tk } })
            .then(function (r) { return r.ok ? r.json() : { lugares: [] }; })
            .then(function (j) { return (j.lugares || []).map(function (l) { l._peso = 3; return l; }); });
        }).catch(function () { return []; });
      }
      return Promise.all([doServidor(), deNominatim().catch(function () { return []; }), dePhoton().catch(function () { return []; })]).then(function (rs) {
        var vistos = {}, todos = [];
        rs[0].concat(rs[1], rs[2]).forEach(function (l) { if (!vistos[l.id]) { vistos[l.id] = 1; todos.push(l); } });
        if (!todos.length && !navigator.onLine) throw new Error('offline');
        /* com um centro conhecido, o que está a mais de 200 km só entra se faltar resultado perto */
        if (centro && centro.lat != null) {
          var perto = todos.filter(function (l) { return dist(l, centro) < 1.8 * 1.8; });   /* ~200 km em graus */
          if (perto.length >= 3) todos = perto;
        }
        var qn = q.toLowerCase();
        todos.sort(function (a, b) {
          var pa = a._peso + (a.nome.toLowerCase().indexOf(qn) === 0 ? 1 : 0), pb = b._peso + (b.nome.toLowerCase().indexOf(qn) === 0 ? 1 : 0);
          if (pa !== pb) return pb - pa;
          if (centro && centro.lat != null) return dist(a, centro) - dist(b, centro);
          return 0;
        });
        return todos.map(function (l) { delete l._peso; return l; }).slice(0, 10);
      });
      function dist(l, c) { var dx = (l.lng - c.lng) * Math.cos(c.lat * Math.PI / 180), dy = l.lat - c.lat; return dx * dx + dy * dy; }
    },

    /* resumo do grupo para a IA: sem nome de ninguém */
    resumoGrupo: function (viagem, pessoas) {
      var linhas = (pessoas || []).map(function (p) {
        var x = [p.faixa || 'adulto'];
        if (p.idade != null && p.idade !== '') x.push(p.idade + ' anos');
        if (p.mobilidade && p.mobilidade !== 'normal') x.push('mobilidade: ' + p.mobilidade);
        if (p.calor) x.push('sensível ao calor');
        if (p.frio) x.push('sensível ao frio');
        if (p.soneca) x.push('faz soneca à tarde');
        if (p._restricoes && p._restricoes.length) x.push('comida: ' + p._restricoes.join(', '));
        return '- ' + x.join('; ');
      });
      var pr = viagem.preferencias || {};
      return 'Grupo:\n' + linhas.join('\n') +
        '\nRitmo: ' + (pr.ritmo || 'equilibrado') + '. Orçamento: ' + (pr.orcamento || 'médio') +
        '. Transporte: ' + (pr.transporte || 'carro') + '.' +
        (window.Gostos ? ' ' + (Gostos.resumo(pessoas) || 'Gostos variados.') : '');
    },

    /* jeito 3: a IA da pessoa monta uma opção nova de roteiro */
    roteiroIA: function (viagem, pessoas, pacote, idioma) {
      if (!window.DGO || !DGO.ia) return Promise.reject(new Error('sem-modulo'));
      var dias = viagem.dias || [];
      var lugares = (pacote && pacote.lugares || []).filter(function (l) { return l.categoria !== 'logistica'; })
        .map(function (l) { return l.id + ' | ' + l.nome + ' | ' + l.categoria + (l.horario ? ' | ' + l.horario : ''); }).join('\n');
      var pergunta =
        'Monte UM roteiro de viagem em ' + (pacote ? pacote.nome.pt : viagem.destino) + ' para estes dias: ' +
        dias.map(function (d) { return d.data + ' (' + d.rotulo + ')'; }).join(', ') + '.\n' +
        Descobrir.resumoGrupo(viagem, pessoas) + '\n' +
        (lugares ? 'Use de preferência estes lugares (id | nome | tipo | horário):\n' + lugares + '\n' : '') +
        'Respeite chegada no primeiro dia e saída no último. Inclua descanso se houver criança pequena ou idoso. ' +
        'Responda SÓ com JSON, sem texto fora dele, no formato: ' +
        '{"nome":"…","dias":[{"titulo":"…","itens":[{"hora":"HH:MM","titulo":"…","nota":"…","lugarId":"id ou null"}]}]}. ' +
        'Idioma das frases: ' + (idioma === 'en' ? 'inglês' : 'português do Brasil') + '. Frases curtas.';
      return DGO.ia.perguntar(pergunta, {
        contexto: 'Você é um guia de viagem cuidadoso. Nunca invente endereço, preço ou horário: quando não souber, deixe nota vazia.',
        limite: 4000
      }).then(function (txt) {
        var ini = txt.indexOf('{'), fim = txt.lastIndexOf('}');
        if (ini < 0 || fim < ini) throw new Error('ia-formato');
        var j = JSON.parse(txt.slice(ini, fim + 1));
        if (!j || !Array.isArray(j.dias)) throw new Error('ia-formato');
        var ids = {};
        (pacote && pacote.lugares || []).forEach(function (l) { ids[l.id] = 1; });
        return {
          nome: String(j.nome || 'Roteiro da IA').slice(0, 60), origem: 'ia',
          dias: j.dias.slice(0, 30).map(function (d, i) {
            return { ordem: i + 1, titulo: String(d.titulo || '').slice(0, 80), itens: (d.itens || []).slice(0, 15).map(function (it) {
              return { hora: /^\d{1,2}:\d{2}$/.test(it.hora) ? it.hora : '', titulo: String(it.titulo || '').slice(0, 100),
                       nota: it.nota ? String(it.nota).slice(0, 200) : null, tipo: null, lugarId: ids[it.lugarId] ? it.lugarId : null };
            }) };
          })
        };
      });
    }
  };

  window.Descobrir = Descobrir;
})();
