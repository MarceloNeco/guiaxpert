/* =====================================================================
   destino.js — "O que tem em X": ponto de partida para um destino sem guia
   pronto, só com dados abertos e sem IA.

   Fontes (gratuitas, sem chave, chamadas direto do aparelho):
   1) Wikivoyage (pt e, se faltar, en): as listas "Veja / Faça / Coma / Beba"
      que os editores mantêm, com endereço, horário, preço, site e coordenada.
      Texto CC BY-SA: o app mostra a fonte e o link da página.
   2) Wikidata (CC0): atrações perto do destino (museu, parque, mirante,
      cachoeira, igreja, praia…), ordenadas pela fama (nº de Wikipédias).
   O resultado vira lugares no formato do app (ids "wv-…" e "wd-…") e fica
   guardado no aparelho por 7 dias (funciona sem internet depois).
   ===================================================================== */
(function () {
  'use strict';

  /* tipo da listagem do Wikivoyage → seção do app */
  var SECAO = {
    see: 'ver', veja: 'ver', ver: 'ver', vejo: 'ver',
    do: 'fazer', 'faça': 'fazer', faca: 'fazer', fazer: 'fazer',
    eat: 'comer', coma: 'comer', comer: 'comer',
    drink: 'beber', beba: 'beber', beber: 'beber',
    buy: 'comprar', compre: 'comprar', comprar: 'comprar'
  };
  var RE_DOCARIA = /\b(caf[eé]s?|coffee|pastel|past[eé]is|pastry|bakery|padaria|confeitaria|doceria|gelato|gelataria|sorvet\w*|ice cream|chocolat\w*|patisserie|p[aâ]tisserie|tea ?room|casa de ch[aá])\b/i;
  function docaria(nome, p) { return RE_DOCARIA.test(nome + ' ' + String(p.content || p.conteudo || p.descricao || p.description || '').slice(0, 160)); }
  var CATEGORIA = { ver: 'atracao', fazer: 'atracao', comer: 'comer', beber: 'bebidas', comprar: 'atracao' };

  function semAcento(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function slug(t) { return semAcento(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }

  /* wikitexto → texto simples: [[a|b]] → b, [[a]] → a, '''x''' → x, {{…}} e <ref> somem */
  function limpar(t) {
    t = String(t || '');
    for (var i = 0; i < 3; i++) t = t.replace(/\{\{[^{}]*\}\}/g, '');
    return t.replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/<[^>]+>/g, '')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1').replace(/\[(https?:\/\/\S+)\s+([^\]]+)\]/g, '$2').replace(/\[(https?:\/\/\S+)\]/g, '')
      .replace(/'''?/g, '').replace(/\s+/g, ' ').trim();
  }

  /* acha os modelos {{…}} de primeiro nível no wikitexto (respeita {{ }} dentro de {{ }}) */
  function modelos(texto) {
    var out = [], i = 0, n = texto.length;
    while (i < n) {
      var a = texto.indexOf('{{', i); if (a < 0) break;
      var prof = 0, j = a;
      for (; j < n - 1; j++) {
        if (texto[j] === '{' && texto[j + 1] === '{') { prof++; j++; continue; }
        if (texto[j] === '}' && texto[j + 1] === '}') { prof--; j++; if (!prof) break; }
      }
      out.push(texto.slice(a + 2, j - 1));
      i = j + 1;
    }
    return out;
  }
  /* "see | name=X | lat=… | content=…" → { _tipo: 'see', name: 'X', … } (separa só nos | de primeiro nível) */
  function parametros(corpo) {
    var partes = [], prof = 0, ini = 0;
    for (var k = 0; k < corpo.length; k++) {
      var c = corpo[k], d = corpo[k + 1];
      if ((c === '{' && d === '{') || (c === '[' && d === '[')) { prof++; k++; continue; }
      if ((c === '}' && d === '}') || (c === ']' && d === ']')) { prof--; k++; continue; }
      if (c === '|' && prof === 0) { partes.push(corpo.slice(ini, k)); ini = k + 1; }
    }
    partes.push(corpo.slice(ini));
    var p = { _tipo: semAcento(partes[0]).trim() };
    partes.slice(1).forEach(function (x) { var m = /^\s*([^=]+?)\s*=([\s\S]*)$/.exec(x); if (m) p[semAcento(m[1])] = m[2].trim(); });
    return p;
  }
  function numero(x) { var v = parseFloat(String(x || '').replace(',', '.')); return isFinite(v) ? v : null; }

  /* listagens de uma página do Wikivoyage */
  function listagens(wikitexto, lingua, pagina) {
    var out = [];
    modelos(wikitexto).forEach(function (m) {
      var p = parametros(m), tipo = p._tipo;
      if (tipo === 'listing' || tipo === 'listagem' || tipo === 'marker') tipo = semAcento(p.type || p.tipo || '');
      var secao = SECAO[tipo]; if (!secao || secao === 'comprar') return;
      var nome = limpar(p.name || p.nome); if (!nome || nome.length > 90) return;
      var lat = numero(p.lat), lng = numero(p.long || p.lon || p.lng);
      var site = (p.url || p.site || '').trim();
      out.push({
        id: 'wv-' + slug(pagina) + '-' + slug(nome), nome: nome, secao: secao,
        /* "beber" e "comer" que são café, doceria ou padaria (ex.: Pastéis de Belém) não viram bar nem restaurante */
        categoria: docaria(nome, p) ? 'doces' : CATEGORIA[secao], subcategoria: docaria(nome, p) ? 'cafe' : secao === 'comer' ? 'restaurante' : null,
        descricao: limpar(p.content || p.conteudo || p.descricao || p.description).slice(0, 400) || null,
        endereco: limpar(p.address || p.endereco || p['endereço']) || null,
        horario: (function (hh) { return hh && lingua === 'en' && window.Descobrir && Descobrir.horarioPt ? Descobrir.horarioPt(hh) : hh; })(limpar(p.hours || p.horario || p['horário']) || null),
        preco: limpar(p.price || p.preco || p['preço']) || null,
        telefone: limpar(p.phone || p.telefone) || null,
        site: /^https?:\/\//.test(site) ? site : null,
        lat: lat, lng: lng, confianca: 'wikivoyage', gratis: /\b(free|gratuito|grátis|gratis)\b/i.test(p.price || p.preco || ''),
        fonte: 'Wikivoyage (' + lingua + ')', fonte_url: 'https://' + lingua + '.wikivoyage.org/wiki/' + encodeURIComponent(pagina.replace(/ /g, '_'))
      });
    });
    return out;
  }

  function api(lingua, params) {
    return fetch('https://' + lingua + '.wikivoyage.org/w/api.php?format=json&formatversion=2&origin=*&' + params)
      .then(function (r) { if (!r.ok) throw new Error('wv-' + r.status); return r.json(); });
  }
  /* página do destino (segue redirecionamento); se tiver poucos itens, lê até 4 bairros (subpáginas "Lisboa/Belém") */
  var UF_NOME = { ac: 'Acre', al: 'Alagoas', ap: 'Amapá', am: 'Amazonas', ba: 'Bahia', ce: 'Ceará', df: 'Distrito Federal', es: 'Espírito Santo', go: 'Goiás',
    ma: 'Maranhão', mt: 'Mato Grosso', ms: 'Mato Grosso do Sul', mg: 'Minas Gerais', pa: 'Pará', pb: 'Paraíba', pr: 'Paraná', pe: 'Pernambuco', pi: 'Piauí',
    rj: 'Rio de Janeiro', rn: 'Rio Grande do Norte', rs: 'Rio Grande do Sul', ro: 'Rondônia', rr: 'Roraima', sc: 'Santa Catarina', sp: 'São Paulo', se: 'Sergipe', to: 'Tocantins' };
  /* "Bonito, MS" → tenta "Bonito" e, se for página de desambiguação ou vazia, "Bonito (Mato Grosso do Sul)" */
  function doWikivoyage(nomeCompleto, lingua) {
    var partes = String(nomeCompleto).split(',').map(function (x) { return x.trim(); }), nome = partes[0];
    var reg = partes[1] ? (UF_NOME[semAcento(partes[1])] || partes[1]) : '';
    var tentativas = [nome].concat(reg ? [nome + ' (' + reg + ')', nome + ', ' + reg] : []);
    return tentativas.reduce(function (pr, t) {
      return pr.then(function (achou) { return achou && achou.length ? achou : doPagina(t, lingua).catch(function () { return []; }); });
    }, Promise.resolve(null)).then(function (l) { return l || []; });
  }
  function doPagina(nome, lingua) {
    return api(lingua, 'action=parse&prop=wikitext&redirects=1&page=' + encodeURIComponent(nome)).then(function (j) {
      if (!j || !j.parse) return [];
      var titulo = j.parse.title, txt = j.parse.wikitext || '';
      if (/\{\{\s*(disambig|desambigua|dab)/i.test(txt)) return [];
      var lista = listagens(txt, lingua, titulo);
      if (lista.length >= 12) return lista;
      var sub = [], re = new RegExp('\\[\\[(' + titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\/[^\\]|#]+)', 'g'), m;
      while ((m = re.exec(txt)) && sub.length < 4) if (sub.indexOf(m[1]) < 0) sub.push(m[1]);
      return sub.reduce(function (pr, pag) {
        return pr.then(function (acc) {
          return api(lingua, 'action=parse&prop=wikitext&page=' + encodeURIComponent(pag)).then(function (k) {
            return acc.concat(k && k.parse ? listagens(k.parse.wikitext || '', lingua, k.parse.title) : []);
          }).catch(function () { return acc; });
        });
      }, Promise.resolve(lista));
    });
  }

  /* atrações do Wikidata num raio do destino, das mais conhecidas para as menos */
  var CLASSES = ['Q570116', 'Q33506', 'Q22698', 'Q6017969', 'Q34038', 'Q35509', 'Q16970', 'Q4989906', 'Q23413', 'Q40080', 'Q43501',
    'Q2281788', 'Q194195', 'Q167346', 'Q174782', 'Q16560', 'Q12518', 'Q2065736', 'Q1107656', 'Q46169', 'Q473972', 'Q44539', 'Q207694'];
  function doWikidata(centro, idioma) {
    if (!centro || centro.lat == null) return Promise.resolve([]);
    var q = 'SELECT ?item ?itemLabel ?itemDescription ?coord ?sl ?site WHERE { SERVICE wikibase:around { ?item wdt:P625 ?coord . ' +
      'bd:serviceParam wikibase:center "Point(' + centro.lng + ' ' + centro.lat + ')"^^geo:wktLiteral . bd:serviceParam wikibase:radius "12" . } ' +
      'VALUES ?cls { ' + CLASSES.map(function (c) { return 'wd:' + c; }).join(' ') + ' } ?item wdt:P31 ?cls . ?item wikibase:sitelinks ?sl . ' +
      'OPTIONAL { ?item wdt:P856 ?site } ' +
      'SERVICE wikibase:label { bd:serviceParam wikibase:language "' + (idioma === 'en' ? 'en,pt' : 'pt,pt-br,en,es') + '". } } ORDER BY DESC(?sl) LIMIT 40';
    return fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { Accept: 'application/sparql-results+json' } })
      .then(function (r) { if (!r.ok) throw new Error('wd-' + r.status); return r.json(); })
      .then(function (j) {
        var vistos = {};
        return (j.results && j.results.bindings || []).map(function (b) {
          var id = b.item.value.split('/').pop(), nome = b.itemLabel && b.itemLabel.value;
          if (!nome || /^Q\d+$/.test(nome) || vistos[id]) return null; vistos[id] = 1;
          var m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord.value);
          return { id: 'wd-' + id, nome: nome, secao: 'ver', categoria: 'atracao', subcategoria: null,
            descricao: b.itemDescription ? b.itemDescription.value : null, endereco: null, horario: null, preco: null, telefone: null,
            site: b.site ? b.site.value : null, lat: m ? +(+m[2]).toFixed(5) : null, lng: m ? +(+m[1]).toFixed(5) : null,
            confianca: 'wikidata', gratis: false, fama: +(b.sl && b.sl.value || 0), wikidata: id,
            fonte: 'Wikidata', fonte_url: 'https://www.wikidata.org/wiki/' + id };
        }).filter(Boolean);
      });
  }

  /* junta as duas fontes: Wikivoyage primeiro (curado por editores); do Wikidata só o que não repete */
  function juntar(wv, wd) {
    var nomes = {}; wv.forEach(function (l) { nomes[semAcento(l.nome)] = 1; });
    return wv.concat(wd.filter(function (l) { return !nomes[semAcento(l.nome)]; }));
  }

  var Destino = {
    /* nome: "Lisboa" (sem estado/país); centro: {lat,lng} do destino; idioma: 'pt'|'en'.
       Devolve { lugares, fontes: [{nome, url}], em } — guardado no aparelho por 7 dias. */
    oQueTem: function (nomeCompleto, centro, idioma, forcar) {
      var nome = String(nomeCompleto || '').split(/[,(]/)[0].trim();
      if (!nome) return Promise.resolve({ lugares: [], fontes: [] });
      var chave = 'oqt:' + slug(nome) + ':' + (centro ? centro.lat.toFixed(1) + ',' + centro.lng.toFixed(1) : '');
      return Banco.meta(chave, null).then(function (g) {
        if (g && !forcar && Date.now() - g.em < 7 * 86400000) return g;
        if (!navigator.onLine) { if (g) return g; throw new Error('offline'); }
        var linguas = idioma === 'en' ? ['en', 'pt'] : ['pt', 'en'];
        var wv = doWikivoyage(nomeCompleto, linguas[0]).catch(function () { return []; }).then(function (l) {
          return l.length >= 6 ? l : doWikivoyage(nomeCompleto, linguas[1]).catch(function () { return []; }).then(function (l2) { return l2.length > l.length ? l2 : l; });
        });
        return Promise.all([wv, doWikidata(centro, idioma).catch(function () { return []; })]).then(function (r) {
          /* com centro, descarta o que o Wikivoyage marcou a mais de 60 km (página com o mesmo nome em outro lugar) */
          var wvl = r[0].filter(function (l) { return !centro || l.lat == null || (Math.abs(l.lat - centro.lat) < 0.6 && Math.abs(l.lng - centro.lng) < 0.6); });
          var fontes = [];
          if (wvl.length) fontes.push({ nome: wvl[0].fonte, url: wvl[0].fonte_url, licenca: 'CC BY-SA 4.0' });
          if (r[1].length) fontes.push({ nome: 'Wikidata', url: 'https://www.wikidata.org', licenca: 'CC0' });
          var res = { em: Date.now(), lugares: juntar(wvl, r[1]), fontes: fontes };
          if (res.lugares.length) Banco.definirMeta(chave, res);
          return res;
        });
      });
    },
    _listagens: listagens, _limpar: limpar
  };
  window.Destino = Destino;
})();
