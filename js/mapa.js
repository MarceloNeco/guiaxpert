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
  var CORES = { confirmado: '#2f6e58', sugerido: '#e0b54f', salvo: '#6f63a6', outro: '#8a9aa0', logistica: '#3f5f6e', eu: '#2f6e58' };   /* Serra & Hortênsia */

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

  /* pino: número = ordem do programa no roteiro do dia (com a hora embaixo); escolhido = maior, com anel */
  function esc(t) { return String(t || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function curto(t) { t = String(t || '').split(/\s[–(-]\s?|,/)[0].trim(); return t.length > 22 ? t.slice(0, 21) + '…' : t; }
  /* nome ao lado do pino: gente lê nomes, não bolinhas (dono, 19/Nov) */
  function icone(cor, numero, grande, hora, escolhido, nome) {
    var tam = escolhido ? (numero != null ? 38 : 26) : grande ? 30 : 14;
    var rot = nome ? '<span class="pino-nome' + (numero != null ? ' do-dia' : '') + '">' + (numero != null && hora ? '<b>' + esc(hora) + '</b> ' : '') + esc(curto(nome)) + '</span>' : '';
    var html = numero != null
      ? '<span class="pino num' + (escolhido ? ' sel' : '') + '" style="background:' + cor + '">' + numero + '</span>' + (!nome && hora ? '<span class="pino-hora">' + hora + '</span>' : '') + rot
      : '<span class="pino' + (escolhido ? ' sel' : '') + '" style="background:' + cor + ';width:' + tam + 'px;height:' + tam + 'px"></span>' + rot;
    return L.divIcon({ className: 'pino-caixa', html: html, iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2] });
  }
  /* hotel: pino próprio com cama, sempre à vista nos dias da hospedagem */
  var CAMA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h2v8h6V8h7a3 3 0 0 1 3 3v8h-2v-3H5v3H3zm5 2.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z"/></svg>';
  function iconeHotel(nome, escolhido) {
    return L.divIcon({ className: 'pino-caixa', html: '<span class="pino-hotel' + (escolhido ? ' sel' : '') + '">' + CAMA + '</span><span class="pino-nome hotel">' + esc(curto(nome)) + '</span>', iconSize: [36, 36], iconAnchor: [18, 18] });
  }
  var atual = null;   /* a tela de mapa aberta agora (para o "Ver no mapa" focar sem recarregar) */

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
      var ultimoBf = null;
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
        var doDia = {};
        if (estado.soDia && op.itensDoDia) op.itensDoDia().forEach(function (it) { doDia[it.lugarId] = 1; });
        var itens = op.lugares().filter(function (l) {
          if (estado.soDia && op.itensDoDia && !doDia[l.id]) return false;   /* "Só o dia": a lista também mostra só os do dia */
          if (f === 'favoritos' && !estado.favoritos['lugar:' + l.id]) return false;
          if (f === 'paraVoces' && window.Gostos && Gostos.combina(l, soma) <= 0) return false;
          if (f === 'gratis' && !l.gratis) return false;
          if (['comer', 'atracao', 'bebidas', 'doces', 'logistica'].indexOf(f) > -1 && l.categoria !== f) return false;
          if (f === 'perto' && l.lat == null) return false;
          if (q) { l._nb = GX.notaBusca(l, q) || (GX.normalizar(T('cat_' + l.categoria)).indexOf(q) > -1 ? .5 : 0); if (!l._nb) return false; }
          return true;
        });
        var pos = estado.pos;
        if (pos) itens.forEach(function (l) { l._km = Geo.distancia(pos, l); });
        /* com busca: o nome mais parecido primeiro (Rua Coberta antes de quem só fica perto dela) */
        if (q && f !== 'perto') itens.sort(function (a, b) { return (b._nb - a._nb) || ((a._km == null ? 1e9 : a._km) - (b._km == null ? 1e9 : b._km)); });
        else if (f === 'paraVoces' && window.Gostos) itens.sort(function (a, b) { return Gostos.combina(b, soma) - Gostos.combina(a, soma); });
        else if (f === 'perto' || pos) itens.sort(function (a, b) { return (a._km == null ? 1e9 : a._km) - (b._km == null ? 1e9 : b._km); });
        return itens;
      }

      /* ---- painel ---- */
      /* a lista nunca sobe por cima da busca (com o teclado aberto a tela encolhe e ela tampava o que se digita) */
      function limitarPainel() {
        var r = tela.getBoundingClientRect(), tb = topo.getBoundingClientRect().bottom;
        if (r.height) painel.style.maxHeight = Math.max(90, Math.round(r.bottom - tb - 6)) + 'px';
      }
      window.addEventListener('resize', limitarPainel);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', limitarPainel);
      setTimeout(limitarPainel, 0);
      function estadoPainel(e) { limitarPainel(); painel.setAttribute('data-estado', e); alca.setAttribute('aria-label', e === 'resumo' ? T('abrirLista') : T('fecharLista')); }
      alca.addEventListener('click', function () { var e = painel.getAttribute('data-estado'); if (e === 'resumo' && escolhido) { abrirLugar(escolhido); return; } estadoPainel(e === 'resumo' ? 'lista' : 'resumo'); if (e === 'cartao') mostrarLista(); });
      /* arrastar a alça (toque) */
      var y0 = null;
      painel.addEventListener('touchstart', function (e) { if (e.target === alca || e.target === resumo || resumo.contains(e.target) || (painel.getAttribute('data-estado') === 'cartao' && corpo.scrollTop <= 0 && e.touches[0].clientY - painel.getBoundingClientRect().top < 90)) y0 = e.touches[0].clientY; }, { passive: true });
      painel.addEventListener('touchend', function (e) {
        if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null;
        var e0 = painel.getAttribute('data-estado');
        if (dy < -40) { if (e0 === 'resumo' && escolhido) abrirLugar(escolhido); else estadoPainel('lista'); }
        else if (dy > 40) { estadoPainel('resumo'); if (e0 === 'cartao') mostrarLista(); }
      }, { passive: true });

      /* ---- ROTA dentro do app: de onde você está (ou do hotel) até o lugar, pelas ruas ---- */
      var rota = null, camadaRota = null;
      function apagarRota() { if (camadaRota && mapa) { try { mapa.removeLayer(camadaRota); } catch (e) {} } camadaRota = null; rota = null; mostrarLista(); }
      function origemDaRota(l) {
        var hot = op.lugares().filter(function (x) { return x._hotel && x._ativo && x.lat != null && x.id !== l.id; })[0];
        var perto = function (p) { return p && p.lat != null && Geo.distancia(p, l) <= 80; };
        var doHotel = function () { return hot ? { lat: hot.lat, lng: hot.lng, nome: hot.nome } : null; };
        var eu = function (p) { return { lat: p.lat, lng: p.lng, nome: T('rotaVoce'), eu: true }; };
        if (perto(estado.pos)) return Promise.resolve(eu(estado.pos));
        if (estado.pos) return Promise.resolve(doHotel());   /* longe do lugar (ex.: planejando de casa): sai do hotel */
        return new Promise(function (ok) {
          var t = setTimeout(function () { ok(null); }, 8000);
          GX.pegarPosicao().then(function (p) { clearTimeout(t); ok(p); }, function () { clearTimeout(t); ok(null); });
        }).then(function (p) { return perto(p) ? eu(p) : doHotel(); });
      }
      function tracarRota(l, modo) {
        if (!l || l.lat == null) { GX.avisar(T('lugarSemPonto')); return; }
        modo = modo || (rota && rota.l.id === l.id && rota.modo) || 'carro';
        escolhido = l; rota = { l: l, modo: modo }; var minha = rota;
        estadoPainel('resumo'); desenharMapa(); mostrarLista();
        if (mapa) centrarAcima(l, Math.max(mapa.getZoom(), 14));
        origemDaRota(l).then(function (o) {
          if (rota !== minha) return;
          if (!o) { rota = null; mostrarLista(); GX.avisar(T('rotaSemOrigem')); return; }
          if (Geo.distancia(o, l) < 0.04) { rota = null; mostrarLista(); GX.avisar(T('rotaJaAqui')); return; }
          return Geo.rota(o, l, modo).then(function (r) {
            if (rota !== minha) return;
            rota.r = r; rota.de = o;
            desenharRota(); mostrarLista();
          });
        });
      }
      function desenharRota() {
        if (camadaRota && mapa) { try { mapa.removeLayer(camadaRota); } catch (e) {} }
        camadaRota = null;
        if (!rota || !rota.r || !mapa) return;
        var cor = rota.modo === 'pe' ? '#2e7d32' : '#1a73e8', ln = rota.r.linha;
        camadaRota = L.layerGroup([
          L.polyline(ln, { color: '#fff', weight: 10, opacity: .95, lineCap: 'round', lineJoin: 'round', interactive: false }),
          L.polyline(ln, { color: cor, weight: 6, opacity: 1, dashArray: rota.r.reta ? '10 12' : null, lineCap: 'round', lineJoin: 'round', interactive: false }),
          L.circleMarker(ln[0], { radius: 8, color: '#fff', weight: 3, fillColor: cor, fillOpacity: 1, interactive: false })
        ]).addTo(mapa);
        var r0 = caixa.getBoundingClientRect(), cima = Math.max(0, topo.getBoundingClientRect().bottom - r0.top);
        mapa.fitBounds(L.latLngBounds(ln), { paddingTopLeft: [36, cima + 36], paddingBottomRight: [72, painel.offsetHeight + 36], maxZoom: 17 });
      }
      function resumoRota() {
        var r = rota.r, l = rota.l, pe = rota.modo === 'pe';
        var txt = h('button', { class: 'rota-txt', type: 'button', title: T('abrirFicha'), onclick: function () { abrirLugar(l); } }, [
          h('b', { class: 'rota-tempo', texto: r ? (pe ? '🚶 ' : '🚗 ') + Geo.tempoTxt(r.min) + ' · ' + Geo.formatarKm(r.km) : T('rotaCalculando') }),
          h('span', { class: 'pequeno', texto: r ? T('rotaDeAte', { de: rota.de.nome, ate: l.nome }) : l.nome }),
          r && r.reta ? h('span', { class: 'pequeno rota-reta', texto: T('rotaReta') }) : null]);
        var fechar = h('button', { class: 'ic', type: 'button', 'aria-label': T('rotaSair'), title: T('rotaSair'), texto: '✕', onclick: apagarRota });
        var troca = h('button', { class: 'bt leve', type: 'button', texto: pe ? '🚗 ' + T('rotaCarro') : '🚶 ' + T('rotaPe'), onclick: function () { tracarRota(l, pe ? 'carro' : 'pe'); } });
        var gm = h('a', { class: 'bt sec', href: Geo.linkRota(l, rota.de && rota.de.eu ? null : rota.de, rota.modo), target: '_blank', rel: 'noopener', texto: '🔊 ' + T('rotaComVoz') });
        return h('div', { class: 'rota-resumo', role: 'status', 'aria-live': 'polite' }, [h('div', { class: 'rota-cab' }, [txt, fechar]), h('div', { class: 'rota-acoes' }, [troca, gm]),
          h('span', { class: 'rota-fonte', texto: T('rotaFonte') })]);
      }
      function mostrarLista() {
        var itens = filtrados();
        resumo.textContent = '';
        if (rota) {
          resumo.appendChild(resumoRota());
        } else if (escolhido) {
          /* ficha recolhida: o lugar escolhido continua à vista (nome + abrir de novo) */
          resumo.appendChild(h('button', { class: 'escolhido-peek', type: 'button', onclick: function () { abrirLugar(escolhido); } }, [h('span', { class: 'bolinha', style: 'background:' + corDe(escolhido) }),
            h('span', { class: 'peek-txt' }, [h('b', { texto: escolhido.nome }), h('span', { class: 'pequeno', texto: T('abrirFicha') })])]));
          resumo.appendChild(h('button', { class: 'ic', type: 'button', 'aria-label': T('fechar'), texto: '✕', onclick: function () { escolhido = null; desenharMapa(); mostrarLista(); } }));
        } else {
          resumo.appendChild(h('b', { texto: itens.length === 1 ? T('nLugar') : T('nLugares', { n: itens.length }) }));
          if (estado.pos && !Object.keys(diaMap).length) resumo.appendChild(h('span', { class: 'pequeno', texto: ' · ' + T('ordemDistancia') }));
          /* legenda das cores em palavras */
          resumo.appendChild(h('div', { class: 'legenda-mapa pequeno' }, [
            Object.keys(diaMap).length ? h('span', {}, [h('i', { class: 'lg num', style: 'background:' + CORES.sugerido, texto: '1' }), T('legRoteiro')]) : null,
            op.lugares().some(function (l) { return l._hotel && l._ativo; }) ? h('span', {}, [h('i', { class: 'lg hotel', svg: CAMA }), T('legHotel')]) : null,
            h('span', {}, [h('i', { class: 'lg', style: 'background:' + CORES.salvo }), T('legGuardado')]),
            h('span', {}, [h('i', { class: 'lg', style: 'background:' + CORES.outro }), T('legOutros')])]));
        }
        if (!rota) resumo.appendChild(h('button', { class: 'bt leve', type: 'button', style: 'margin-left:auto;min-height:2.5rem', onclick: function () { estadoPainel('lista'); } }, T('lista')));
        corpo.textContent = '';
        var lista = h('div', { class: 'lista-lugares' });
        itens.slice(0, 200).forEach(function (l) {
          var lin = h('button', { class: 'linha-lugar', type: 'button', onclick: function () { abrirLugar(l); } }, [
            h('span', { class: 'bolinha', style: 'background:' + corDe(l) }),
            h('span', { class: 'txt' }, [h('b', { texto: l.nome }), h('span', { class: 'pequeno', texto: [l.subcategoria ? GX.nomeSub(l.subcategoria) : T('cat_' + l.categoria), l._km != null ? Geo.formatarKm(l._km) : null, l.gratis ? T('gratis') : null].filter(Boolean).join(' · ') })]),
            estado.favoritos['lugar:' + l.id] ? h('span', { class: 'estrela', texto: '★' }) : null
          ]);
          lista.appendChild(lin);
        });
        if (!itens.length) lista.appendChild(h('p', { class: 'sub', style: 'padding:1rem', texto: estado.filtro === 'paraVoces' && !Object.keys(GX.somaGostos()).length ? T('semGostosAinda') : T('nadaAchado') }));
        /* destino sem guia pronto e sem lugares ainda: o primeiro passo fica à vista, não escondido no fim da lista */
        if (!itens.length && !(estado.busca || '').trim() && op.buscarPerto && estado.filtro === 'todos') {
          resumo.appendChild(h('div', { class: 'painel-acoes' }, [h('button', { class: 'bt', type: 'button', texto: '🔎 ' + T('descobrirBotao'), onclick: function (e) { e.currentTarget.disabled = true; e.currentTarget.textContent = T('procurandoPerto'); op.buscarPerto(); } }),
            h('span', { class: 'pequeno', texto: T('podeDemorar') })]));
        }
        /* não achou aqui? procura na internet pelo nome ou endereço (só quando a pessoa toca) */
        var q = (estado.busca || '').trim();
        if (q.length >= 3 && op.buscarFora && !navigator.onLine) {
          corpo.appendChild(h('p', { class: 'sub busca-offline', style: 'margin:.6rem 1rem', texto: T(itens.length ? 'buscaOfflineAlgum' : 'buscaOfflineNada', { q: q }) }));
        } else if (q.length >= 3 && op.buscarFora) {
          var bf = h('button', { class: 'bt sec', type: 'button', style: 'margin:.5rem 1rem', texto: '🔎 ' + T('buscarNaInternet', { q: q }) });
          ultimoBf = bf;
          bf.addEventListener('click', function () {
            if (!navigator.onLine) { GX.avisar(T('semInternet')); return; }
            bf.disabled = true; bf.textContent = T('carregando');
            op.buscarFora(q).then(function (achados) {
              /* os achados da internet aparecem numa seção própria, embaixo da busca (não se misturam com o catálogo,
                 a busca não se apaga e o mapa não pula para longe). Tocar num deles abre o cartão e marca no mapa. */
              var longe = achados.longe || [];
              var sec = h('div', { class: 'net-sec' }, [h('p', { class: 'sub', style: 'margin:.6rem 1rem .2rem', texto: '🌐 ' + T('naInternetPerto', { q: q }) })]);
              function linhaNet(l) {
                return h('button', { class: 'linha-lugar', type: 'button', onclick: function () {
                  op.acrescentar([l]); desenharMapa(); abrirLugar(l);
                  if (mapa && l.lat != null) mapa.setView([l.lat, l.lng], 16);
                } }, [h('span', { class: 'bolinha', style: 'background:' + CORES.outro }),
                  h('span', { class: 'txt' }, [h('b', { texto: l.nome }), h('span', { class: 'pequeno', texto: [l.endereco, l.longe ? '📍 ' + T('bscLonge') : null, l.fonte || 'OpenStreetMap'].filter(Boolean).join(' · ') })])]);
              }
              achados.forEach(function (l) { sec.appendChild(linhaNet(l)); });
              if (!achados.length) sec.appendChild(h('p', { class: 'pequeno', style: 'margin:0 1rem', texto: T('nadaPertoDaViagem') }));
              if (longe.length) {
                var vl = h('button', { class: 'lk', type: 'button', style: 'margin:.3rem 1rem', texto: '🌎 ' + T('verLonge', { n: longe.length }) });
                vl.addEventListener('click', function () { vl.remove(); longe.forEach(function (l) { sec.appendChild(linhaNet(l)); }); });
                sec.appendChild(vl);
              }
              if (op.acharJuntos) {
                var aj = h('button', { class: achados.length ? 'bt leve' : 'bt', type: 'button', style: 'margin:.4rem 1rem', texto: '🤝 ' + T(achados.length ? 'naoEnenhum' : 'acharJuntos') });
                aj.addEventListener('click', function () { op.acharJuntos(q, function (n) { estado.busca = ''; campo.value = ''; redesenhar(); abrirLugar(n); if (mapa && n.lat != null) mapa.setView([n.lat, n.lng], 16); }); });
                sec.appendChild(aj);
              }
              if (achados.some(function (l) { return l.confianca === 'foursquare'; })) sec.appendChild(h('p', { class: 'pequeno', style: 'margin:0 1rem', texto: 'Powered by Foursquare · OpenStreetMap' }));
              bf.replaceWith(sec);
            }).catch(function () { bf.disabled = false; bf.textContent = T('osmErro'); });
          });
          lista.insertBefore(bf, lista.firstChild);
          /* nada achado: os próximos passos ficam à vista já no resumo (sem precisar abrir a lista) */
          if (!itens.length) {
            /* um botão só: o do resumo; o da lista fica escondido até ele ser usado (antes apareciam os dois juntos) */
            bf.hidden = true;
            var acoes = h('div', { class: 'painel-acoes' });
            if (op.irPara) acoes.appendChild(h('button', { class: 'bt sec', type: 'button', texto: '🗺 ' + T('irAteLa'), title: T('irParaNoMapa', { q: q }), onclick: function () { op.irPara(q); } }));
            acoes.appendChild(h('button', { class: 'bt leve', type: 'button', texto: '🔎 ' + T('procurarNaInternet'), title: T('buscarNaInternetCurto', { q: q }), onclick: function (e) { e.currentTarget.disabled = true; bf.hidden = false; estadoPainel('lista'); bf.click(); } }));
            resumo.appendChild(acoes);
          }
        }
        if (op.rodape) lista.appendChild(op.rodape());
        corpo.appendChild(lista);
      }

      var escolhido = null;
      /* centra o lugar na parte de cima que fica livre acima da ficha (o pino não some atrás dela) */
      function centrarAcima(l, zoom) {
        if (!mapa || l.lat == null) return;
        var z = zoom || Math.max(mapa.getZoom(), 15), alt = caixa.clientHeight || 600, e = painel.getAttribute('data-estado');
        var r0 = caixa.getBoundingClientRect(), cima = Math.max(0, topo.getBoundingClientRect().bottom - r0.top);
        var baixo = alt - (e === 'resumo' ? painel.offsetHeight : alt * (e === 'cartao' ? .56 : .62));
        var alvoY = (cima + Math.max(cima + 60, baixo)) / 2;   /* meio da faixa livre entre a busca e a ficha */
        var p = mapa.project([l.lat, l.lng], z).add([0, alt / 2 - alvoY]);
        mapa.setView(mapa.unproject(p, z), z, { animate: true });
      }
      function abrirLugar(l) {
        escolhido = l; desenharMapa();
        corpo.textContent = '';
        var det = GX.cartaoLugar(l, GX.restricoesDoGrupo());
        det.open = true; det.classList.add('no-painel');
        corpo.appendChild(h('button', { class: 'lk', type: 'button', style: 'margin:.5rem 0 0 .25rem', texto: '‹ ' + T('lista'), onclick: function () { escolhido = null; desenharMapa(); mostrarLista(); estadoPainel('lista'); } }));
        corpo.appendChild(det);
        var it = diaMap[l.id];
        if (it) { var mt = det.querySelector('summary .meta') || det.querySelector('summary'); mt.insertBefore(h('span', { class: 'etq do-dia', texto: T('nDoDia', { n: it.n, h: it.hora || '—' }) }), mt.firstChild); }
        estadoPainel('cartao');
        centrarAcima(l);
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
        /* numera só o que dá para pôr no mapa, na ordem da hora: 1, 2, 3… sem pular (antes contava itens sem lugar e pulava números) */
        var todosL = {}; op.lugares().forEach(function (l) { todosL[l.id] = l; });
        var n = 0;
        itensDia.slice().sort(function (a, b) { return (a.hora || '99') < (b.hora || '99') ? -1 : 1; }).forEach(function (it) {
          var l = todosL[it.lugarId]; if (!l || l.lat == null || diaMap[it.lugarId]) return;
          diaMap[it.lugarId] = Object.assign({ n: ++n }, it);
        });
        var vis = filtrados();
        if (escolhido && vis.indexOf(escolhido) < 0) vis = vis.concat([escolhido]);
        var dia = itensDia.length ? Object.keys(diaMap).map(function (id) { return todosL[id]; }) : [];
        dia.forEach(function (l) { if (vis.indexOf(l) < 0) vis.push(l); });   /* os do dia sempre aparecem, mesmo com filtro */
        /* longe (zoom baixo), sem busca nem filtro: só os do dia, os guardados e o escolhido; os cinzas aparecem ao aproximar */
        var poucos = Object.keys(diaMap).length > 0 && mapa.getZoom() < 14 && !(estado.busca || '').trim() && (estado.filtro || 'todos') === 'todos';
        var pontos = [];
        vis.forEach(function (l) {
          if (l.lat == null || l._hotel) return;
          var it = diaMap[l.id], sel = escolhido && escolhido.id === l.id;
          if (estado.soDia && !it && !sel) return;
          if (poucos && !it && !sel && corDe(l) === CORES.outro) return;
          var cor = corDe(l), z = mapa.getZoom();
          /* nomes: do roteiro sempre; guardados de perto (zoom 14+); os outros só bem de perto (16+), para não virar sopa de letras */
          var comNome = sel || it || (cor !== CORES.outro && z >= 14) || z >= 17;
          var mk = L.marker([l.lat, l.lng], { icon: icone(cor, it ? it.n : null, !!it, it && it.hora, sel, comNome ? l.nome : null), zIndexOffset: sel ? 3000 : it ? 1000 : cor !== CORES.outro ? 500 : 0, title: l.nome, keyboard: false });
          mk.on('click', function () { abrirLugar(l); });
          mk.addTo(mapa); camadas.push(mk);
          if (it) pontos[it.n - 1] = [l.lat, l.lng];
        });
        /* hotéis dos dias escolhidos: sempre, com qualquer filtro ou zoom */
        op.lugares().forEach(function (l) {
          if (!l._hotel || l.lat == null) return;
          var sel = escolhido && escolhido.id === l.id;
          if (!l._ativo && !sel) return;
          var mh = L.marker([l.lat, l.lng], { icon: iconeHotel(l.nome, sel), zIndexOffset: sel ? 3500 : 2500, title: l.nome, keyboard: false });
          mh.on('click', function () { abrirLugar(l); });
          mh.addTo(mapa); camadas.push(mh);
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
      function focar(id, ficha) {
        var alvo = op.lugares().filter(function (l) { return l.id === id; })[0] || (escolhido && escolhido.id === id ? escolhido : null);
        if (!alvo) return false;
        if (ficha) { if (alvo.lat != null) mapa.setView([alvo.lat, alvo.lng], 16); abrirLugar(alvo); return true; }
        estadoPainel('resumo'); abrirLugar(alvo); estadoPainel('resumo'); mostrarLista(); centrarAcima(alvo, 16);
        return true;
      }
      function centrarEmMim() { if (mapa && estado.pos) mapa.setView([estado.pos.lat, estado.pos.lng], Math.max(mapa.getZoom(), 14)); }
      campo.addEventListener('input', function () { estado.busca = campo.value; redesenhar(); if (campo.value) estadoPainel('lista'); });
      campo.addEventListener('focus', function () { setTimeout(limitarPainel, 300); setTimeout(limitarPainel, 700); });
      /* Enter: com algo no mapa, abre a lista; sem nada, vai até o lugar (cidade, estado, país) no Explorar ou procura na internet */
      function procurarFora() { if (!ultimoBf) return; ultimoBf.hidden = false; estadoPainel('lista'); if (!ultimoBf.disabled) ultimoBf.click(); }
      campo.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var q = campo.value.trim(); if (q.length < 2) return;
        estado.busca = campo.value; redesenhar();
        /* parece endereço (número, rua, avenida): vai direto ao ponto no mapa */
        var endereco = /\d/.test(q) || /^(rua|r\.|av\.?|avenida|estrada|travessa|alameda|rodovia|pra[cç]a|street|st\.?)\s/i.test(q);
        if (endereco && op.irPara && (/\d/.test(q) || !filtrados().length)) { op.irPara(q, function () { if (filtrados().length) estadoPainel('lista'); else procurarFora(); }); return; }
        if (filtrados().length) { estadoPainel('lista'); return; }
        if (op.irPara) op.irPara(q, procurarFora); else procurarFora();
      });

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
        var z0 = mapa.getZoom();
        mapa.on('zoomend', function () { var z = mapa.getZoom(); if ((z < 14) !== (z0 < 14) || (z < 17) !== (z0 < 17)) desenharMapa(); z0 = z; });
        desenharMapa();
        /* abre mostrando o dia inteiro (todos os programas numerados à vista, entre a busca e o painel) */
        var pts = Object.keys(diaMap).map(function (id) { var l = op.lugares().filter(function (x) { return x.id === id; })[0]; return l && l.lat != null ? [l.lat, l.lng] : null; }).filter(Boolean);
        if (pts.length) op.lugares().forEach(function (l) { if (l._hotel && l._ativo && l.lat != null) pts.push([l.lat, l.lng]); });   /* o hotel entra no enquadramento do dia */
        if (!estado.abrirLugar && pts.length) {
          var r0 = caixa.getBoundingClientRect(), cima = Math.max(0, topo.getBoundingClientRect().bottom - r0.top);
          if (pts.length === 1) mapa.setView(pts[0], 15);
          else mapa.fitBounds(pts, { paddingTopLeft: [40, cima + 40], paddingBottomRight: [130, painel.offsetHeight + 30], maxZoom: 16 });
          desenharMapa();
        }
        if (!estado.abrirLugar) mostrarLista();
        if (estado.abrirLugar) {
          var alvo = op.lugares().filter(function (l) { return l.id === estado.abrirLugar; })[0];
          estado.abrirLugar = null;
          if (alvo && alvo.lat != null && estado.abrirPeek) focar(alvo.id);   /* "Ver no mapa": mapa à vista, pino em destaque, ficha a um toque */
          else if (alvo) { if (alvo.lat != null) mapa.setView([alvo.lat, alvo.lng], 16); abrirLugar(alvo); }
          else GX.avisar(T('lugarSemPonto'));
          estado.abrirPeek = false;
        }
        if (estado.abrirRota) {   /* "Rota" tocado fora do mapa */
          var ar = op.lugares().filter(function (l) { return l.id === estado.abrirRota; })[0];
          estado.abrirRota = null;
          if (ar) tracarRota(ar);
        }
        if (op.aoPronto) op.aoPronto(mapa, { redesenhar: redesenhar });
      }).catch(function () { caixa.textContent = T('mapaErro'); });

      var api = { redesenhar: redesenhar, abrir: abrirLugar, focar: focar, rota: function (id) { var l = op.lugares().filter(function (x) { return x.id === id; })[0]; if (!l || !mapa) return false; tracarRota(l); return true; }, mapa: function () { return mapa; }, tela: tela };
      atual = api;
      return api;
    },

    /* fundo do mapa: por enquanto OSM online; mapa offline por cidade entra na fatia B (offline.js) */
    fundo: function (m, cidade) {
      var osm = function () { if (m && m._container) L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m); };
      if (!window.Offline) { osm(); return; }
      Offline.fundo(m, cidade).then(function (ok) { if (!ok) osm(); });
    },

    cores: CORES,

    /* "Marcar eu mesmo no mapa": folha cheia com o mapa e um pino fixo no centro; a pessoa arrasta o mapa
       e toca em "É aqui". op: { centro, zoom, cidade, titulo }. Resolve { lat, lng } ou null. */
    escolherPonto: function (op) {
      op = op || {};
      var GX = window.GX, h = GX.h, T = GX.T;
      return new Promise(function (resolver) {
        var caixa = h('div', { class: 'mapa-caixa escolher', 'aria-label': T('mapaDoLugar') });
        var pino = h('div', { class: 'pino-centro', 'aria-hidden': 'true', texto: '📍' });
        var ok = h('button', { class: 'bt cheio', type: 'button', texto: '✓ ' + T('eAqui') });
        var gps = h('button', { class: 'bt leve', type: 'button', texto: '📍 ' + T('usarOndeEstou') });
        var corpo = h('div', { class: 'escolher-ponto' }, [h('p', { class: 'sub', texto: T('arrasteOMapa') }), h('div', { class: 'escolher-mapa' }, [caixa, pino]), h('div', { class: 'linha' }, [gps, ok])]);
        var respondido = false, m = null;
        var j = GX.janela(op.titulo || T('marcarNoMapa'), corpo, function () { if (m) { try { m.remove(); } catch (e) {} } if (!respondido) { respondido = true; resolver(null); } });
        j.caixa.classList.add('cheia');
        carregarLeaflet().then(function (lf) {
          var c = op.centro || GX.estado.pos || { lat: -15.78, lng: -47.93 };
          m = lf.map(caixa, { zoomControl: true, attributionControl: true }).setView([c.lat, c.lng], op.zoom || (op.centro ? 15 : 4));
          L = L || lf; Mapa.fundo(m, op.cidade);
          setTimeout(function () { m.invalidateSize(); }, 150);
        }).catch(function () { caixa.textContent = T('mapaErro'); });
        gps.addEventListener('click', function () { GX.pegarPosicao().then(function (p) { if (m) m.setView([p.lat, p.lng], 16); }).catch(function () {}); });
        ok.addEventListener('click', function () {
          if (!m) return;
          var c = m.getCenter(); respondido = true;
          j.fechar(function () { resolver({ lat: +c.lat.toFixed(5), lng: +c.lng.toFixed(5) }); });
        });
      });
    },
    /* "Ver no mapa" com a tela de mapa já aberta: centra e destaca o pino sem recarregar */
    atualizar: function () { if (atual && atual.tela && atual.tela.isConnected) atual.redesenhar(); },
    focar: function (id, ficha) { return !!(atual && atual.tela && atual.tela.isConnected && mapa && atual.focar(id, ficha)); },
    rota: function (id) { return !!(atual && atual.tela && atual.tela.isConnected && mapa && atual.rota(id)); },
    destruir: function () { if (mapa) { try { mapa.remove(); } catch (e) {} mapa = null; camadas = []; } }
  };

  window.Mapa = Mapa;
})();
