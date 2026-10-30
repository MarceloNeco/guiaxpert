/* =====================================================================
   mapa.js — o Mapa do GuiaXpert (uma tela só: mapa + lista + cartão)

   Serve aos dois contextos:
   - VIAGEM: lugares do pacote + os meus desta viagem + descobertas; os
     itens do dia escolhido aparecem numerados, ligados por uma linha.
   - EXPLORAR: salvos (sem viagem) + descobertas em volta de onde estou.
   Cores (placas de estrada): verde = confirmado no dia; amarelo = no dia,
   ainda sugestão; marrom = salvo/favorito; cinza = outros do lugar.
   O painel de baixo tem 3 alturas: resumo, lista, cartão de um lugar.
   Depende dos ajudantes que app.js publica em window.GX.
   ===================================================================== */
(function () {
  'use strict';
  var mapa = null, camadas = [], L = null, leafletPromessa = null;
  var CORES = { confirmado: '#0e5a43', sugerido: '#f2b705', salvo: '#6a3a1c', outro: '#8a9aa0', logistica: '#172024', eu: '#0e5a43' };

  function carregarLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromessa) return leafletPromessa;
    leafletPromessa = new Promise(function (ok, erro) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'vendor/leaflet/leaflet.css'; document.head.appendChild(css);
      var s = document.createElement('script'); s.src = 'vendor/leaflet/leaflet.js';
      s.onload = function () { ok(window.L); }; s.onerror = function () { leafletPromessa = null; erro(new Error('leaflet')); };
      document.head.appendChild(s);
    });
    return leafletPromessa;
  }

  function icone(cor, numero, grande) {
    var tam = grande ? 30 : 14;
    var html = numero != null
      ? '<span class="pino num" style="background:' + cor + '">' + numero + '</span>'
      : '<span class="pino" style="background:' + cor + ';width:' + tam + 'px;height:' + tam + 'px"></span>';
    return L.divIcon({ className: 'pino-caixa', html: html, iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2] });
  }

  var Mapa = {
    /* opcoes: { lugares(), itensDoDia(), centro, zoom, aoAbrir(l), acoesLugar(l, corpo), topo, modo } */
    tela: function (tela, op) {
      var GX = window.GX, h = GX.h, T = GX.T, estado = GX.estado;
      tela.classList.add('mapa-tela');
      var topo = h('div', { class: 'mapa-topo' });
      var caixa = h('div', { id: 'mapa', role: 'application', 'aria-label': T('rota_mapa') });
      var painel = h('div', { class: 'painel', 'data-estado': 'resumo' });
      var alca = h('button', { class: 'alca', type: 'button', 'aria-label': T('abrirLista') });
      var resumo = h('div', { class: 'painel-resumo' });
      var corpo = h('div', { class: 'painel-corpo' });
      painel.appendChild(alca); painel.appendChild(resumo); painel.appendChild(corpo);
      tela.appendChild(topo); tela.appendChild(caixa); tela.appendChild(painel);
      if (op.topo) op.topo(topo);

      /* busca + filtros (os mesmos da lista antiga) */
      var FILTROS = op.filtros || ['todos', 'paraVoces', 'favoritos', 'perto', 'comer', 'atracao', 'gratis', 'bebidas', 'doces', 'logistica'];
      var caixaBusca = h('div', { class: 'busca-caixa', svg: GX.ICONES.lupa });
      var campo = h('input', { type: 'search', id: 'gx-busca-lugares', placeholder: T('buscarLugarDica'), 'aria-label': T('buscar'), value: estado.busca || '', autocomplete: 'off' });
      caixaBusca.appendChild(campo); topo.appendChild(caixaBusca);
      var chips = h('div', { class: 'chips rolar', role: 'group', 'aria-label': T('filtrar') });
      topo.appendChild(chips);
      function desenharChips() {
        chips.textContent = '';
        if (op.itensDoDia) chips.appendChild(h('button', { class: 'chip', type: 'button', 'aria-pressed': estado.soDia ? 'true' : 'false', onclick: function () { estado.soDia = !estado.soDia; redesenhar(); } }, '📅 ' + T('soODia')));
        FILTROS.forEach(function (f) {
          chips.appendChild(h('button', { class: 'chip', type: 'button', 'aria-pressed': estado.filtro === f ? 'true' : 'false', onclick: function () {
            estado.filtro = f;
            if (f === 'perto' && !estado.pos) { GX.pegarPosicao().then(function () { redesenhar(); centrarEmMim(); }).catch(function () {}); return; }
            redesenhar();
          } }, T('f_' + f)));
        });
      }

      function filtrados() {
        var q = GX.normalizar(estado.busca).trim(), f = estado.filtro, soma = GX.somaGostos();
        var itens = op.lugares().filter(function (l) {
          if (f === 'favoritos' && !estado.favoritos['lugar:' + l.id]) return false;
          if (f === 'paraVoces' && window.Gostos && Gostos.combina(l, soma) <= 0) return false;
          if (f === 'gratis' && !l.gratis) return false;
          if (['comer', 'atracao', 'bebidas', 'doces', 'logistica'].indexOf(f) > -1 && l.categoria !== f) return false;
          if (f === 'perto' && l.lat == null) return false;
          if (q && GX.normalizar([l.nome, l.descricao, l.endereco, l.subcategoria, T('cat_' + l.categoria)].join(' ')).indexOf(q) < 0) return false;
          return true;
        });
        var pos = estado.pos;
        if (pos) itens.forEach(function (l) { l._km = Geo.distancia(pos, l); });
        if (f === 'paraVoces' && window.Gostos) itens.sort(function (a, b) { return Gostos.combina(b, soma) - Gostos.combina(a, soma); });
        else if (f === 'perto' || pos) itens.sort(function (a, b) { return (a._km == null ? 1e9 : a._km) - (b._km == null ? 1e9 : b._km); });
        return itens;
      }

      /* ---- painel ---- */
      function estadoPainel(e) { painel.setAttribute('data-estado', e); alca.setAttribute('aria-label', e === 'resumo' ? T('abrirLista') : T('fecharLista')); }
      alca.addEventListener('click', function () { estadoPainel(painel.getAttribute('data-estado') === 'resumo' ? 'lista' : 'resumo'); });
      /* arrastar a alça (toque) */
      var y0 = null;
      painel.addEventListener('touchstart', function (e) { if (e.target === alca || e.target === resumo || resumo.contains(e.target)) y0 = e.touches[0].clientY; }, { passive: true });
      painel.addEventListener('touchend', function (e) {
        if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null;
        if (dy < -40) estadoPainel('lista'); else if (dy > 40) estadoPainel('resumo');
      }, { passive: true });

      function mostrarLista() {
        var itens = filtrados();
        resumo.textContent = '';
        resumo.appendChild(h('b', { texto: T('nLugares', { n: itens.length }) }));
        if (estado.pos) resumo.appendChild(h('span', { class: 'pequeno', texto: ' · ' + T('ordemDistancia') }));
        resumo.appendChild(h('button', { class: 'bt leve', type: 'button', style: 'margin-left:auto;min-height:2.5rem', onclick: function () { estadoPainel('lista'); } }, T('lista')));
        corpo.textContent = '';
        var lista = h('div', { class: 'lista-lugares' });
        itens.slice(0, 200).forEach(function (l) {
          var lin = h('button', { class: 'linha-lugar', type: 'button', onclick: function () { abrirLugar(l); } }, [
            h('span', { class: 'bolinha', style: 'background:' + corDe(l) }),
            h('span', { class: 'txt' }, [h('b', { texto: l.nome }), h('span', { class: 'pequeno', texto: [l.subcategoria ? T('sub_' + l.subcategoria) : T('cat_' + l.categoria), l._km != null ? Geo.formatarKm(l._km) : null, l.gratis ? T('gratis') : null].filter(Boolean).join(' · ') })]),
            estado.favoritos['lugar:' + l.id] ? h('span', { class: 'estrela', texto: '★' }) : null
          ]);
          lista.appendChild(lin);
        });
        if (!itens.length) lista.appendChild(h('p', { class: 'sub', style: 'padding:1rem', texto: estado.filtro === 'paraVoces' && !Object.keys(GX.somaGostos()).length ? T('semGostosAinda') : T('nadaAchado') }));
        if (op.rodape) lista.appendChild(op.rodape());
        corpo.appendChild(lista);
      }

      function abrirLugar(l) {
        corpo.textContent = '';
        var det = GX.cartaoLugar(l, GX.restricoesDoGrupo());
        det.open = true; det.classList.add('no-painel');
        corpo.appendChild(h('button', { class: 'lk', type: 'button', style: 'margin:.5rem 0 0 .25rem', texto: '‹ ' + T('lista'), onclick: function () { mostrarLista(); estadoPainel('lista'); } }));
        corpo.appendChild(det);
        estadoPainel('cartao');
        if (mapa && l.lat != null) mapa.panTo([l.lat, l.lng], { animate: true });
        if (op.aoAbrir) op.aoAbrir(l);
      }

      /* ---- mapa ---- */
      function corDe(l) {
        if (l.categoria === 'logistica') return CORES.logistica;
        var it = (diaMap[l.id]);
        if (it) return it.estado === 'confirmado' ? CORES.confirmado : CORES.sugerido;
        if (estado.favoritos['lugar:' + l.id] || l.confianca === 'meu') return CORES.salvo;
        return CORES.outro;
      }
      var diaMap = {};
      function limpar() { camadas.forEach(function (c) { try { mapa.removeLayer(c); } catch (e) {} }); camadas = []; }
      function desenharMapa() {
        if (!mapa) return;
        limpar();
        diaMap = {};
        var itensDia = op.itensDoDia ? op.itensDoDia() : [];
        itensDia.forEach(function (it, i) { if (it.lugarId) diaMap[it.lugarId] = Object.assign({ n: i + 1 }, it); });
        var vis = filtrados();
        var pontos = [];
        vis.forEach(function (l) {
          if (l.lat == null) return;
          var it = diaMap[l.id];
          if (estado.soDia && !it) return;
          var mk = L.marker([l.lat, l.lng], { icon: icone(corDe(l), it ? it.n : null, !!it), zIndexOffset: it ? 1000 : 0, title: l.nome, keyboard: false });
          mk.on('click', function () { abrirLugar(l); });
          mk.addTo(mapa); camadas.push(mk);
          if (it) pontos[it.n - 1] = [l.lat, l.lng];
        });
        pontos = pontos.filter(Boolean);
        if (pontos.length > 1) {
          var linha = L.polyline(pontos, { color: CORES.confirmado, weight: 3, opacity: .7, dashArray: '2 8', lineCap: 'round' }).addTo(mapa);
          camadas.push(linha);
        }
        if (estado.pos) {
          var eu = L.marker([estado.pos.lat, estado.pos.lng], { icon: L.divIcon({ className: 'pino-caixa', html: '<span class="pino eu"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 2000 }).addTo(mapa);
          eu.bindTooltip(T('voceAqui')); camadas.push(eu);
        }
        if (op.aoDesenhar) op.aoDesenhar(mapa, vis);
      }
      function redesenhar() { desenharChips(); desenharMapa(); if (painel.getAttribute('data-estado') !== 'cartao') mostrarLista(); }
      function centrarEmMim() { if (mapa && estado.pos) mapa.setView([estado.pos.lat, estado.pos.lng], Math.max(mapa.getZoom(), 14)); }
      campo.addEventListener('input', function () { estado.busca = campo.value; redesenhar(); if (campo.value) estadoPainel('lista'); });

      /* botão "onde estou" flutuante */
      var btEu = h('button', { class: 'bt-mapa', type: 'button', 'aria-label': T('ondeEstou'), svg: GX.ICONES.alvo, onclick: function () {
        GX.pegarPosicao().then(function () { redesenhar(); centrarEmMim(); }).catch(function () {});
      } });
      caixa.appendChild(btEu);

      desenharChips();
      mostrarLista();
      carregarLeaflet().then(function (lf) {
        L = lf;
        if (mapa) { try { mapa.remove(); } catch (e) {} mapa = null; }
        var c = op.centro || estado.pos || { lat: -15.78, lng: -47.93 };
        mapa = L.map(caixa, { zoomControl: false, attributionControl: true }).setView([c.lat, c.lng], op.zoom || (op.centro ? 13 : 4));
        L.control.zoom({ position: 'topright' }).addTo(mapa);
        Mapa.fundo(mapa, op.cidade);
        desenharMapa();
        if (estado.abrirLugar) {
          var alvo = op.lugares().filter(function (l) { return l.id === estado.abrirLugar; })[0];
          estado.abrirLugar = null;
          if (alvo) { abrirLugar(alvo); if (alvo.lat != null) mapa.setView([alvo.lat, alvo.lng], 15); }
        }
        if (op.aoPronto) op.aoPronto(mapa, { redesenhar: redesenhar });
      }).catch(function () { caixa.textContent = T('mapaErro'); });

      return { redesenhar: redesenhar, abrir: abrirLugar, mapa: function () { return mapa; } };
    },

    /* fundo do mapa: por enquanto OSM online; mapa offline por cidade entra na fatia B (offline.js) */
    fundo: function (m, cidade) {
      var osm = function () { if (m && m._container) L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m); };
      if (!window.Offline) { osm(); return; }
      Offline.fundo(m, cidade).then(function (ok) { if (!ok) osm(); });
    },

    cores: CORES,
    destruir: function () { if (mapa) { try { mapa.remove(); } catch (e) {} mapa = null; camadas = []; } }
  };

  window.Mapa = Mapa;
})();
