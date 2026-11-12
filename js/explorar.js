/* =====================================================================
   explorar.js — EXPLORAR: qualquer cidade, com ou sem viagem

   Mapa centrado em onde a pessoa está (ou numa cidade buscada), com os
   lugares salvos sem viagem e o que o OpenStreetMap acha por perto.
   De um lugar dá para: Salvar (meus Salvos), Pôr numa viagem, ou
   "Planejar hoje aqui" (cria uma viagem de 1 dia neste lugar).
   Depende de window.GX (app.js) e de Mapa (mapa.js).
   ===================================================================== */
(function () {
  'use strict';
  var estadoEx = { centro: null, nome: '', descobertas: [], zoom: null };

  function GX() { return window.GX; }

  function geocodificar(texto, lg) {
    return fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(texto), { headers: { 'Accept-Language': lg === 'en' ? 'en' : 'pt-BR' } })
      .then(function (r) { return r.ok ? r.json() : []; }).then(function (j) {
        if (!j || !j[0]) return null;
        var bb = (j[0].boundingbox || []).map(Number);   /* [sul, norte, oeste, leste] */
        return { lat: +(+j[0].lat).toFixed(4), lng: +(+j[0].lon).toFixed(4), nome: (j[0].display_name || texto).split(',')[0], bbox: bb.length === 4 ? bb : null };
      });
  }

  var Explorar = {
    estado: estadoEx,

    /* lugares do Explorar: salvos sem viagem + descobertas desta sessão */
    lugares: function () {
      var g = GX();
      var salvos = g.estado.lugaresProprios.filter(function (l) { return !l.viagem_id; });
      var ids = {}; salvos.forEach(function (l) { ids[l.id] = 1; });
      return salvos.concat(estadoEx.descobertas.filter(function (l) { return !ids[l.id]; }));
    },

    tela: function (tela) {
      var g = GX(), h = g.h, T = g.T, estado = g.estado;
      /* de dentro de uma viagem, o Explorar começa no destino dela (não no mapa do continente) */
      if (!estadoEx.centro && g.emViagem() && g.centroViagem()) { estadoEx.centro = g.centroViagem(); estadoEx.nome = (estado.viagem && (estado.viagem.destinoTexto || estado.viagem.nome)) || ''; }
      if (estado.filtro && ['todos', 'favoritos', 'perto', 'comer', 'atracao', 'gratis', 'bebidas', 'doces'].indexOf(estado.filtro) < 0) estado.filtro = 'todos';
      var centro = estadoEx.centro || estado.pos;
      Mapa.tela(tela, {
        lugares: Explorar.lugares,
        centro: centro, zoom: estadoEx.zoom || (centro ? 13 : 4),
        /* busca sem resultado ("Europa", "Bonito", "Lisboa"): leva o mapa até lá */
        irPara: function (q) { var c = $cidade(); if (c) c.value = q; irParaTexto(q); },
        filtros: ['todos', 'favoritos', 'perto', 'comer', 'atracao', 'gratis', 'bebidas', 'doces'],
        buscarFora: function (q) { return Descobrir.buscarNome(q, estadoEx.centro || estado.pos, g.idioma()); },
        acharJuntos: function (q, aoCriar) { g.acharJuntos(q, aoCriar); },
        acrescentar: function (ls) { var ids = {}; estadoEx.descobertas.forEach(function (x) { ids[x.id] = 1; }); ls.forEach(function (l) { if (!ids[l.id]) estadoEx.descobertas.push(l); }); },
        topo: function (topo) {
          var cidade = h('input', { class: 'campo', id: 'gx-ex-cidade', placeholder: T('ondeExplorar'), 'aria-label': T('ondeExplorar'), value: estadoEx.nome, autocomplete: 'off' });
          var ir = h('button', { class: 'bt sec', type: 'button', texto: T('ir') });
          var aqui = h('button', { class: 'bt leve', type: 'button', texto: '📍', 'aria-label': T('ondeEstou') });
          var linha = h('div', { class: 'linha', style: 'flex-wrap:nowrap' }, [cidade, aqui, ir]);
          topo.appendChild(linha);
          function irPara() { irParaTexto(cidade.value.trim(), ir); }
          ir.addEventListener('click', irPara);
          cidade.addEventListener('keydown', function (e) { if (e.key === 'Enter') irPara(); });
          aqui.addEventListener('click', function () {
            g.pegarPosicao().then(function (p) { estadoEx.centro = { lat: p.lat, lng: p.lng }; estadoEx.nome = ''; estadoEx.descobertas = []; descobrir(); }).catch(function () {});
          });
        },
        rodape: function () {
          return h('div', { class: 'cartao', style: 'margin:.5rem' }, [
            h('p', { class: 'sub', texto: T('explorarDica') }),
            h('div', { class: 'linha' }, [
              h('button', { class: 'bt sec', type: 'button', texto: T('descobrirBotao'), onclick: descobrir }),
              h('button', { class: 'bt leve', type: 'button', texto: '🧳 ' + T('planejarHojeAqui'), onclick: planejarHoje })
            ]),
            h('p', { class: 'pequeno', texto: '© OpenStreetMap contributors (ODbL)' })
          ]);
        }
      });
      function $cidade() { return document.getElementById('gx-ex-cidade'); }
      /* cidade: centra e procura lugares em volta; país ou continente (área grande): só mostra a região no mapa */
      function irParaTexto(q, bt) {
        if (!q) return;
        if (bt) bt.disabled = true;
        geocodificar(q, g.idioma()).then(function (c) {
          if (bt) bt.disabled = false;
          if (!c) { g.avisar(T('cidadeNaoAchada')); return; }
          var bb = c.bbox, tam = bb ? Math.max(bb[1] - bb[0], bb[3] - bb[2]) : 0;
          estadoEx.centro = { lat: c.lat, lng: c.lng }; estadoEx.nome = c.nome; estadoEx.descobertas = []; estado.busca = '';
          estadoEx.zoom = tam > 20 ? 3 : tam > 8 ? 5 : tam > 2 ? 7 : tam > .5 ? 10 : 13;
          if (tam > .5) { g.avisar(T('regiaoNoMapa', { nome: c.nome })); g.mostrar('explorar'); return; }
          descobrir();
        }).catch(function () { if (bt) bt.disabled = false; g.avisar(navigator.onLine ? T('osmErro') : T('semInternet')); });
      }
      function descobrir() {
        if (estadoEx.zoom && estadoEx.zoom < 12) estadoEx.zoom = 14;
        var c = estadoEx.centro || estado.pos;
        if (!c) { g.pegarPosicao().then(function (p) { estadoEx.centro = { lat: p.lat, lng: p.lng }; descobrir(); }).catch(function () {}); return; }
        g.avisar(T('carregando'));
        /* remonta a tela: o mapa recentra e a lista mostra o que veio */
        Descobrir.perto(c, 6000).then(function (l) { estadoEx.descobertas = l; g.avisar(T('descobertos', { n: l.length })); g.mostrar('explorar'); })
          .catch(function () { estadoEx.descobertas = []; g.mostrar('explorar'); g.avisar(navigator.onLine ? T('osmErro') : T('semInternet')); });
      }
      function planejarHoje() {
        var c = estadoEx.centro || estado.pos;
        if (!c) { g.avisar(T('gpsErro')); return; }
        var hoje = g.hojeIso();
        var nome = (estadoEx.nome || T('porAqui')) + ' ' + g.fData(hoje, true);
        Banco.gravar('viagens', { nome: nome, destino: null, destinoTexto: estadoEx.nome || T('porAqui'), centro: { lat: c.lat, lng: c.lng }, inicio: hoje, fim: hoje,
          pessoas: estado.pessoas.filter(function (p) { return (p.grupo || 'familia') === 'familia'; }).map(function (p) { return p.id; }),
          preferencias: { ritmo: 'equilibrado', orcamento: 'medio', interesses: [], transporte: 'carro' }, estadias: [], opcao_ativa: null })
          .then(function (v) {
            /* os lugares descobertos viram lugares desta viagem; uma opção em branco para montar o dia */
            return Promise.all(estadoEx.descobertas.slice(0, 60).map(function (l) { return Banco.gravar('lugares', Object.assign({}, l, { viagem_id: v.id })); }))
              .then(function () { return Banco.gravar('roteiros', { viagem_id: v.id, nome: T('meuDia'), origem: 'manual', favorito: true, ordem: 1, dias: [{ ordem: 1, titulo: T('meuDia'), itens: [] }] }); })
              .then(function (r) { v.opcao_ativa = r.id; return Banco.gravar('viagens', v); });
          }).then(function (v) { return Contexto.definir('viagem', v.id); })
          .then(function () { g.avisar(T('viagemCriada')); return g.recarregarContexto(); }).then(function () { g.Nav.ir('mapa'); });
      }
    },

    /* salvar um lugar fora de viagem / pôr numa viagem */
    acoes: function (l, corpo) {
      var g = GX(), h = g.h, T = g.T, estado = g.estado;
      var salvo = estado.lugaresProprios.some(function (x) { return x.id === l.id; });
      if (!salvo) corpo.appendChild(h('button', { class: 'bt leve', type: 'button', texto: T('salvarLugar'), onclick: function () {
        Banco.gravar('lugares', Object.assign({}, l, { viagem_id: null })).then(function () { g.avisar(T('salvo')); return g.recarregarContexto(); }).then(function () { g.mostrar(estado.rota); });
      } }));
      corpo.appendChild(h('button', { class: 'bt leve', type: 'button', texto: '🧳 ' + T('porNumaViagem'), onclick: function () { Explorar.escolherViagem(l); } }));
    },
    escolherViagem: function (l) {
      var g = GX(), h = g.h, T = g.T;
      Banco.listar('viagens').then(function (vs) {
        vs.sort(function (a, b) { return a.inicio > b.inicio ? -1 : 1; });
        var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' });
        var j = g.janela(T('porNumaViagem'), corpo);
        if (!vs.length) corpo.appendChild(h('p', { class: 'sub', texto: T('semViagemTexto') }));
        vs.forEach(function (v) {
          corpo.appendChild(h('button', { class: 'bt leve', type: 'button', texto: v.nome + ' · ' + g.fData(v.inicio, true), onclick: function () {
            Banco.gravar('lugares', Object.assign({}, l, { id: l.id + ':' + v.id.slice(0, 8), viagem_id: v.id })).then(function () { j.fechar(); g.avisar(T('salvoNaViagem', { nome: v.nome })); });
          } }));
        });
      });
    }
  };

  window.Explorar = Explorar;
})();
