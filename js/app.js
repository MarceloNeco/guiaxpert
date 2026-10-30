/* =====================================================================
   app.js — telas do GuiaXpert

   MAPA DO ARQUIVO
   1. utilidades (h, T, avisar)           5. telas: Hoje, Roteiro, Lugares, Mapa
   2. estado e carregamento               6. telas: Reservas, Família, Viagens
   3. navegação e botão Voltar (Nav)      7. wizard "Nova viagem"
   4. moldura: gaveta ☰, barra, busca     8. entrar (acesso), conta, configurações
   Regras: texto só por T('chave') (PT e EN em textos.js); conteúdo da pessoa
   nunca vai por innerHTML (só textContent, via h()); histórico só pelo Nav.
   ===================================================================== */
(function () {
  'use strict';
  var d = document, $ = function (id) { return d.getElementById(id); };
  var VERSAO_APP = '0.4.0';

  /* ------------------------------------------------------------------
     1. UTILIDADES
     ------------------------------------------------------------------ */
  function idioma() { return (window.DGO && DGO.idioma && DGO.idioma()) || estado.idioma || 'pt'; }
  function T(k, vars, lg) {
    var e = window.TEXTOS[k], s = e ? (e[lg || idioma()] || e.pt) : k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  }
  /* cria elemento com segurança: texto vira textContent, nunca HTML */
  function h(tag, attrs, filhos) {
    var el = d.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'texto') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else if (k === 'svg') el.innerHTML = v; /* só ícones fixos do próprio código */
      else el.setAttribute(k, v === true ? '' : v);
    });
    (Array.isArray(filhos) ? filhos : [filhos]).forEach(function (f) {
      if (f == null || f === false) return;
      el.appendChild(typeof f === 'string' || typeof f === 'number' ? d.createTextNode(String(f)) : f);
    });
    return el;
  }
  var relogioAviso;
  function avisar(msg) {
    var t = $('gx-toast');
    if (!t) { t = h('div', { id: 'gx-toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); d.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(relogioAviso); relogioAviso = setTimeout(function () { t.hidden = true; }, 3500);
  }
  var MESES = { pt: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
  var SEMANA = { pt: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
  function dataDe(iso) { var p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(dt) { return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2); }
  /* datas no padrão SolverONE: PT 17/Set/2026 · EN Sep/17/2026 */
  function fData(i, curta) {
    if (!i) return '';
    var dt = dataDe(i), m = MESES[idioma()][dt.getMonth()];
    if (curta) return idioma() === 'en' ? m + '/' + dt.getDate() : dt.getDate() + '/' + m;
    return idioma() === 'en' ? m + '/' + dt.getDate() + '/' + dt.getFullYear() : dt.getDate() + '/' + m + '/' + dt.getFullYear();
  }
  function semana(i) { return SEMANA[idioma()][dataDe(i).getDay()]; }
  function hojeIso() { return iso(new Date()); }
  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  var ICONES = {
    hoje: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    roteiro: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    lugares: '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    mapa: '<svg viewBox="0 0 24 24"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
    reservas: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5h8v2M3 12h18"/></svg>',
    lupa: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/></svg>'
  };
  /* pictogramas da placa turística (desenhos simples, sem fonte externa) */
  var PICTO = {
    comer: '<svg viewBox="0 0 24 24"><path d="M7 2v9a2 2 0 0 0 2 2v9h2v-9a2 2 0 0 0 2-2V2h-1.5v6h-1V2h-1v6h-1V2zM17 2c-2 0-3 3-3 6v5h2v9h2V2z"/></svg>',
    atracao: '<svg viewBox="0 0 24 24"><path d="M12 2 9 8H3l5 4-2 7 6-4 6 4-2-7 5-4h-6z"/></svg>',
    bebidas: '<svg viewBox="0 0 24 24"><path d="M6 3h10v4a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3v4H6zm10 6v6a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1z"/></svg>',
    doces: '<svg viewBox="0 0 24 24"><path d="M5 9h14l-1.5 12h-11zM8 9a4 4 0 0 1 8 0z"/></svg>',
    logistica: '<svg viewBox="0 0 24 24"><path d="M3 21V8l9-5 9 5v13h-6v-7H9v7z"/></svg>'
  };
  function placa(cat) {
    var el = h('span', { class: 'placa' + (cat === 'logistica' ? ' logistica' : ''), svg: PICTO[cat] || PICTO.atracao });
    el.appendChild(d.createTextNode(T('cat_' + cat)));
    return el;
  }

  /* ------------------------------------------------------------------
     2. ESTADO E CARREGAMENTO
     ------------------------------------------------------------------ */
  var estado = {
    idioma: 'pt', rota: 'inicio', pronto: false, acesso: null,
    viagem: null, pacote: null, pessoas: [], roteiros: [], favoritos: {}, lugaresProprios: [],
    opcao: null, dia: 0, filtro: 'todos', busca: '', descobertas: [], pos: null
  };

  function carregarViagem(id) {
    return Banco.listar('viagens').then(function (vs) {
      vs.sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
      var v = (id && vs.filter(function (x) { return x.id === id; })[0]) ||
              vs.filter(function (x) { return x.fim >= hojeIso(); })[0] || vs[vs.length - 1] || null;
      estado.viagem = v;
      return Promise.all([
        v && v.destino ? Pacotes.carregar(v.destino).catch(function () { return null; }) : Promise.resolve(null),
        Banco.listar('pessoas'),
        v ? Banco.listar('roteiros', function (r) { return r.viagem_id === v.id; }) : Promise.resolve([]),
        Banco.listar('favoritos'),
        Banco.listar('lugares')
      ]);
    }).then(function (r) {
      estado.pacote = r[0]; estado.pessoas = r[1]; estado.roteiros = r[2];
      estado.favoritos = {}; r[3].forEach(function (f) { estado.favoritos[f.id] = f; });
      estado.lugaresProprios = r[4];
      /* ordem das opções: favoritas primeiro, depois a ordem em que foram criadas */
      estado.roteiros.sort(function (a, b) { return ((b.favorito ? 1 : 0) - (a.favorito ? 1 : 0)) || ((a.ordem || 0) - (b.ordem || 0)); });
      var v = estado.viagem;
      estado.opcao = v ? (estado.roteiros.filter(function (o) { return o.id === v.opcao_ativa; })[0] || estado.roteiros[0] || null) : null;
      if (v) {
        var dias = diasDaViagem(v), hj = hojeIso(), i = dias.indexOf(hj);
        if (estado.dia >= dias.length || estado.diaViagem !== v.id) estado.dia = i >= 0 ? i : 0;
        estado.diaViagem = v.id;
      }
    });
  }
  function diasDaViagem(v) {
    var out = [], a = dataDe(v.inicio), b = dataDe(v.fim);
    for (var x = a; x <= b && out.length < 60; x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)) out.push(iso(x));
    return out;
  }
  function todosLugares() {
    var base = (estado.pacote && estado.pacote.lugares) || [];
    var meus = estado.lugaresProprios.filter(function (l) { return !estado.viagem || !l.viagem_id || l.viagem_id === estado.viagem.id; });
    return base.concat(meus);
  }
  function lugarPorId(id) { return todosLugares().filter(function (l) { return l.id === id; })[0] || null; }
  function centroViagem() {
    var v = estado.viagem;
    if (v && v.estadias && v.estadias[0] && v.estadias[0].lat != null) return v.estadias[0];
    if (estado.pacote && estado.pacote.centro) return estado.pacote.centro;
    return v && v.centro || null;
  }

  /* ------------------------------------------------------------------
     3. NAVEGAÇÃO E BOTÃO VOLTAR (um ponto só mexe no histórico)
     Início é a base; qualquer tela fica UMA camada acima dela. Gaveta,
     busca e janelas são camadas: o Voltar fecha só a de cima. Na base,
     o primeiro Voltar avisa; o segundo sai do app.
     ------------------------------------------------------------------ */
  var ROTAS = { inicio: 1, roteiro: 1, lugares: 1, mapa: 1, reservas: 1, viagens: 1, nova: 1, familia: 1, conta: 1, config: 1, entrar: 1 };
  var Nav = {
    camadas: [], depois: [], guarda: false,
    base: function (r) { return r === 'inicio' || r === 'entrar'; },
    iniciar: function () {
      var r = Nav.rotaDoEndereco() || 'inicio';
      history.replaceState({ gx: 1, rota: r, base: 1 }, '', '#/' + r);
      window.addEventListener('popstate', Nav.aoVoltar);
      ['pointerdown', 'keydown'].forEach(function (ev) { d.addEventListener(ev, Nav.armarGuarda, true); });
      return r;
    },
    rotaDoEndereco: function () { var m = (location.hash || '').match(/^#\/([a-z]+)/); return m && ROTAS[m[1]] ? m[1] : null; },
    armarGuarda: function () {
      var st = history.state || {};
      if (!Nav.guarda && st.gx && st.base && !Nav.camadas.length && Nav.base(estado.rota)) {
        history.pushState({ gx: 1, rota: estado.rota, guarda: 1 }, '', '#/' + estado.rota);
        Nav.guarda = true;
      }
    },
    ir: function (rota, op) {
      op = op || {};
      if (!ROTAS[rota]) rota = 'inicio';
      if (Nav.camadas.length) { Nav.fecharCamada(function () { Nav.ir(rota, op); }); return; }
      if (rota !== estado.rota) {
        var st = { gx: 1, rota: rota }, atual = history.state || {};
        if (op.substituir || !Nav.base(estado.rota)) {
          if (atual.base) st.base = 1;
          if (atual.guarda) st.guarda = 1;
          history.replaceState(st, '', '#/' + rota);
        } else history.pushState(st, '', '#/' + rota);
      }
      mostrar(rota);
    },
    abrirCamada: function (fechar) {
      history.pushState({ gx: 1, rota: estado.rota, camada: 1 }, '', '#/' + estado.rota);
      Nav.camadas.push(fechar);
    },
    fecharCamada: function (depois) {
      if (!Nav.camadas.length) { if (depois) depois(); return; }
      Nav.depois.push(depois || null);
      history.back();
    },
    aoVoltar: function (e) {
      if (Nav.camadas.length) {
        var f = Nav.camadas.pop();
        try { f(); } catch (err) {}
        var dep = Nav.depois.length ? Nav.depois.shift() : null;
        if (dep) setTimeout(dep, 0);
        return;
      }
      var st = e.state || {}, rota = st.rota || 'inicio';
      if (!estado.acesso || !estado.acesso.liberado) rota = 'entrar';
      mostrar(rota);
      if (st.base && Nav.base(rota)) { Nav.guarda = false; avisar(T('voltarSair')); }
    }
  };

  /* janela (folha que sobe): é uma camada do Voltar */
  function janela(titulo, conteudo, aoFechar) {
    var fundo = h('div', { class: 'janela-fundo' });
    var caixa = h('div', { class: 'janela', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
    var fechar = h('button', { class: 'ic', type: 'button', 'aria-label': T('fechar'), texto: '✕' });
    caixa.appendChild(h('div', { class: 'linha entre' }, [h('h2', { texto: titulo }), fechar]));
    caixa.appendChild(conteudo);
    fundo.appendChild(caixa); d.body.appendChild(fundo);
    var anterior = d.activeElement, fechada = false;
    function remover() {
      if (fechada) return; fechada = true;
      fundo.remove(); if (anterior && anterior.focus) anterior.focus();
      if (aoFechar) aoFechar();
    }
    Nav.abrirCamada(remover);
    var api = { fechar: function (depois) { if (!fechada) Nav.fecharCamada(depois); else if (depois) depois(); }, caixa: caixa };
    fechar.addEventListener('click', function () { api.fechar(); });
    fundo.addEventListener('click', function (e) { if (e.target === fundo) api.fechar(); });
    fundo.addEventListener('keydown', function (e) { if (e.key === 'Escape') api.fechar(); });
    setTimeout(function () { var f = caixa.querySelector('input,select,textarea,button:not(.ic)') || fechar; f.focus(); }, 30);
    return api;
  }

  /* ------------------------------------------------------------------
     4. MOLDURA: gaveta ☰, barra de baixo, cabeçalho, busca
     ------------------------------------------------------------------ */
  var BARRA = ['inicio', 'roteiro', 'lugares', 'mapa', 'reservas'];
  var ICONE_ROTA = { inicio: 'hoje', roteiro: 'roteiro', lugares: 'lugares', mapa: 'mapa', reservas: 'reservas' };

  function montarBarra() {
    var b = $('barra'); b.textContent = '';
    var liberado = estado.acesso && estado.acesso.liberado;
    b.hidden = !liberado;
    if (!liberado) return;
    BARRA.forEach(function (r) {
      var bt = h('button', { type: 'button', svg: ICONES[ICONE_ROTA[r]], 'aria-current': estado.rota === r ? 'page' : null, onclick: function () { Nav.ir(r); } });
      bt.appendChild(h('span', { texto: T('rota_' + r) }));
      b.appendChild(bt);
    });
  }

  function abrirGaveta() {
    var g = $('gaveta'), f = $('fundo-gaveta');
    g.textContent = '';
    var fechar = h('button', { class: 'ic', type: 'button', 'aria-label': T('fechar'), texto: '✕', onclick: function () { Nav.fecharCamada(); } });
    g.appendChild(h('div', { class: 'gaveta-cab' }, [h('strong', { id: 'gaveta-titulo', texto: 'GuiaXpert' }), fechar]));
    var lib = estado.acesso && estado.acesso.liberado;
    var grupos = lib ? [
      ['grupoViagem', [['inicio', '☀️'], ['roteiro', '🗓'], ['lugares', '📋'], ['mapa', '🗺'], ['reservas', '🎫']]],
      ['grupoPlanejar', [['viagens', '🧳'], ['nova', '➕'], ['familia', '👨‍👩‍👧']]],
      ['grupoAjustes', [['config', '⚙'], ['conta', '👤']]]
    ] : [['grupoAjustes', [['entrar', '🔑'], ['config', '⚙']]]];
    var lang = h('div', { class: 'chips', role: 'group', 'aria-label': T('trocarIdioma') }, ['pt', 'en'].map(function (l) {
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': idioma() === l ? 'true' : 'false', texto: l.toUpperCase(), onclick: function () { trocarIdioma(l); Nav.fecharCamada(); } });
    }));
    g.appendChild(lang);
    grupos.forEach(function (gr) {
      g.appendChild(h('h2', { texto: T(gr[0]) }));
      g.appendChild(h('ul', {}, gr[1].map(function (it) {
        return h('li', {}, h('button', { type: 'button', onclick: function () { Nav.fecharCamada(function () { Nav.ir(it[0]); }); } },
          [h('span', { 'aria-hidden': 'true', texto: it[1] }), T('rota_' + it[0])]));
      })));
    });
    g.appendChild(h('h2', { texto: T('grupoMais') }));
    g.appendChild(h('ul', {}, [h('li', {}, h('a', { href: '/', target: '_blank', rel: 'noopener' }, [h('span', { 'aria-hidden': 'true', texto: '🧭' }), T('portal') + ' ↗']))]));
    g.appendChild(h('p', { class: 'pequeno', texto: 'GuiaXpert ' + VERSAO_APP + ' · ' + T('umaSolucao') }));
    g.hidden = false; f.hidden = false; g.classList.add('entrando');
    $('bt-menu').setAttribute('aria-expanded', 'true');
    Nav.abrirCamada(function () {
      g.hidden = true; f.hidden = true; g.classList.remove('entrando');
      $('bt-menu').setAttribute('aria-expanded', 'false'); $('bt-menu').focus();
    });
    setTimeout(function () { fechar.focus(); }, 30);
  }

  function trocarIdioma(l) {
    estado.idioma = l;
    if (window.DGO && DGO.trocarIdioma) { try { DGO.trocarIdioma(l); } catch (e) {} }
    try { localStorage.setItem('dgo:guiaxpert:idioma', l); } catch (e) {}
    traduzirMoldura(); mostrar(estado.rota);
  }
  function traduzirMoldura() {
    d.documentElement.lang = idioma() === 'en' ? 'en' : 'pt-BR';
    d.querySelectorAll('[data-t]').forEach(function (n) { n.textContent = T(n.getAttribute('data-t')); });
    d.querySelectorAll('[data-ta]').forEach(function (n) { n.setAttribute('aria-label', T(n.getAttribute('data-ta'))); n.title = T(n.getAttribute('data-ta')); });
    $('bt-idioma').textContent = idioma() === 'en' ? 'PT' : 'EN';
  }

  /* busca 🔍: funções do app + lugares */
  function abrirBusca() {
    var campo = h('input', { class: 'campo', type: 'search', placeholder: T('buscarDica'), 'aria-label': T('buscar'), autocomplete: 'off' });
    var lista = h('div', { class: 'grade' });
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.75rem' }, [campo, lista]);
    var j = janela(T('buscar'), corpo);
    function atualizar() {
      var q = normalizar(campo.value).trim(); lista.textContent = '';
      if (!q) return;
      var funcs = Object.keys(ROTAS).filter(function (r) { return r !== 'entrar' && normalizar(T('rota_' + r) + ' ' + T('sin_' + r)).indexOf(q) > -1; });
      funcs.forEach(function (r) {
        lista.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: function () { j.fechar(); setTimeout(function () { Nav.ir(r); }, 0); } }, T('rota_' + r)));
      });
      todosLugares().filter(function (l) { return normalizar(l.nome + ' ' + (l.descricao || '') + ' ' + (l.endereco || '')).indexOf(q) > -1; }).slice(0, 20).forEach(function (l) {
        lista.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: function () {
          estado.busca = l.nome; estado.filtro = 'todos'; estado.abrirLugar = l.id; j.fechar(); setTimeout(function () { Nav.ir('lugares'); }, 0);
        } }, [placa(l.categoria), ' ', l.nome]));
      });
      if (!lista.childNodes.length) lista.appendChild(h('p', { class: 'sub', texto: T('nadaAchado') }));
    }
    campo.addEventListener('input', atualizar);
  }

  /* ------------------------------------------------------------------
     5. TELAS — mostrar() troca o conteúdo de <main>
     ------------------------------------------------------------------ */
  var TELAS = {};
  function mostrar(rota) {
    if (!estado.pronto) { estado.rota = rota; return; }
    var lib = estado.acesso && estado.acesso.liberado;
    if (!lib && rota !== 'config') rota = 'entrar';
    if (lib && rota === 'entrar') rota = 'inicio';
    estado.rota = rota;
    var m = $('conteudo'); m.textContent = '';
    var tela = h('section', { class: 'tela' + (rota === 'mapa' || rota === 'lugares' ? ' larga' : '') });
    m.appendChild(tela);
    $('bt-inicio').setAttribute('aria-current', rota === 'inicio' ? 'page' : 'false');
    montarBarra();
    try { TELAS[rota](tela); } catch (e) { console.error(e); tela.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T('erroTela') }), String(e.message || e)])); }
    window.scrollTo(0, 0);
  }

  function semViagem(tela) {
    tela.appendChild(h('div', { class: 'cartao' }, [
      h('h2', { texto: T('semViagemTitulo') }), h('p', { class: 'sub', texto: T('semViagemTexto') }),
      h('button', { class: 'bt', type: 'button', onclick: function () { Nav.ir('nova'); } }, T('rota_nova'))
    ]));
  }

  /* ---------- Hoje ---------- */
  TELAS.inicio = function (tela) {
    var v = estado.viagem;
    if (!v) {
      tela.appendChild(h('h1', { texto: T('boasVindas') }));
      tela.appendChild(h('p', { class: 'sub', texto: T('boasVindasTexto') }));
      tela.appendChild(h('button', { class: 'bt cheio', type: 'button', onclick: function () { Nav.ir('nova'); } }, T('criarPrimeira')));
      tela.appendChild(h('div', { class: 'cartao' }, [
        h('h3', { texto: T('comoFunciona') }),
        h('p', { class: 'sub', texto: T('comoFuncionaTexto') })
      ]));
      return;
    }
    var dias = diasDaViagem(v), hj = hojeIso(), di = dias.indexOf(hj);
    var cab = h('div', {}, [h('h1', { texto: v.nome }), h('p', { class: 'sub', texto: fData(v.inicio) + ' – ' + fData(v.fim) })]);
    tela.appendChild(cab);
    if (estado.pacote && estado.pacote.offline) tela.appendChild(h('p', { class: 'pequeno', texto: T('usandoCopia') }));

    var dias2 = Math.round((dataDe(v.inicio) - dataDe(hj)) / 86400000);
    if (di < 0 && dias2 > 0) {
      var destino = estado.pacote ? Pacotes.nome(estado.pacote, idioma()) : (v.destinoTexto || v.nome);
      tela.appendChild(h('section', { class: 'sinal rodovia', 'aria-label': destino + ': ' + T(dias2 === 1 ? 'falta1' : 'faltamDias', { n: dias2 }) }, [
        h('div', { class: 'destino' }, [
          h('div', {}, [h('p', { class: 'rotulo', texto: T('ateAViagem') }), h('p', { class: 'grande', texto: destino })]),
          h('p', { class: 'distancia', 'aria-hidden': 'true' }, [String(dias2), h('small', { texto: T(dias2 === 1 ? 'umDia' : 'variosDias') })])
        ]),
        h('p', { class: 'nota', texto: T('faltamDiasTexto') })
      ]));
    }

    /* agora / próximo item de hoje */
    if (di >= 0 && estado.opcao) {
      var dia = estado.opcao.dias[mapearDia(di, dias.length, estado.opcao.dias.length)];
      var agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
      var prox = (dia && dia.itens || []).filter(function (it) { return it.hora && minutos(it.hora) >= agoraMin - 30; })[0];
      if (prox) tela.appendChild(cartaoAgora(prox));
      if (pessoasDaViagem().some(function (p) { return p.soneca; }) && agoraMin < 15 * 60) tela.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T('avisoSoneca') })]));
    }

    /* clima */
    var c = centroViagem(), cx = h('div', { class: 'cartao' }, [h('h3', { texto: T('climaTitulo') }), h('p', { class: 'sub', texto: T('carregando') })]);
    tela.appendChild(cx);
    if (c) Clima.previsao(c.lat, c.lng).then(function (p) { desenharClima(cx, p, dias); }).catch(function () { cx.lastChild.textContent = T('climaSem'); });
    else cx.lastChild.textContent = T('climaSemLugar');

    var ac = h('div', { class: 'grade' }, [
      h('button', { class: 'bt', type: 'button', onclick: function () { Nav.ir('roteiro'); } }, T('verRoteiro')),
      h('button', { class: 'bt sec', type: 'button', onclick: function () { estado.filtro = 'perto'; Nav.ir('lugares'); } }, '📍 ' + T('pertoDeMim')),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { Nav.ir('reservas'); } }, '🎫 ' + T('rota_reservas'))
    ]);
    tela.appendChild(ac);
    if (estado.pacote && estado.pacote.aviso) tela.appendChild(h('p', { class: 'pequeno', texto: estado.pacote.aviso[idioma()] || estado.pacote.aviso.pt }));
  };
  function minutos(hh) { var p = String(hh).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function cartaoAgora(it) {
    var l = it.lugarId ? lugarPorId(it.lugarId) : null;
    var cat = l ? l.categoria : 'atracao';
    var c = h('section', { class: 'sinal' + (cat === 'logistica' ? ' rodovia' : ''), 'aria-label': T('aSeguir') }, [
      h('div', { class: 'topo-sinal' }, [h('span', { class: 'picto', 'aria-hidden': 'true', svg: PICTO[cat] || PICTO.atracao }), h('p', { class: 'rotulo', texto: T('aSeguir') })]),
      h('p', { class: 'grande' }, [h('span', { class: 'hora', texto: it.hora }), ' ', it.titulo])
    ]);
    if (it.nota) c.appendChild(h('p', { class: 'nota', texto: it.nota }));
    if (l && l.lat != null) c.appendChild(h('div', { class: 'acoes-sinal' }, [
      h('a', { href: Geo.linkRota(l, estado.pos), target: '_blank', rel: 'noopener', texto: T('rota') }),
      h('a', { href: Geo.linkWaze(l), target: '_blank', rel: 'noopener', texto: 'Waze' }),
      h('button', { type: 'button', texto: T('verNaLista'), onclick: function () { estado.abrirLugar = l.id; estado.filtro = 'todos'; Nav.ir('lugares'); } })
    ]));
    return c;
  }
  function desenharClima(cx, p, dias) {
    cx.textContent = '';
    cx.appendChild(h('h3', { texto: T('climaTitulo') }));
    var ds = p.dias.filter(function (x) { return dias.indexOf(x.data) > -1; });
    if (!ds.length) { cx.appendChild(h('p', { class: 'sub', texto: T('climaLonge', { n: p.dias.length }) })); return; }
    cx.appendChild(h('div', { class: 'clima' }, ds.map(function (x) {
      return h('div', { class: 'd', 'aria-label': fData(x.data) + ': ' + x.min + '° a ' + x.max + '°' }, [
        h('span', { texto: semana(x.data) + ' ' + fData(x.data, true) }), h('b', { texto: Clima.icone(x.codigo) }),
        h('span', { texto: x.min + '° / ' + x.max + '°' }), x.chuva != null ? h('span', { class: 'pequeno', texto: '☔ ' + x.chuva + '%' }) : null
      ]);
    })));
    var avisos = {};
    var grupo = pessoasDaViagem(), sens = { calor: grupo.some(function (p) { return p.calor; }), frio: grupo.some(function (p) { return p.frio; }) };
    ds.forEach(function (x) { Clima.avisos(x, sens).forEach(function (a) { avisos[a] = (avisos[a] || []).concat(fData(x.data, true)); }); });
    Object.keys(avisos).forEach(function (a) { cx.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T(a) }), avisos[a].join(', ')])); });
    var v = estado.viagem, onde = (v && v.destinoTexto) || (estado.pacote && Pacotes.nome(estado.pacote, idioma())) || '';
    cx.appendChild(h('p', { class: 'pequeno' }, [
      (p.antiga ? T('climaAntigo') + ' ' : '') + T('climaFonte', { fonte: p.fonte || 'Open-Meteo' }) + ' ',
      h('a', { href: Clima.linkCompleto(onde), target: '_blank', rel: 'noopener', texto: T('climaCompleto') })
    ]));
  }

  /* dia da viagem → dia do modelo de roteiro: 1º = chegada, último = volta, meio = repete os dias do meio */
  function mapearDia(i, nViagem, nModelo) {
    if (nModelo <= 1) return 0;
    if (i === 0) return 0;
    if (i === nViagem - 1) return nModelo - 1;
    var meio = nModelo - 2;
    return meio > 0 ? 1 + ((i - 1) % meio) : 0;
  }

  /* ---------- Roteiro ---------- */
  TELAS.roteiro = function (tela) {
    var v = estado.viagem;
    if (!v) return semViagem(tela);
    tela.appendChild(h('h1', { texto: T('rota_roteiro') }));
    if (!estado.roteiros.length) {
      tela.appendChild(h('p', { class: 'sub', texto: T('semOpcoes') }));
      tela.appendChild(botoesNovaOpcao());
      return;
    }
    /* opções de roteiro (várias por viagem) */
    var ops = h('div', { class: 'chips rolar', role: 'tablist', 'aria-label': T('opcoesRoteiro') });
    estado.roteiros.forEach(function (o) {
      ops.appendChild(h('button', { class: 'chip', role: 'tab', type: 'button', 'aria-selected': estado.opcao && estado.opcao.id === o.id ? 'true' : 'false',
        onclick: function () { estado.opcao = o; v.opcao_ativa = o.id; Banco.gravar('viagens', v).then(function (nv) { estado.viagem = nv; }); mostrar('roteiro'); } },
        (o.favorito ? '★ ' : '') + o.nome + (o.origem === 'ia' ? ' ✨' : '')));
    });
    tela.appendChild(ops);
    var o = estado.opcao;
    var barra = h('div', { class: 'linha' }, [
      h('button', { class: 'fav', type: 'button', 'aria-pressed': o.favorito ? 'true' : 'false', 'aria-label': T('favoritarRoteiro'), texto: o.favorito ? '★' : '☆',
        onclick: function () { o.favorito = !o.favorito; Banco.gravar('roteiros', o).then(function () { return recarregar(); }); } }),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaNovaOpcao(); } }, '＋ ' + T('outraOpcao')),
      o.origem !== 'pacote' ? h('button', { class: 'bt leve', type: 'button', onclick: function () { apagarOpcao(o); } }, T('apagarOpcao')) : null
    ]);
    tela.appendChild(barra);
    if (o.origem === 'ia') tela.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T('iaConfira') }), T('iaConfiraTexto')]));

    var dias = diasDaViagem(v);
    var tabs = h('div', { class: 'dias', role: 'tablist', 'aria-label': T('diasDaViagem') });
    dias.forEach(function (dt, i) {
      tabs.appendChild(h('button', { class: 'dia', role: 'tab', type: 'button', 'aria-selected': i === estado.dia ? 'true' : 'false', onclick: function () { estado.dia = i; mostrar('roteiro'); } },
        [h('span', { texto: semana(dt) }), h('small', { texto: fData(dt, true) })]));
    });
    tela.appendChild(tabs);

    var dmod = o.dias[mapearDia(estado.dia, dias.length, o.dias.length)] || { itens: [] };
    var data = dias[estado.dia];
    var bloco = h('div', { class: 'tempo' });
    var cab = h('header', {}, [h('h3', { texto: semana(data) + ', ' + fData(data) }), h('span', { class: 'sub', texto: dmod.titulo || '' })]);
    bloco.appendChild(cab);
    var c = centroViagem();
    if (c) Clima.previsao(c.lat, c.lng).then(function (p) {
      var x = p.dias.filter(function (y) { return y.data === data; })[0];
      if (x) cab.appendChild(h('span', { class: 'sub', texto: Clima.icone(x.codigo) + ' ' + x.min + '°/' + x.max + '°' + (x.chuva != null ? ' ☔' + x.chuva + '%' : '') }));
    }).catch(function () {});
    var hj = data === hojeIso(), agoraMin = new Date().getHours() * 60 + new Date().getMinutes(), marcouAgora = false;
    (dmod.itens || []).forEach(function (it, idx) {
      var l = it.lugarId ? lugarPorId(it.lugarId) : null;
      var agora = hj && !marcouAgora && it.hora && minutos(it.hora) >= agoraMin - 30;
      if (agora) marcouAgora = true;
      var x = h('div', { class: 'x' }, [
        h('div', { class: 'linha' }, [l ? placa(l.categoria) : null,
          l ? h('button', { class: 'lk', type: 'button', onclick: function () { estado.busca = ''; estado.filtro = 'todos'; estado.abrirLugar = l.id; Nav.ir('lugares'); } }, it.titulo) : h('b', { texto: it.titulo }),
          it.tipo === 'gratis' ? h('span', { class: 'etq gratis', texto: T('gratis') }) : null,
          it.tipo === 'ingresso' ? h('span', { class: 'etq', texto: T('ingresso') }) : null]),
        it.nota ? h('span', { class: 'nota', texto: it.nota }) : null
      ]);
      var rm = o.origem !== 'pacote' ? h('button', { class: 'fav', type: 'button', 'aria-label': T('tirarItem'), texto: '✕', onclick: function () {
        dmod.itens.splice(idx, 1); Banco.gravar('roteiros', o).then(recarregarTela); } }) : h('span');
      bloco.appendChild(h('div', { class: 'item' + (agora ? ' agora' : '') }, [h('span', { class: 'h', texto: it.hora || '—' }), x, rm]));
    });
    if (!(dmod.itens || []).length) bloco.appendChild(h('p', { class: 'sub', style: 'padding:1rem', texto: T('diaVazio') }));
    tela.appendChild(bloco);
    if (o.origem === 'pacote') tela.appendChild(h('p', { class: 'pequeno', texto: T('pacoteEditar') }));
    tela.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaItem(o, dmod); } }, '＋ ' + T('addItem')));
  };
  function recarregar() { return carregarViagem(estado.viagem && estado.viagem.id).then(function () { mostrar(estado.rota); }); }
  function recarregarTela() { return recarregar(); }

  /* "fecharAntes": dentro de uma janela, fecha a janela primeiro e só depois age
     (senão a ação abriria outra janela e o fechar levaria a nova embora) */
  function botoesNovaOpcao(fecharAntes) {
    var agir = function (fn) { return function () { if (fecharAntes) fecharAntes(fn); else fn(); }; };
    var g = h('div', { class: 'grade' });
    if (estado.pacote && estado.pacote.roteiros.length) g.appendChild(h('button', { class: 'bt', type: 'button', onclick: agir(function () {
      criarOpcoesDoPacote(estado.viagem, estado.pacote).then(recarregar); }) }, T('usarDoPacote', { n: estado.pacote.roteiros.length })));
    g.appendChild(h('button', { class: 'bt sec', type: 'button', onclick: agir(gerarComIA) }, '✨ ' + T('gerarIA')));
    g.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: agir(function () { criarOpcaoEmBranco().then(recarregar); }) }, T('emBranco')));
    return g;
  }
  function janelaNovaOpcao() { var j; j = janela(T('outraOpcao'), botoesNovaOpcao(function (fn) { j.fechar(fn); })); }

  function criarOpcoesDoPacote(v, p) {
    var ja = {}; estado.roteiros.forEach(function (r) { if (r.base_id) ja[r.base_id] = 1; });
    return p.roteiros.filter(function (r) { return !ja[r.id]; }).reduce(function (pr, r, i) {
      return pr.then(function () {
        return Banco.gravar('roteiros', { viagem_id: v.id, nome: r.nome, origem: 'pacote', base_id: r.id, pacote_id: p.id, favorito: false, ordem: i + 1, dias: JSON.parse(JSON.stringify(r.dias)) });
      });
    }, Promise.resolve());
  }
  function criarOpcaoEmBranco() {
    var v = estado.viagem, n = diasDaViagem(v).length;
    var dias = []; for (var i = 0; i < n; i++) dias.push({ ordem: i + 1, titulo: '', itens: [] });
    return Banco.gravar('roteiros', { viagem_id: v.id, nome: T('meuRoteiro') + ' ' + (estado.roteiros.length + 1), origem: 'manual', favorito: false, ordem: 100 + estado.roteiros.length, dias: dias })
      .then(function (r) { v.opcao_ativa = r.id; return Banco.gravar('viagens', v); });
  }
  function apagarOpcao(o) {
    var j = janela(T('apagarOpcao'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { texto: T('apagarOpcaoTexto', { nome: o.nome }) }),
      h('button', { class: 'bt perigo', type: 'button', onclick: function () { Banco.apagar('roteiros', o.id).then(function () { j.fechar(); recarregar(); }); } }, T('apagar'))
    ]));
  }
  /* item novo no roteiro (opção editável; a do pacote vira cópia "minha") */
  function janelaItem(o, dmod) {
    var hora = h('input', { class: 'campo', type: 'time', id: 'gx-item-hora' });
    var tit = h('input', { class: 'campo', type: 'text', id: 'gx-item-tit', maxlength: '100', placeholder: T('exItem') });
    var sel = h('select', { class: 'campo', id: 'gx-item-lugar' }, [h('option', { value: '' }, T('semLugar'))].concat(
      todosLugares().slice().sort(function (a, b) { return a.nome < b.nome ? -1 : 1; }).map(function (l) { return h('option', { value: l.id }, l.nome); })));
    var ok = h('button', { class: 'bt', type: 'button' }, T('adicionar'));
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('label', { class: 'rot', for: 'gx-item-hora', texto: T('hora') }), hora,
      h('label', { class: 'rot', for: 'gx-item-tit', texto: T('oQue') }), tit,
      h('label', { class: 'rot', for: 'gx-item-lugar', texto: T('lugarOpcional') }), sel, ok]);
    var j = janela(T('addItem'), corpo);
    sel.addEventListener('change', function () { if (sel.value && !tit.value) tit.value = lugarPorId(sel.value).nome; });
    ok.addEventListener('click', function () {
      if (!tit.value.trim()) { tit.focus(); avisar(T('faltaOque')); return; }
      addItemNaOpcao(o, dmod, { hora: hora.value, titulo: tit.value.trim(), nota: null, tipo: null, lugarId: sel.value || null }).then(function () { j.fechar(); recarregar(); });
    });
  }
  function addItemNaOpcao(o, dmod, item) {
    var alvo = o, idx = o.dias.indexOf(dmod);
    var pr = Promise.resolve();
    if (o.origem === 'pacote') {
      /* o roteiro do pacote não muda: cria uma cópia "minha" e edita a cópia */
      alvo = { viagem_id: o.viagem_id, nome: o.nome + ' (' + T('minhaVersao') + ')', origem: 'manual', base_id: null, favorito: false, ordem: (o.ordem || 0) + 0.5, dias: JSON.parse(JSON.stringify(o.dias)) };
      pr = Banco.gravar('roteiros', alvo).then(function (n) { alvo = n; estado.viagem.opcao_ativa = n.id; return Banco.gravar('viagens', estado.viagem); });
    }
    return pr.then(function () {
      var dd = alvo.dias[idx]; dd.itens = dd.itens || []; dd.itens.push(item);
      dd.itens.sort(function (a, b) { return (a.hora || '99') < (b.hora || '99') ? -1 : 1; });
      return Banco.gravar('roteiros', alvo);
    });
  }

  function gerarComIA() {
    var v = estado.viagem;
    if (!window.DGO || !DGO.ia || !DGO.ia.provedoresProntos || !DGO.ia.provedoresProntos().length) {
      var j = janela(T('gerarIA'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
        h('p', { texto: T('iaSemChave') }),
        h('button', { class: 'bt', type: 'button', onclick: function () { j.fechar(); setTimeout(function () { if (window.DGO) DGO.ia.guia(null, 'texto'); }, 50); } }, T('iaConfigurar'))
      ]));
      return;
    }
    avisar(T('iaMontando'));
    var pessoas = pessoasDaViagem(v);
    var pr = Cofre.aberto() ? Promise.all(pessoas.map(function (p) {
      return Cofre.decifrar(p.restricoes).then(function (r) { var c = Object.assign({}, p); c._restricoes = r ? listaRestricoes(r) : []; return c; }).catch(function () { return p; });
    })) : Promise.resolve(pessoas);
    pr.then(function (ps) {
      var vv = Object.assign({}, v, { dias: diasDaViagem(v).map(function (x) { return { data: x, rotulo: semana(x) }; }) });
      return Descobrir.roteiroIA(vv, ps, estado.pacote, idioma());
    }).then(function (r) {
      return Banco.gravar('roteiros', Object.assign(r, { viagem_id: v.id, favorito: false, ordem: 200 + estado.roteiros.length }));
    }).then(function (r) { v.opcao_ativa = r.id; return Banco.gravar('viagens', v); }).then(function () {
      avisar(T('iaPronto')); recarregar();
    }).catch(function (e) {
      avisar(e.message === 'sem-internet' ? T('semInternet') : e.message === 'ia-formato' ? T('iaFormato') : T('iaErro'));
    });
  }

  /* ---------- Lugares ---------- */
  var FILTROS = ['todos', 'paraVoces', 'favoritos', 'perto', 'comer', 'atracao', 'gratis', 'bebidas', 'doces', 'logistica'];
  TELAS.lugares = function (tela) {
    tela.appendChild(h('div', { class: 'linha entre' }, [h('h1', { texto: T('listaLugares') }),
      h('button', { class: 'bt leve', type: 'button', onclick: janelaNovoLugar }, '＋ ' + T('novoLugar'))]));
    if (!todosLugares().length && !estado.descobertas.length) {
      tela.appendChild(h('p', { class: 'sub', texto: estado.viagem ? T('semLugares') : T('semViagemTexto') }));
    }
    var chips = h('div', { class: 'chips rolar', role: 'group', 'aria-label': T('filtrar') }, FILTROS.map(function (f) {
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': estado.filtro === f ? 'true' : 'false', onclick: function () {
        estado.filtro = f;
        if (f === 'perto' && !estado.pos) { pegarPosicao().then(function () { mostrar('lugares'); }); return; }
        mostrar('lugares'); } }, T('f_' + f));
    }));
    tela.appendChild(chips);
    var caixa = h('div', { class: 'busca-caixa', svg: ICONES.lupa });
    var campo = h('input', { type: 'search', id: 'gx-busca-lugares', placeholder: T('buscarLugarDica'), 'aria-label': T('buscar'), value: estado.busca, autocomplete: 'off' });
    caixa.appendChild(campo); tela.appendChild(caixa);
    var info = h('p', { class: 'pequeno' }); tela.appendChild(info);
    var lista = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.5rem' }); tela.appendChild(lista);

    var restr = restricoesDoGrupo();
    somaGostos = Gostos.doGrupo(pessoasDaViagem());
    function desenhar() {
      var q = normalizar(estado.busca).trim(), f = estado.filtro;
      var base = todosLugares().concat(estado.descobertas.filter(function (x) { return !lugarPorId(x.id); }));
      var itens = base.filter(function (l) {
        if (f === 'favoritos' && !estado.favoritos['lugar:' + l.id]) return false;
        if (f === 'paraVoces' && Gostos.combina(l, somaGostos) <= 0) return false;
        if (f === 'gratis' && !l.gratis) return false;
        if (['comer', 'atracao', 'bebidas', 'doces', 'logistica'].indexOf(f) > -1 && l.categoria !== f) return false;
        if (f === 'perto' && l.lat == null) return false;
        if (q && normalizar([l.nome, l.descricao, l.endereco, l.subcategoria, T('cat_' + l.categoria)].join(' ')).indexOf(q) < 0) return false;
        return true;
      });
      var pos = estado.pos;
      if (pos) itens.forEach(function (l) { l._km = Geo.distancia(pos, l); });
      if (f === 'paraVoces') itens.sort(function (a, b) { return Gostos.combina(b, somaGostos) - Gostos.combina(a, somaGostos); });
      else if (f === 'perto' || pos) itens.sort(function (a, b) { return (a._km == null ? 1e9 : a._km) - (b._km == null ? 1e9 : b._km); });
      lista.textContent = '';
      info.textContent = T('nLugares', { n: itens.length }) + (pos ? ' · ' + T('ordemDistancia') : '');
      itens.slice(0, 200).forEach(function (l) { lista.appendChild(cartaoLugar(l, restr)); });
      if (!itens.length) lista.appendChild(h('p', { class: 'sub', texto: f === 'paraVoces' && !Object.keys(somaGostos).length ? T('semGostosAinda') : T('nadaAchado') }));
      if (estado.abrirLugar) {
        var alvo = lista.querySelector('[data-id="' + CSS.escape(estado.abrirLugar) + '"]');
        if (alvo) { alvo.open = true; alvo.scrollIntoView({ block: 'center' }); }
        estado.abrirLugar = null;
      }
    }
    campo.addEventListener('input', function () { estado.busca = campo.value; desenhar(); });
    desenhar();

    var c = centroViagem();
    tela.appendChild(h('div', { class: 'cartao' }, [
      h('h3', { texto: T('descobrirTitulo') }), h('p', { class: 'sub', texto: T('descobrirTexto') }),
      h('button', { class: 'bt sec', type: 'button', disabled: !c, onclick: function (e) {
        var bt = e.currentTarget; bt.disabled = true; bt.textContent = T('carregando');
        Descobrir.perto(estado.pos || c, 8000).then(function (l) { estado.descobertas = l; avisar(T('descobertos', { n: l.length })); mostrar('lugares'); })
          .catch(function () { bt.disabled = false; bt.textContent = T('descobrirBotao'); avisar(navigator.onLine ? T('osmErro') : T('semInternet')); });
      } }, T('descobrirBotao')),
      h('p', { class: 'pequeno', texto: '© OpenStreetMap contributors (ODbL)' })
    ]));
  };
  var somaGostos = {};
  /* quem vai nesta viagem, já com os ajustes "só nesta viagem" por cima do perfil fixo */
  function pessoasDaViagem(v) {
    v = v || estado.viagem;
    var ids = v && v.pessoas || [];
    return estado.pessoas.filter(function (p) { return ids.indexOf(p.id) > -1; }).map(function (p) { return perfilNaViagem(p, v); });
  }
  var CAMPOS_AJUSTE = ['mobilidade', 'calor', 'frio', 'soneca'];
  function perfilNaViagem(p, v) {
    var a = v && v.ajustes && v.ajustes[p.id];
    if (!a) return p;
    var c = Object.assign({}, p);
    CAMPOS_AJUSTE.forEach(function (k) { if (a[k] !== undefined) c[k] = a[k]; });
    if (a.gostos) {
      c.gostos = Object.assign({}, p.gostos || {});
      Object.keys(a.gostos).forEach(function (id) { if (a.gostos[id]) c.gostos[id] = a.gostos[id]; else delete c.gostos[id]; });
    }
    c._ajustado = true;
    return c;
  }
  function grupoDe(p) { return p.grupo || 'familia'; }
  function cartaoLugar(l, restr) {
    var fav = !!estado.favoritos['lugar:' + l.id];
    var det = h('details', { class: 'lugar', 'data-id': l.id });
    var meta = h('span', { class: 'meta' }, [placa(l.categoria), l.subcategoria ? T('sub_' + l.subcategoria) : null,
      l._km != null ? Geo.formatarKm(l._km) : null, l.gratis ? h('span', { class: 'etq gratis', texto: T('gratis') }) : null,
      Gostos.combina(l, somaGostos) > 0 ? h('span', { class: 'etq combina', texto: '♥ ' + T('combina') }) : null,
      l.confianca === 'baixa' ? h('span', { class: 'conferir', texto: T('conferir') }) : null,
      l.confianca === 'osm' ? h('span', { class: 'pequeno', texto: 'OSM' }) : null]);
    var bfav = h('button', { class: 'fav', type: 'button', 'aria-pressed': fav ? 'true' : 'false', 'aria-label': T('favoritar') + ': ' + l.nome, texto: fav ? '★' : '☆',
      onclick: function (e) { e.preventDefault(); alternarFavorito(l).then(function (on) { bfav.textContent = on ? '★' : '☆'; bfav.setAttribute('aria-pressed', on ? 'true' : 'false'); }); } });
    det.appendChild(h('summary', {}, [h('span', { class: 'nome', texto: l.nome }), bfav, meta]));
    var corpo = h('div', { class: 'corpo' });
    if (l.descricao) corpo.appendChild(h('p', { class: 'sub', texto: l.descricao }));
    [['endereco', l.endereco], ['horario', l.horario], ['reserva', l.reserva], ['preco', l.preco], ['criancas', l.criancas], ['telefone', l.telefone]].forEach(function (kv) {
      if (kv[1]) corpo.appendChild(h('div', { class: 'kv' }, [h('span', { texto: T(kv[0]) }), h('span', { texto: kv[1] })]));
    });
    if (l.categoria === 'comer' && restr.length) corpo.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T('restricoesGrupo') }), restr.join(', ') + '. ' + T('pergunteAntes')]));
    if (l.dieta) { var dd = Object.keys(l.dieta).filter(function (k) { return l.dieta[k]; }); if (dd.length) corpo.appendChild(h('p', { class: 'pequeno', texto: T('osmDieta') + ': ' + dd.map(function (k) { return T('r_' + k); }).join(', ') })); }
    corpo.appendChild(linksLugar(l));
    if (estado.opcao) corpo.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaAddAoRoteiro(l); } }, '＋ ' + T('addAoRoteiro')));
    if (l.confianca === 'osm' && !estado.lugaresProprios.some(function (x) { return x.id === l.id; })) corpo.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: function () {
      Banco.gravar('lugares', Object.assign({}, l, { viagem_id: estado.viagem ? estado.viagem.id : null })).then(function () { avisar(T('salvo')); recarregar(); }); } }, T('salvarLugar')));
    if (estado.lugaresProprios.some(function (x) { return x.id === l.id; })) corpo.appendChild(h('button', { class: 'bt perigo', type: 'button', onclick: function () {
      Banco.apagar('lugares', l.id).then(recarregar); } }, T('tirarDaLista')));
    corpo.appendChild(h('p', { class: 'pequeno', texto: T('conf_' + (l.confianca || 'baixa')) }));
    det.appendChild(corpo);
    return det;
  }
  function linksLugar(l) {
    var lk = function (href, txt, cls) { return h('a', { class: 'bt ' + (cls || 'leve'), href: href, target: '_blank', rel: 'noopener' }, txt); };
    var g = h('div', { class: 'linha' }, [
      lk(Geo.linkRota(l, estado.pos), T('rota'), ''), lk(Geo.linkWaze(l), 'Waze'), lk(Geo.linkMapa(l), T('verMapa')),
      l.site && /^https?:\/\//.test(l.site) ? lk(l.site, T('site')) : null,
      l.telefone ? h('span', { class: 'pequeno', texto: '☎ ' + l.telefone }) : null
    ]);
    var hosp = estado.viagem && estado.viagem.estadias && estado.viagem.estadias[0];
    if (hosp && hosp.lat != null && l.lat != null) {
      var km = Geo.distancia(hosp, l);
      g.appendChild(h('span', { class: 'pequeno', texto: T('doHotel', { km: Geo.formatarKm(km), min: Geo.minutosCarro(km) }) }));
    }
    return g;
  }
  function alternarFavorito(l) {
    var id = 'lugar:' + l.id, ja = estado.favoritos[id];
    var p = ja ? Banco.apagar('favoritos', id) : Banco.gravar('favoritos', { id: id, tipo: 'lugar', ref: l.id, nome: l.nome, viagem_id: estado.viagem ? estado.viagem.id : null });
    return p.then(function (r) { if (ja) delete estado.favoritos[id]; else estado.favoritos[id] = r; return !ja; });
  }
  function janelaAddAoRoteiro(l) {
    var v = estado.viagem, dias = diasDaViagem(v);
    var sel = h('select', { class: 'campo', id: 'gx-add-dia' }, dias.map(function (dt, i) { return h('option', { value: String(i), selected: i === estado.dia }, semana(dt) + ' ' + fData(dt, true)); }));
    var hora = h('input', { class: 'campo', type: 'time', id: 'gx-add-hora' });
    var ok = h('button', { class: 'bt', type: 'button' }, T('adicionar'));
    var j = janela(T('addAoRoteiro') + ': ' + l.nome, h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { class: 'sub', texto: T('naOpcao', { nome: estado.opcao.nome }) }),
      h('label', { class: 'rot', for: 'gx-add-dia', texto: T('dia') }), sel, h('label', { class: 'rot', for: 'gx-add-hora', texto: T('hora') }), hora, ok]));
    ok.addEventListener('click', function () {
      var i = +sel.value, o = estado.opcao, dmod = o.dias[mapearDia(i, dias.length, o.dias.length)];
      addItemNaOpcao(o, dmod, { hora: hora.value, titulo: l.nome, nota: null, tipo: l.gratis ? 'gratis' : null, lugarId: l.id }).then(function () { j.fechar(); avisar(T('adicionado')); recarregar(); });
    });
  }
  function janelaNovoLugar() {
    var nome = h('input', { class: 'campo', id: 'gx-nl-nome', maxlength: '80', placeholder: T('exLugar') });
    var cat = h('select', { class: 'campo', id: 'gx-nl-cat' }, ['comer', 'atracao', 'bebidas', 'doces', 'logistica'].map(function (c) { return h('option', { value: c }, T('cat_' + c)); }));
    var end = h('input', { class: 'campo', id: 'gx-nl-end', maxlength: '160', placeholder: T('exEndereco') });
    var nota = h('input', { class: 'campo', id: 'gx-nl-nota', maxlength: '160', placeholder: T('exNota') });
    var aqui = h('button', { class: 'bt leve', type: 'button' }, '📍 ' + T('usarOndeEstou'));
    var ok = h('button', { class: 'bt', type: 'button' }, T('salvar'));
    var pos = null;
    var j = janela(T('novoLugar'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('label', { class: 'rot', for: 'gx-nl-nome', texto: T('nome') }), nome, h('label', { class: 'rot', for: 'gx-nl-cat', texto: T('tipo') }), cat,
      h('label', { class: 'rot', for: 'gx-nl-end', texto: T('endereco') }), end, aqui, h('label', { class: 'rot', for: 'gx-nl-nota', texto: T('nota') }), nota, ok]));
    aqui.addEventListener('click', function () { pegarPosicao().then(function (p) { pos = p; aqui.textContent = '📍 ✓ ±' + p.precisao + ' m'; }); });
    ok.addEventListener('click', function () {
      if (!nome.value.trim()) { nome.focus(); return; }
      Banco.gravar('lugares', { nome: nome.value.trim(), categoria: cat.value, subcategoria: null, descricao: nota.value.trim() || null, endereco: end.value.trim() || null,
        lat: pos ? +pos.lat.toFixed(5) : null, lng: pos ? +pos.lng.toFixed(5) : null, confianca: 'meu', gratis: false, viagem_id: estado.viagem ? estado.viagem.id : null })
        .then(function () { j.fechar(); avisar(T('salvo')); recarregar(); });
    });
  }
  function pegarPosicao() {
    return Geo.agora().then(function (p) {
      estado.pos = p;
      if (p.precisao > 100) avisar(T('gpsFraco', { m: p.precisao }));
      return p;
    }).catch(function (e) {
      avisar(e.message === 'negado' ? T('gpsNegado') : T('gpsErro'));
      throw e;
    });
  }

  /* ---------- Mapa ---------- */
  TELAS.mapa = function (tela) {
    tela.appendChild(h('div', { class: 'linha entre' }, [h('h1', { texto: T('rota_mapa') }),
      h('button', { class: 'bt sec', type: 'button', onclick: function () { pegarPosicao().then(function () { mostrar('mapa'); }); } }, '📍 ' + T('ondeEstou'))]));
    var caixa = h('div', { id: 'mapa', role: 'application', 'aria-label': T('rota_mapa') });
    tela.appendChild(caixa);
    var info = h('p', { class: 'pequeno', texto: navigator.onLine ? '© OpenStreetMap contributors' : T('mapaOffline') });
    tela.appendChild(info);
    carregarLeaflet().then(function (L) {
      var c = estado.pos || centroViagem() || { lat: -15.78, lng: -47.93 };
      var m = L.map(caixa, { zoomControl: true }).setView([c.lat, c.lng], centroViagem() ? 13 : 4);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
      todosLugares().concat(estado.descobertas).forEach(function (l) {
        if (l.lat == null) return;
        var fav = estado.favoritos['lugar:' + l.id];
        var mk = L.circleMarker([l.lat, l.lng], { radius: fav ? 9 : 7, color: '#fff', weight: 2, fillColor: l.categoria === 'logistica' ? '#16222b' : (fav ? '#9a7330' : '#6b3f1f'), fillOpacity: 1 }).addTo(m);
        var div = d.createElement('div');
        div.appendChild(h('b', { texto: l.nome })); div.appendChild(d.createElement('br'));
        div.appendChild(h('a', { href: Geo.linkRota(l, estado.pos), target: '_blank', rel: 'noopener', texto: T('rota') }));
        mk.bindPopup(div);
      });
      if (estado.pos) L.circleMarker([estado.pos.lat, estado.pos.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#1e5b48', fillOpacity: 1 }).addTo(m).bindPopup(T('voceAqui'));
    }).catch(function () { caixa.textContent = T('mapaErro'); });
  };
  var leaflet = null;
  function carregarLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leaflet) return leaflet;
    leaflet = new Promise(function (ok, erro) {
      var css = h('link', { rel: 'stylesheet', href: 'vendor/leaflet/leaflet.css' }); d.head.appendChild(css);
      var s = h('script', { src: 'vendor/leaflet/leaflet.js' });
      s.onload = function () { ok(window.L); }; s.onerror = function () { leaflet = null; erro(new Error('leaflet')); };
      d.head.appendChild(s);
    });
    return leaflet;
  }

  /* ---------- Reservas (no cofre) ---------- */
  var TIPOS_RES = ['voo', 'hotel', 'carro', 'ingresso', 'restaurante', 'outro'];
  TELAS.reservas = function (tela) {
    tela.appendChild(h('h1', { texto: T('rota_reservas') }));
    tela.appendChild(h('p', { class: 'sub', texto: T('reservasTexto') }));
    if (!estado.viagem) return semViagem(tela);
    pedirCofre(tela, function () {
      Banco.listar('reservas', function (r) { return r.viagem_id === estado.viagem.id; }).then(function (lista) {
        return Promise.all(lista.map(function (r) { return Cofre.decifrar(r.conteudo).then(function (c) { return { reg: r, c: c }; }); }));
      }).then(function (itens) {
        itens.sort(function (a, b) { return (a.c.quando || '') < (b.c.quando || '') ? -1 : 1; });
        tela.appendChild(h('button', { class: 'bt', type: 'button', onclick: function () { janelaReserva(null); } }, '＋ ' + T('novaReserva')));
        if (!itens.length) tela.appendChild(h('p', { class: 'sub', texto: T('semReservas') }));
        itens.forEach(function (x) {
          var c = x.c;
          tela.appendChild(h('div', { class: 'cartao' }, [
            h('span', { class: 'pequeno', texto: T('res_' + c.tipo) }),
            h('b', { texto: c.titulo }),
            c.quando ? h('span', { texto: fData(c.quando.slice(0, 10)) + (c.quando.length > 10 ? ' · ' + c.quando.slice(11, 16) : '') }) : null,
            c.codigo ? h('span', { class: 'linha' }, [T('codigo') + ': ', h('code', { texto: c.codigo, style: 'user-select:all' })]) : null,
            c.local ? h('span', { class: 'sub', texto: c.local }) : null,
            c.nota ? h('span', { class: 'sub', texto: c.nota }) : null,
            h('div', { class: 'linha' }, [h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaReserva(x); } }, T('editar'))])
          ]));
        });
        tela.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: function () { Cofre.fechar(); mostrar('reservas'); } }, '🔒 ' + T('fecharCofre')));
      }).catch(function () { tela.appendChild(h('div', { class: 'alerta', texto: T('cofreErro') })); });
    });
  };
  function janelaReserva(x) {
    var c = x ? x.c : {};
    var campos = {
      tipo: h('select', { class: 'campo', id: 'gx-r-tipo' }, TIPOS_RES.map(function (t) { return h('option', { value: t, selected: c.tipo === t }, T('res_' + t)); })),
      titulo: h('input', { class: 'campo', id: 'gx-r-tit', maxlength: '100', value: c.titulo || '', placeholder: T('exReserva') }),
      quando: h('input', { class: 'campo', id: 'gx-r-quando', type: 'datetime-local', value: c.quando || '' }),
      codigo: h('input', { class: 'campo', id: 'gx-r-cod', maxlength: '40', value: c.codigo || '', placeholder: 'ABC123' }),
      local: h('input', { class: 'campo', id: 'gx-r-local', maxlength: '160', value: c.local || '' }),
      nota: h('textarea', { class: 'campo', id: 'gx-r-nota', maxlength: '500', rows: '3' }, c.nota || '')
    };
    var ok = h('button', { class: 'bt', type: 'button' }, T('salvar'));
    var apagar = x ? h('button', { class: 'bt perigo', type: 'button' }, T('apagar')) : null;
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('label', { class: 'rot', for: 'gx-r-tipo', texto: T('tipo') }), campos.tipo, h('label', { class: 'rot', for: 'gx-r-tit', texto: T('titulo') }), campos.titulo,
      h('label', { class: 'rot', for: 'gx-r-quando', texto: T('quando') }), campos.quando, h('label', { class: 'rot', for: 'gx-r-cod', texto: T('codigo') }), campos.codigo,
      h('label', { class: 'rot', for: 'gx-r-local', texto: T('local') }), campos.local, h('label', { class: 'rot', for: 'gx-r-nota', texto: T('nota') }), campos.nota,
      h('div', { class: 'acoes' }, [apagar, ok])]);
    var j = janela(x ? T('editar') : T('novaReserva'), corpo);
    ok.addEventListener('click', function () {
      if (!campos.titulo.value.trim()) { campos.titulo.focus(); return; }
      var dados = { tipo: campos.tipo.value, titulo: campos.titulo.value.trim(), quando: campos.quando.value, codigo: campos.codigo.value.trim(), local: campos.local.value.trim(), nota: campos.nota.value.trim() };
      Cofre.cifrar(dados).then(function (blob) {
        var reg = x ? x.reg : { viagem_id: estado.viagem.id };
        reg.conteudo = blob; reg.tipo = dados.tipo; /* o tipo fica aberto para ícone; o resto embaralhado */
        return Banco.gravar('reservas', reg);
      }).then(function () { j.fechar(); avisar(T('salvo')); mostrar('reservas'); }).catch(function () { avisar(T('cofreFechou')); j.fechar(); mostrar('reservas'); });
    });
    if (apagar) apagar.addEventListener('click', function () { Banco.apagar('reservas', x.reg.id).then(function () { j.fechar(); mostrar('reservas'); }); });
  }

  /* pede o PIN (ou cria o cofre) e depois chama "pronto" */
  function pedirCofre(tela, pronto) {
    if (Cofre.aberto()) { pronto(); return; }
    Cofre.existe().then(function (existe) {
      var pin = h('input', { class: 'campo', id: 'gx-pin', type: 'password', inputmode: 'numeric', autocomplete: existe ? 'current-password' : 'new-password', maxlength: '6', placeholder: '••••••' });
      var msg = h('p', { class: 'pequeno', role: 'status', 'aria-live': 'polite' });
      var bt = h('button', { class: 'bt', type: 'button' }, existe ? T('abrirCofre') : T('criarCofre'));
      var caixa = h('div', { class: 'cartao' }, [
        h('h3', { texto: existe ? T('cofreFechado') : T('cofreNovo') }),
        h('p', { class: 'sub', texto: existe ? T('cofreFechadoTexto') : T('cofreNovoTexto') }),
        h('label', { class: 'rot', for: 'gx-pin', texto: T('pin6') }), pin, bt, msg]);
      if (existe) caixa.appendChild(h('button', { class: 'lk', type: 'button', onclick: function () { recuperarCofre(tela, pronto); } }, T('esqueciPin')));
      tela.appendChild(caixa);
      if (existe && Bio.ligada()) Cofre.temBio().then(function (t) {
        if (!t) return;
        var bb = h('button', { class: 'bt', type: 'button', texto: T('abrirBio') });
        bb.addEventListener('click', function () {
          bb.disabled = true;
          Bio.chaves().then(function (k) { return Cofre.abrirComBio(k.cofre); }).then(function () { caixa.remove(); pronto(); })
            .catch(function (e) { bb.disabled = false; msg.textContent = e.message === 'cancelado' ? '' : T('bioErroUsePin'); });
        });
        caixa.insertBefore(bb, caixa.children[2]);
        bt.className = 'bt leve';
      });
      function ir() {
        if (!/^\d{6}$/.test(pin.value)) { msg.textContent = T('pinFormato'); pin.focus(); return; }
        bt.disabled = true; msg.textContent = T('abrindo');
        (existe ? Cofre.abrir(pin.value) : Cofre.criar(pin.value).then(mostrarCodigo).then(function () {
          if (Bio.ligada()) return Bio.chaves().then(function (k) { return Cofre.ligarBio(k.cofre); }).catch(function () {});
        })).then(function () { caixa.remove(); pronto(); }).catch(function (e) {
          bt.disabled = false;
          msg.textContent = e.message === 'espera' ? T('pinEspera', { s: e.segundos }) : e.message === 'pin-errado' ? T('pinErrado', { n: e.tentativas }) : T('cofreErro');
        });
      }
      bt.addEventListener('click', ir);
      pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') ir(); });
    });
  }
  function mostrarCodigo(codigo) {
    return new Promise(function (ok) {
      var cod = h('code', { texto: codigo, style: 'font-size:1.2rem;user-select:all;display:block;padding:.5rem;background:var(--serra-claro);border-radius:6px' });
      var copiar = h('button', { class: 'bt leve', type: 'button', onclick: function () {
        navigator.clipboard.writeText(codigo).then(function () { avisar(T('copiado')); setTimeout(function () { navigator.clipboard.writeText('').catch(function () {}); }, 30000); }).catch(function () { avisar(T('copieManual')); });
      } }, T('copiar'));
      var feito = h('button', { class: 'bt', type: 'button' }, T('anotei'));
      var j = janela(T('codigoRecuperacao'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
        h('p', { texto: T('codigoRecuperacaoTexto') }), cod, copiar, feito]), ok);
      feito.addEventListener('click', function () { j.fechar(); });
    });
  }
  function recuperarCofre(tela, pronto) {
    var cod = h('input', { class: 'campo', id: 'gx-rec', autocomplete: 'off', placeholder: 'XXXXX-XXXXX-XXXXX-XXXXX' });
    var novo = h('input', { class: 'campo', id: 'gx-rec-pin', type: 'password', inputmode: 'numeric', maxlength: '6' });
    var ok = h('button', { class: 'bt', type: 'button' }, T('trocarPin'));
    var msg = h('p', { class: 'pequeno', role: 'status' });
    var j = janela(T('esqueciPin'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('label', { class: 'rot', for: 'gx-rec', texto: T('codigoRecuperacao') }), cod, h('label', { class: 'rot', for: 'gx-rec-pin', texto: T('novoPin') }), novo, ok, msg]));
    ok.addEventListener('click', function () {
      if (!/^\d{6}$/.test(novo.value)) { msg.textContent = T('pinFormato'); return; }
      Cofre.abrir(cod.value, true).then(function () { return Cofre.trocarPin(novo.value); }).then(function () { j.fechar(); avisar(T('pinTrocado')); mostrar(estado.rota); })
        .catch(function (e) { msg.textContent = e.message === 'espera' ? T('pinEspera', { s: e.segundos }) : T('codigoErrado'); });
    });
  }

  /* ---------- Família (perfil) ---------- */
  var PARENTESCO = ['eu', 'conjuge', 'filho', 'pai', 'sogro', 'avo', 'neto', 'irmao', 'amigo', 'outro'];
  var DIETAS = ['vegetariano', 'vegano', 'kosher', 'halal'];
  var ALERGIAS = ['semGluten', 'lactose', 'aplv', 'amendoim', 'frutosMar', 'ovo'];
  function faixa(idade) { if (idade === '' || idade == null) return 'adulto'; idade = +idade; return idade < 2 ? 'bebe' : idade < 12 ? 'crianca' : idade < 18 ? 'adolescente' : idade >= 65 ? 'idoso' : 'adulto'; }
  function listaRestricoes(r, lg) {
    var out = [];
    DIETAS.concat(ALERGIAS).forEach(function (k) { if (r[k]) out.push(T('r_' + k, null, lg)); });
    if (r.seletivo) out.push(T('r_seletivo', null, lg) + (r.seletivoTexto ? ' (' + r.seletivoTexto + ')' : ''));
    if (r.outra) out.push(r.outra);
    return out;
  }
  var cacheRestr = [];
  function restricoesDoGrupo() { return cacheRestr; }
  function atualizarRestricoesGrupo() {
    cacheRestr = [];
    if (!Cofre.aberto() || !estado.viagem) return Promise.resolve();
    var ps = estado.pessoas.filter(function (p) { return (estado.viagem.pessoas || []).indexOf(p.id) > -1 && p.restricoes; });
    return Promise.all(ps.map(function (p) { return Cofre.decifrar(p.restricoes).catch(function () { return null; }); })).then(function (rs) {
      var s = {}; rs.forEach(function (r) { if (r) listaRestricoes(r).forEach(function (x) { s[x] = 1; }); });
      cacheRestr = Object.keys(s);
    });
  }

  TELAS.familia = function (tela) {
    tela.appendChild(h('h1', { texto: T('rota_familia') }));
    tela.appendChild(h('p', { class: 'sub', texto: T('familiaTexto') }));
    tela.appendChild(h('button', { class: 'bt', type: 'button', onclick: function () { janelaPessoa(null); } }, '＋ ' + T('addPessoa')));
    if (!estado.pessoas.length) tela.appendChild(h('p', { class: 'sub', texto: T('semPessoas') }));
    var v = estado.viagem, naViagem = v && v.pessoas || [];
    [['familia', 'grupoFamilia', 'grupoFamiliaTexto'], ['convidado', 'grupoConvidados', 'grupoConvidadosTexto'], ['viagem', 'grupoSoViagem', 'grupoSoViagemTexto']].forEach(function (gr) {
      var ps = estado.pessoas.filter(function (p) { return grupoDe(p) === gr[0]; });
      if (!ps.length) return;
      tela.appendChild(h('div', { class: 'secao-cab' }, [h('h2', { texto: T(gr[1]) }), h('p', { class: 'pequeno', texto: T(gr[2]) })]));
      ps.forEach(function (p) { tela.appendChild(cartaoPessoa(p, v && naViagem.indexOf(p.id) > -1 ? v : null)); });
    });
  };
  function cartaoPessoa(p, v) {
    var x = v ? perfilNaViagem(p, v) : p;
    var nome = p.apelido || T('par_' + p.parentesco), g = contarGostos(x.gostos);
    var marc = [T('par_' + p.parentesco), p.idade !== '' && p.idade != null ? T('anos', { n: p.idade }) : null,
      x.mobilidade && x.mobilidade !== 'normal' ? T('mob_' + x.mobilidade) : null, x.calor ? T('sensCalor') : null, x.frio ? T('sensFrio') : null,
      x.soneca ? T('soneca') : null, p.restricoes ? '🔒 ' + T('temRestricoes') : null].filter(Boolean);
    return h('div', { class: 'cartao pessoa-cartao' }, [
      h('span', { class: 'avatar', 'aria-hidden': 'true', texto: nome.trim().charAt(0).toUpperCase() }),
      h('b', { class: 'nomeP', texto: nome }),
      h('div', { class: 'marcadores' }, marc.map(function (m) { return h('span', { texto: m }); })),
      x._ajustado ? h('p', { class: 'ajustado', texto: T('ajustadoNaViagem', { viagem: v.nome }) }) : null,
      g.total ? h('div', { class: 'resumo-gostos', style: 'grid-column:1/-1;margin-top:.35rem' }, topGostos(x.gostos, 6).map(function (id) {
        return h('span', { class: 'gosto', 'data-v': String(x.gostos[id]), texto: Gostos.nome(id, idioma()) }); })) : null,
      h('div', { class: 'botoes' }, [
        h('button', { class: 'bt sec', type: 'button', onclick: function () { janelaGostos(p, function () { mostrar('familia'); }); } }, contarGostos(p.gostos).total ? T('gostosN', { n: contarGostos(p.gostos).total }) : T('marcarGostos')),
        h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaPessoa(p); } }, T('editar')),
        v ? h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaAjuste(p, v, function () { mostrar('familia'); }); } }, T('ajustarViagem')) : null,
        p.restricoes ? h('button', { class: 'bt leve', type: 'button', onclick: function () { cartaoAlergia(p); } }, T('cartaoAlergia')) : null
      ])
    ]);
  }

  /* "Mudar só nesta viagem": guarda só as diferenças em viagem.ajustes; o perfil fixo não muda */
  function janelaAjuste(p, v, depois) {
    var x = perfilNaViagem(p, v), nome = p.apelido || T('par_' + p.parentesco);
    var a = Object.assign({}, v.ajustes && v.ajustes[p.id] || {});
    var mob = h('select', { class: 'campo', id: 'gx-a-mob' }, ['normal', 'evitaSubidas', 'cadeira', 'carrinho'].map(function (k) { return h('option', { value: k, selected: x.mobilidade === k }, T('mob_' + k)); }));
    var chk = function (id, k, rot) { var c = h('input', { type: 'checkbox', id: id }); c.checked = !!x[k]; return [c, h('label', { for: id, texto: ' ' + rot })]; };
    var calor = chk('gx-a-calor', 'calor', T('sensCalor')), frio = chk('gx-a-frio', 'frio', T('sensFrio')), son = chk('gx-a-soneca', 'soneca', T('soneca'));
    var nG = function () { var gg = a.gostos ? Object.keys(a.gostos).length : 0; return gg ? T('gostosViagemN', { n: gg }) : T('gostosViagem'); };
    var bG = h('button', { class: 'bt sec', type: 'button', texto: nG() });
    var ok = h('button', { class: 'bt', type: 'button', texto: T('salvar') });
    var voltar = v.ajustes && v.ajustes[p.id] ? h('button', { class: 'bt perigo', type: 'button', texto: T('voltarPerfilFixo') }) : null;
    var j = janela(T('ajusteTitulo', { nome: nome }), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { class: 'sub', texto: T('ajusteTexto', { viagem: v.nome }) }),
      h('label', { class: 'rot', for: 'gx-a-mob', texto: T('mobilidade') }), mob,
      h('div', {}, calor), h('div', {}, frio), h('div', {}, son), bG,
      h('p', { class: 'dica', texto: T('ajusteComida') }),
      h('div', { class: 'acoes' }, [voltar, ok])]), depois);
    function gravar(fechar) {
      var ajustes = Object.assign({}, v.ajustes || {});
      var limpo = {};
      CAMPOS_AJUSTE.forEach(function (k) { if (a[k] !== undefined && a[k] !== (k === 'mobilidade' ? (p[k] || 'normal') : !!p[k])) limpo[k] = a[k]; });
      if (a.gostos && Object.keys(a.gostos).length) limpo.gostos = a.gostos;
      if (Object.keys(limpo).length) ajustes[p.id] = limpo; else delete ajustes[p.id];
      v.ajustes = ajustes;
      return Banco.gravar('viagens', v).then(function (nv) { if (estado.viagem && estado.viagem.id === nv.id) estado.viagem = nv; v = nv; if (fechar) { avisar(T('salvo')); j.fechar(); } });
    }
    function lerCampos() { a.mobilidade = mob.value; a.calor = calor[0].checked; a.frio = frio[0].checked; a.soneca = son[0].checked; }
    bG.addEventListener('click', function () {
      lerCampos();
      janelaGostos(p, function () { bG.textContent = nG(); }, {
        titulo: T('gostosNaViagem', { nome: nome }), gostos: perfilNaViagem(p, v).gostos,
        salvar: function (novo) {
          /* diferença em relação ao perfil fixo: 0 = "não nesta viagem" */
          var base = p.gostos || {}, dif = {};
          Object.keys(novo).forEach(function (id) { if (novo[id] !== base[id]) dif[id] = novo[id]; });
          Object.keys(base).forEach(function (id) { if (!novo[id]) dif[id] = 0; });
          a.gostos = dif; gravar(false);
        }
      });
    });
    ok.addEventListener('click', function () { lerCampos(); gravar(true); });
    if (voltar) voltar.addEventListener('click', function () {
      var ajustes = Object.assign({}, v.ajustes || {}); delete ajustes[p.id]; v.ajustes = ajustes;
      Banco.gravar('viagens', v).then(function (nv) { if (estado.viagem && estado.viagem.id === nv.id) estado.viagem = nv; avisar(T('voltouPerfil')); j.fechar(); });
    });
  }
  function contarGostos(g) {
    var c = { ama: 0, curte: 0, evita: 0, total: 0 };
    Object.keys(g || {}).forEach(function (id) { var v = g[id]; if (v === 2) c.ama++; else if (v === 1) c.curte++; else if (v === -1) c.evita++; else return; c.total++; });
    return c;
  }
  /* os mais fortes primeiro: ama, curte, evita */
  function topGostos(g, n) {
    var peso = { 2: 0, 1: 1, '-1': 2 };
    return Object.keys(g || {}).filter(function (id) { return g[id] && Gostos.item(id); })
      .sort(function (a, b) { return peso[g[a]] - peso[g[b]]; }).slice(0, n);
  }

  /* Gostos: tocar muda o estado (curte → ama → evita → nada). Ao marcar,
     os parecidos do mesmo grupinho aparecem logo ao lado. Salva a cada toque. */
  function janelaGostos(p, depois, modo) {
    modo = modo || {};
    var g = Object.assign({}, modo.gostos || p.gostos || {}), lg = idioma(), nome = p.apelido || T('par_' + p.parentesco);
    var abertos = {}, novos = {};
    var corpo = h('div', { style: 'display:flex;flex-direction:column;gap:.4rem;flex:1' });
    var j = janela(modo.titulo || T('gostosTitulo', { nome: nome }), corpo, function () { if (depois) depois(); });
    j.caixa.classList.add('cheia');
    var busca = h('input', { class: 'campo', type: 'search', id: 'gx-gosto-busca', placeholder: T('buscarGosto'), 'aria-label': T('buscarGosto'), autocomplete: 'off' });
    var temas = h('div', { class: 'temas', role: 'group', 'aria-label': T('temas') });
    corpo.appendChild(h('div', { class: 'gostos-cab' }, [
      h('div', { class: 'legenda' }, [
        h('span', {}, [h('i', { class: 'l1', 'aria-hidden': 'true', texto: '✓' }), T('toque1')]),
        h('span', {}, [h('i', { class: 'l2', 'aria-hidden': 'true', texto: '♥' }), T('toque2')]),
        h('span', {}, [h('i', { class: 'l3', 'aria-hidden': 'true', texto: '⊘' }), T('toque3')])
      ]), busca, temas]));
    var lista = h('div', {}); corpo.appendChild(lista);
    var resumo = h('p', { class: 'pequeno', 'aria-live': 'polite' });
    var pronto = h('button', { class: 'bt', type: 'button', texto: T('pronto'), onclick: function () { j.fechar(); } });
    corpo.appendChild(h('div', { class: 'gostos-pe' }, [resumo, pronto]));

    function salvar() {
      Object.keys(g).forEach(function (k) { if (!g[k]) delete g[k]; });
      if (modo.salvar) { modo.salvar(Object.assign({}, g)); return; }
      p.gostos = Object.assign({}, g);
      if (p.id) Banco.gravar('pessoas', p).then(function (nv) { p.versao = nv.versao; p.atualizado_em = nv.atualizado_em; });
    }
    function rotuloEstado(v) { return v === 1 ? T('toque1') : v === 2 ? T('toque2') : v === -1 ? T('toque3') : T('semMarca'); }
    function botao(it) {
      var b = h('button', { class: 'gosto' + (novos[it.id] ? ' novo' : ''), type: 'button', 'data-id': it.id, 'data-v': String(g[it.id] || 0), texto: it[lg] || it.pt,
        'aria-label': (it[lg] || it.pt) + ': ' + rotuloEstado(g[it.id]) });
      b.addEventListener('click', function () {
        g[it.id] = Gostos.proximo(g[it.id]);
        if (g[it.id] > 0) Gostos.parecidos(it.id, g).forEach(function (o) { if (!novos[o.id]) novos[o.id] = 1; });
        salvar(); desenhar(it.id);
      });
      return b;
    }
    function desenharTemas() {
      temas.textContent = '';
      Gostos.temas.forEach(function (t) {
        var n = 0; t.grupos.forEach(function (gr) { gr.forEach(function (it) { if (g[it.id]) n++; }); });
        temas.appendChild(h('button', { class: 'chip', type: 'button', onclick: function () {
          var alvo = lista.querySelector('[data-tema="' + t.id + '"]'); if (alvo) alvo.scrollIntoView({ block: 'start', behavior: 'smooth' }); } },
          [h('span', { 'aria-hidden': 'true', texto: t.icone }), t[lg] || t.pt, n ? h('em', { texto: String(n), 'aria-label': T('nMarcados', { n: n }) }) : null]));
      });
    }
    function desenhar(foco) {
      var c = contarGostos(g);
      resumo.textContent = c.total ? T('resumoGostos', { a: c.ama, c: c.curte, e: c.evita }) : T('nadaMarcado');
      desenharTemas();
      lista.textContent = '';
      var q = busca.value.trim();
      if (q) {
        var achados = Gostos.buscar(q, lg);
        lista.appendChild(h('div', { class: 'chips' }, achados.length ? achados.map(botao) : [h('p', { class: 'sub', texto: T('nadaAchado') })]));
      } else {
        Gostos.temas.forEach(function (t) {
          var todos = [], vis = [];
          t.grupos.forEach(function (gr) { gr.forEach(function (it, k) {
            todos.push(it);
            if (abertos[t.id] || k < 2 || g[it.id] || novos[it.id]) vis.push(it);
          }); });
          var resto = todos.length - vis.length;
          var chips = h('div', { class: 'chips' }, vis.map(botao));
          if (resto > 0) chips.appendChild(h('button', { class: 'mais', type: 'button', texto: T('verMais', { n: resto }), onclick: function () { abertos[t.id] = 1; desenhar(); } }));
          lista.appendChild(h('section', { class: 'tema-bloco', 'data-tema': t.id, 'aria-label': t[lg] || t.pt }, [
            h('h3', {}, [h('span', { 'aria-hidden': 'true', texto: t.icone }), t[lg] || t.pt]), chips]));
        });
      }
      /* o foco fica no mesmo item depois de redesenhar (teclado e leitor de tela) */
      if (foco) { var b = lista.querySelector('.gosto[data-id="' + foco + '"]'); if (b) b.focus(); }
    }
    busca.addEventListener('input', function () { desenhar(); });
    desenhar();
    /* não abrir o teclado do celular sozinho: o foco vai para o fechar */
    setTimeout(function () { var x = j.caixa.querySelector('.ic'); if (x) x.focus(); }, 60);
  }
  function janelaPessoa(p, novo) {
    p = p || Object.assign({}, novo || {});
    var apelido = h('input', { class: 'campo', id: 'gx-p-apelido', maxlength: '30', value: p.apelido || '', placeholder: T('exApelido') });
    var par = h('select', { class: 'campo', id: 'gx-p-par' }, PARENTESCO.map(function (x) { return h('option', { value: x, selected: p.parentesco === x }, T('par_' + x)); }));
    var idade = h('input', { class: 'campo', id: 'gx-p-idade', type: 'number', min: '0', max: '110', inputmode: 'numeric', value: p.idade != null ? p.idade : '' });
    var mob = h('select', { class: 'campo', id: 'gx-p-mob' }, ['normal', 'evitaSubidas', 'cadeira', 'carrinho'].map(function (x) { return h('option', { value: x, selected: p.mobilidade === x }, T('mob_' + x)); }));
    var grupo = h('select', { class: 'campo', id: 'gx-p-grupo' }, ['familia', 'convidado', 'viagem'].map(function (x) { return h('option', { value: x, selected: grupoDe(p) === x }, T('grupo_' + x)); }));
    var chk = function (id, k, rot) { var c = h('input', { type: 'checkbox', id: id }); c.checked = !!p[k]; return [c, h('label', { for: id, texto: ' ' + rot })]; };
    var calor = chk('gx-p-calor', 'calor', T('sensCalor')), frio = chk('gx-p-frio', 'frio', T('sensFrio')), son = chk('gx-p-soneca', 'soneca', T('soneca'));
    var bRestr = h('button', { class: 'bt leve', type: 'button' }, '🔒 ' + T('comidaSaude'));
    var bGostos = h('button', { class: 'bt sec', type: 'button' }, contarGostos(p.gostos).total ? T('gostosN', { n: contarGostos(p.gostos).total }) : T('marcarGostos'));
    bGostos.addEventListener('click', function () {
      if (!p.id) { avisar(T('salveAntes')); return; }
      janelaGostos(p, function () { bGostos.textContent = contarGostos(p.gostos).total ? T('gostosN', { n: contarGostos(p.gostos).total }) : T('marcarGostos'); });
    });
    var ok = h('button', { class: 'bt', type: 'button' }, T('salvar'));
    var apagar = p.id ? h('button', { class: 'bt perigo', type: 'button' }, T('apagar')) : null;
    var j = janela(p.id ? T('editar') : T('addPessoa'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('label', { class: 'rot', for: 'gx-p-apelido', texto: T('apelidoOpcional') }), apelido, h('p', { class: 'dica', texto: T('apelidoDica') }),
      h('div', { class: 'dois' }, [h('div', {}, [h('label', { class: 'rot', for: 'gx-p-par', texto: T('parentesco') }), par]), h('div', {}, [h('label', { class: 'rot', for: 'gx-p-idade', texto: T('idade') }), idade])]),
      h('label', { class: 'rot', for: 'gx-p-grupo', texto: T('fazParte') }), grupo, h('p', { class: 'dica', texto: T('fazParteDica') }),
      h('label', { class: 'rot', for: 'gx-p-mob', texto: T('mobilidade') }), mob,
      h('div', {}, calor), h('div', {}, frio), h('div', {}, son), bRestr, bGostos, h('div', { class: 'acoes' }, [apagar, ok])]));
    var novaRestr;
    bRestr.addEventListener('click', function () { janelaRestricoes(p, function (r) { novaRestr = r; bRestr.textContent = '🔒 ' + T('comidaSaude') + ' ✓'; }); });
    ok.addEventListener('click', function () {
      var reg = Object.assign({}, p, { apelido: apelido.value.trim(), parentesco: par.value, idade: idade.value === '' ? '' : Math.max(0, Math.min(110, +idade.value)),
        mobilidade: mob.value, calor: calor[0].checked, frio: frio[0].checked, soneca: son[0].checked, grupo: grupo.value });
      reg.faixa = faixa(reg.idade);
      (novaRestr !== undefined ? (novaRestr ? Cofre.cifrar(novaRestr) : Promise.resolve(null)).then(function (b) { reg.restricoes = b; }) : Promise.resolve())
        .then(function () { return Banco.gravar('pessoas', reg); })
        .then(function (salva) { j.fechar(); avisar(T('salvo')); if (janelaPessoa.depois) { var f = janelaPessoa.depois; janelaPessoa.depois = null; f(salva); } else recarregar(); });
    });
    if (apagar) apagar.addEventListener('click', function () { Banco.apagar('pessoas', p.id).then(function () { j.fechar(); recarregar(); }); });
  }
  /* comida e saúde: dado sensível (LGPD) → só dentro do cofre */
  function janelaRestricoes(p, pronto) {
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' });
    var j = janela(T('comidaSaude'), corpo);
    pedirCofre(corpo, function () {
      (p.restricoes ? Cofre.decifrar(p.restricoes) : Promise.resolve({})).then(function (r) {
        r = r || {};
        corpo.appendChild(h('p', { class: 'sub', texto: T('restricoesTexto') }));
        var marcas = {};
        var grupo = function (titulo, lista) {
          return h('fieldset', {}, [h('legend', { texto: titulo })].concat(lista.map(function (k) {
            var c = h('input', { type: 'checkbox', id: 'gx-r-' + k }); c.checked = !!r[k]; marcas[k] = c;
            return h('div', {}, [c, h('label', { for: 'gx-r-' + k, texto: ' ' + T('r_' + k) })]);
          })));
        };
        corpo.appendChild(grupo(T('dietas'), DIETAS));
        corpo.appendChild(grupo(T('alergias'), ALERGIAS));
        var sel = h('input', { type: 'checkbox', id: 'gx-r-sel' }); sel.checked = !!r.seletivo;
        var selTxt = h('input', { class: 'campo', id: 'gx-r-seltxt', maxlength: '120', value: r.seletivoTexto || '', placeholder: T('exSeletivo') });
        var outra = h('input', { class: 'campo', id: 'gx-r-outra', maxlength: '120', value: r.outra || '', placeholder: T('exOutra') });
        corpo.appendChild(h('fieldset', {}, [h('legend', { texto: T('r_seletivo') }), h('div', {}, [sel, h('label', { for: 'gx-r-sel', texto: ' ' + T('seletivoPergunta') })]), selTxt]));
        corpo.appendChild(h('label', { class: 'rot', for: 'gx-r-outra', texto: T('outraRestricao') })); corpo.appendChild(outra);
        var ok = h('button', { class: 'bt', type: 'button' }, T('pronto'));
        corpo.appendChild(ok);
        ok.addEventListener('click', function () {
          var nr = { seletivo: sel.checked, seletivoTexto: selTxt.value.trim(), outra: outra.value.trim() };
          Object.keys(marcas).forEach(function (k) { nr[k] = marcas[k].checked; });
          var vazio = !listaRestricoes(nr).length;
          pronto(vazio ? null : nr); j.fechar();
        });
      });
    });
  }
  function cartaoAlergia(p) {
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' });
    janela(T('cartaoAlergia'), corpo);
    pedirCofre(corpo, function () {
      Cofre.decifrar(p.restricoes).then(function (r) {
        var lista = function (lg) { return listaRestricoes(r || {}, lg); };
        var bloco = function (lg, titulo) {
          return h('div', { class: 'cartao', lang: lg === 'en' ? 'en' : 'pt-BR' }, [h('b', { texto: titulo }), h('ul', {}, lista(lg).map(function (x) { return h('li', { texto: x }); }))]);
        };
        corpo.appendChild(h('p', { class: 'sub', texto: T('cartaoAlergiaTexto') }));
        corpo.appendChild(bloco('pt', 'Esta pessoa NÃO pode consumir / evita:'));
        corpo.appendChild(bloco('en', 'This person CANNOT eat / avoids:'));
      });
    });
  }

  /* ---------- Viagens ---------- */
  TELAS.viagens = function (tela) {
    tela.appendChild(h('div', { class: 'linha entre' }, [h('h1', { texto: T('rota_viagens') }), h('button', { class: 'bt', type: 'button', onclick: function () { Nav.ir('nova'); } }, '＋ ' + T('rota_nova'))]));
    Banco.listar('viagens').then(function (vs) {
      vs.sort(function (a, b) { return a.inicio > b.inicio ? -1 : 1; });
      if (!vs.length) tela.appendChild(h('p', { class: 'sub', texto: T('semViagemTexto') }));
      vs.forEach(function (v) {
        var atual = estado.viagem && estado.viagem.id === v.id;
        tela.appendChild(h('div', { class: 'cartao', style: atual ? 'border-color:var(--serra)' : null }, [
          h('div', { class: 'linha entre' }, [h('b', { texto: v.nome }), atual ? h('span', { class: 'etq gratis', texto: T('emUso') }) : null]),
          h('span', { class: 'sub', texto: fData(v.inicio) + ' – ' + fData(v.fim) + ' · ' + T('nPessoas', { n: (v.pessoas || []).length }) }),
          h('div', { class: 'linha' }, [
            !atual ? h('button', { class: 'bt sec', type: 'button', onclick: function () { Banco.definirMeta('viagem-atual', v.id).then(function () { return carregarViagem(v.id); }).then(function () { Nav.ir('inicio'); }); } }, T('abrirViagem')) : null,
            h('button', { class: 'bt perigo', type: 'button', onclick: function () { confirmarApagarViagem(v); } }, T('apagar'))
          ])
        ]));
      });
    });
  };
  function confirmarApagarViagem(v) {
    var campo = h('input', { class: 'campo', id: 'gx-apagar-nome', autocomplete: 'off' });
    var bt = h('button', { class: 'bt perigo', type: 'button' }, T('apagarViagem'));
    var j = janela(T('apagarViagem'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { texto: T('apagarViagemTexto', { nome: v.nome }) }), h('label', { class: 'rot', for: 'gx-apagar-nome', texto: T('digiteNome') }), campo, bt]));
    bt.addEventListener('click', function () {
      if (campo.value.trim() !== v.nome) { campo.focus(); avisar(T('nomeNaoConfere')); return; }
      Banco.listar('roteiros', function (r) { return r.viagem_id === v.id; }).then(function (rs) {
        return Promise.all(rs.map(function (r) { return Banco.apagar('roteiros', r.id); }));
      }).then(function () { return Banco.apagar('viagens', v.id); }).then(function () {
        return Banco.listar('viagens').then(function (outras) {
          var usados = {}; outras.forEach(function (o) { (o.pessoas || []).forEach(function (id) { usados[id] = 1; }); });
          var soDela = estado.pessoas.filter(function (p) { return grupoDe(p) === 'viagem' && (v.pessoas || []).indexOf(p.id) > -1 && !usados[p.id]; });
          return Promise.all(soDela.map(function (p) { return Banco.apagar('pessoas', p.id); }));
        });
      }).then(function () { j.fechar(); return carregarViagem(); }).then(function () { Nav.ir('viagens'); });
    });
  }

  /* ------------------------------------------------------------------
     7. WIZARD "NOVA VIAGEM" — Passo X de N, Voltar/Próximo, guarda o
     rascunho para continuar depois. Reaproveita a família já cadastrada.
     ------------------------------------------------------------------ */
  var PASSOS = ['destino', 'datas', 'quem', 'estilo', 'estadia', 'pronto'];
  TELAS.nova = function (tela) {
    var r = estado.rascunho || (estado.rascunho = { passo: 0, destino: null, destinoTexto: '', inicio: '', fim: '', pessoas: estado.pessoas.filter(function (p) { return grupoDe(p) === 'familia'; }).map(function (p) { return p.id; }), preferencias: { ritmo: 'equilibrado', orcamento: 'medio', interesses: [], transporte: 'carro' }, estadias: [], usarPacote: true, ia: false });
    var i = r.passo, total = PASSOS.length;
    tela.appendChild(h('p', { class: 'passo', texto: T('passoDe', { i: i + 1, n: total }) }));
    tela.appendChild(h('div', { class: 'progresso', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(total), 'aria-valuenow': String(i + 1) }, h('i', { style: 'width:' + Math.round((i + 1) / total * 100) + '%' })));
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.75rem' });
    tela.appendChild(corpo);
    var erro = h('p', { class: 'conferir', role: 'alert' });
    var voltar = h('button', { class: 'bt leve', type: 'button', disabled: i === 0, onclick: function () { r.passo--; mostrar('nova'); } }, T('voltar'));
    var prox = h('button', { class: 'bt', type: 'button' }, i === total - 1 ? T('criarViagem') : T('proximo'));
    var validar = function () { return true; };
    PASSO[PASSOS[i]](corpo, r, function (f) { validar = f; });
    tela.appendChild(erro);
    tela.appendChild(h('div', { class: 'acoes' }, [voltar, prox]));
    prox.addEventListener('click', function () {
      var msg = validar();
      if (msg !== true) { erro.textContent = msg; return; }
      if (i < total - 1) { r.passo++; mostrar('nova'); return; }
      prox.disabled = true; prox.textContent = T('criando');
      criarViagem(r).then(function () { estado.rascunho = null; Nav.ir('roteiro', { substituir: true }); }).catch(function () { prox.disabled = false; erro.textContent = T('erroSalvar'); });
    });
  };
  var PASSO = {};
  PASSO.destino = function (c, r, val) {
    c.appendChild(h('h1', { texto: T('pDestino') }));
    var lista = h('div', { class: 'grade' }); c.appendChild(lista);
    var outro = h('input', { class: 'campo', id: 'gx-w-outro', maxlength: '80', value: r.destino ? '' : r.destinoTexto, placeholder: T('exCidade') });
    Pacotes.indice().then(function (ps) {
      ps.forEach(function (p) {
        lista.appendChild(h('button', { class: 'chip', type: 'button', style: 'text-align:left;padding:.75rem;border-radius:10px', 'aria-pressed': r.destino === p.id ? 'true' : 'false', onclick: function () { r.destino = p.id; r.destinoTexto = Pacotes.nome(p, idioma()); r.centro = p.centro; mostrar('nova'); } },
          [h('b', { texto: Pacotes.nome(p, idioma()) }), h('br'), h('span', { class: 'pequeno', texto: (p.resumo && (p.resumo[idioma()] || p.resumo.pt)) || '' })]));
      });
    });
    c.appendChild(h('label', { class: 'rot', for: 'gx-w-outro', texto: T('outraCidade') }));
    c.appendChild(outro);
    c.appendChild(h('p', { class: 'dica', texto: T('outraCidadeDica') }));
    outro.addEventListener('input', function () { if (outro.value.trim()) { r.destino = null; r.destinoTexto = outro.value.trim(); r.centro = null; } });
    val(function () { return (r.destino || r.destinoTexto) ? true : T('faltaDestino'); });
  };
  PASSO.datas = function (c, r, val) {
    c.appendChild(h('h1', { texto: T('pDatas') }));
    var ini = h('input', { class: 'campo', type: 'date', id: 'gx-w-ini', value: r.inicio });
    var fim = h('input', { class: 'campo', type: 'date', id: 'gx-w-fim', value: r.fim });
    c.appendChild(h('div', { class: 'dois' }, [h('div', {}, [h('label', { class: 'rot', for: 'gx-w-ini', texto: T('ida') }), ini]), h('div', {}, [h('label', { class: 'rot', for: 'gx-w-fim', texto: T('volta') }), fim])]));
    ini.addEventListener('change', function () { r.inicio = ini.value; if (!r.fim || r.fim < r.inicio) { r.fim = r.inicio; fim.value = r.inicio; } });
    fim.addEventListener('change', function () { r.fim = fim.value; });
    val(function () {
      if (!r.inicio || !r.fim) return T('faltaDatas');
      if (r.fim < r.inicio) return T('voltaAntes');
      if ((dataDe(r.fim) - dataDe(r.inicio)) / 86400000 > 59) return T('viagemLonga');
      return true;
    });
  };
  PASSO.quem = function (c, r, val) {
    c.appendChild(h('h1', { texto: T('pQuem') }));
    c.appendChild(h('p', { class: 'sub', texto: T('pQuemTexto') }));
    var depoisEditar = function () { Banco.listar('pessoas').then(function (ps) { estado.pessoas = ps; mostrar('nova'); }); };
    [['familia', 'grupoFamilia'], ['convidado', 'grupoConvidados'], ['viagem', 'grupoSoEsta']].forEach(function (gr) {
      /* "só de uma viagem" de outra viagem não aparece aqui */
      var ps = estado.pessoas.filter(function (p) { return grupoDe(p) === gr[0] && (gr[0] !== 'viagem' || r.pessoas.indexOf(p.id) > -1); });
      if (!ps.length) return;
      c.appendChild(h('h2', { class: 'secao-cab', texto: T(gr[1]) }));
      ps.forEach(function (p) {
        var cb = h('input', { type: 'checkbox', id: 'gx-w-p-' + p.id }); cb.checked = r.pessoas.indexOf(p.id) > -1;
        cb.addEventListener('change', function () { r.pessoas = r.pessoas.filter(function (x) { return x !== p.id; }); if (cb.checked) r.pessoas.push(p.id); });
        c.appendChild(h('div', { class: 'cartao pessoa' }, [h('label', { for: 'gx-w-p-' + p.id }, [cb, ' ', h('b', { texto: p.apelido || T('par_' + p.parentesco) }), ' ', h('span', { class: 'pequeno', texto: T('par_' + p.parentesco) + (p.idade !== '' && p.idade != null ? ', ' + T('anos', { n: p.idade }) : '') })]),
          h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaPessoa.depois = depoisEditar; janelaPessoa(p); } }, T('editar'))]));
      });
    });
    var add = function (grupo) {
      return function () {
        janelaPessoa.depois = function (nova) { r.pessoas.push(nova.id); depoisEditar(); };
        janelaPessoa(null, { grupo: grupo });
      };
    };
    c.appendChild(h('div', { class: 'grade' }, [
      h('button', { class: 'bt sec', type: 'button', onclick: add('familia') }, '＋ ' + T('addFamilia')),
      h('button', { class: 'bt leve', type: 'button', onclick: add('viagem') }, '＋ ' + T('addSoEsta'))]));
    c.appendChild(h('p', { class: 'dica', texto: T('dicaAjustarDepois') }));
    c.appendChild(h('p', { class: 'dica', texto: T('privacidadePessoas') }));
    val(function () { return r.pessoas.length ? true : T('faltaPessoas'); });
  };
  PASSO.estilo = function (c, r, val) {
    var pr = r.preferencias;
    c.appendChild(h('h1', { texto: T('pEstilo') }));
    var escolha = function (titulo, chave, ops) {
      return h('fieldset', {}, [h('legend', { texto: titulo }), h('div', { class: 'chips' }, ops.map(function (o) {
        return h('button', { class: 'chip', type: 'button', 'aria-pressed': pr[chave] === o ? 'true' : 'false', onclick: function () { pr[chave] = o; mostrar('nova'); } }, T('op_' + o));
      }))]);
    };
    c.appendChild(escolha(T('ritmo'), 'ritmo', ['tranquilo', 'equilibrado', 'intenso']));
    c.appendChild(escolha(T('orcamento'), 'orcamento', ['economico', 'medio', 'alto', 'luxo']));
    c.appendChild(escolha(T('transporte'), 'transporte', ['carro', 'ape', 'transporte']));
    var quem = estado.pessoas.filter(function (p) { return r.pessoas.indexOf(p.id) > -1; });
    var soma = Gostos.doGrupo(quem), fortes = Object.keys(soma).filter(function (id) { return soma[id] > 0 && Gostos.item(id); })
      .sort(function (a, b) { return soma[b] - soma[a]; });
    c.appendChild(h('fieldset', {}, [h('legend', { texto: T('gostosGrupo') }),
      fortes.length ? h('div', { class: 'resumo-gostos' }, fortes.slice(0, 12).map(function (id) {
        return h('span', { class: 'gosto', 'data-v': soma[id] >= 2 ? '2' : '1', texto: Gostos.nome(id, idioma()) }); }))
        : h('p', { class: 'sub', texto: T('gostosGrupoVazio') }),
      h('div', { class: 'chips' }, quem.map(function (p) {
        return h('button', { class: 'chip', type: 'button', onclick: function () { janelaGostos(p, function () { mostrar('nova'); }); } },
          '♥ ' + (p.apelido || T('par_' + p.parentesco)));
      }))]));
  };
  PASSO.estadia = function (c, r, val) {
    c.appendChild(h('h1', { texto: T('pEstadia') }));
    c.appendChild(h('p', { class: 'sub', texto: T('pEstadiaTexto') }));
    if (!r.estadias.length) r.estadias.push({ nome: '', endereco: '', entrada: r.inicio, saida: r.fim });
    r.estadias.forEach(function (e, k) {
      var nome = h('input', { class: 'campo', id: 'gx-e-nome-' + k, maxlength: '80', value: e.nome, placeholder: T('exHotel') });
      var end = h('input', { class: 'campo', id: 'gx-e-end-' + k, maxlength: '160', value: e.endereco, placeholder: T('exEndereco') });
      nome.addEventListener('input', function () { e.nome = nome.value; });
      end.addEventListener('input', function () { e.endereco = end.value; e.lat = null; e.lng = null; });
      var ent = h('input', { class: 'campo', type: 'date', id: 'gx-e-ent-' + k, value: e.entrada || '' }), sai = h('input', { class: 'campo', type: 'date', id: 'gx-e-sai-' + k, value: e.saida || '' });
      ent.addEventListener('change', function () { e.entrada = ent.value; }); sai.addEventListener('change', function () { e.saida = sai.value; });
      var aqui = h('button', { class: 'bt leve', type: 'button' }, e.lat != null ? '📍 ✓' : '📍 ' + T('usarOndeEstou'));
      aqui.addEventListener('click', function () { pegarPosicao().then(function (p) { e.lat = +p.lat.toFixed(4); e.lng = +p.lng.toFixed(4); aqui.textContent = '📍 ✓'; }); });
      c.appendChild(h('fieldset', {}, [h('legend', { texto: T('hospedagem') + ' ' + (k + 1) }),
        h('label', { class: 'rot', for: 'gx-e-nome-' + k, texto: T('nome') }), nome, h('label', { class: 'rot', for: 'gx-e-end-' + k, texto: T('endereco') }), end, aqui,
        h('div', { class: 'dois' }, [h('div', {}, [h('label', { class: 'rot', for: 'gx-e-ent-' + k, texto: T('entrada') }), ent]), h('div', {}, [h('label', { class: 'rot', for: 'gx-e-sai-' + k, texto: T('saida') }), sai])]),
        k > 0 ? h('button', { class: 'bt perigo', type: 'button', onclick: function () { r.estadias.splice(k, 1); mostrar('nova'); } }, T('tirar')) : null]));
    });
    c.appendChild(h('button', { class: 'bt sec', type: 'button', onclick: function () { r.estadias.push({ nome: '', endereco: '', entrada: '', saida: r.fim }); mostrar('nova'); } }, '＋ ' + T('outraHospedagem')));
    c.appendChild(h('p', { class: 'dica', texto: T('estadiaDica') }));
  };
  PASSO.pronto = function (c, r) {
    c.appendChild(h('h1', { texto: T('pPronto') }));
    var nome = h('input', { class: 'campo', id: 'gx-w-nome', maxlength: '60', value: r.nome || (r.destinoTexto + ' ' + (r.inicio ? r.inicio.slice(0, 4) : '')) });
    nome.addEventListener('input', function () { r.nome = nome.value; });
    r.nome = nome.value;
    c.appendChild(h('label', { class: 'rot', for: 'gx-w-nome', texto: T('nomeViagem') })); c.appendChild(nome);
    c.appendChild(h('div', { class: 'cartao' }, [
      h('span', { texto: '📍 ' + r.destinoTexto }), h('span', { texto: '🗓 ' + fData(r.inicio) + ' – ' + fData(r.fim) }),
      h('span', { texto: '👥 ' + T('nPessoas', { n: r.pessoas.length }) }), h('span', { texto: '🏨 ' + (r.estadias.filter(function (e) { return e.nome; }).map(function (e) { return e.nome; }).join(', ') || '—') })]));
    var opc = function (id, k, rot, dica, on) {
      var cb = h('input', { type: 'checkbox', id: id }); cb.checked = on; cb.addEventListener('change', function () { r[k] = cb.checked; });
      return h('div', {}, [cb, h('label', { for: id, texto: ' ' + rot }), h('p', { class: 'dica', texto: dica })]);
    };
    if (r.destino) c.appendChild(opc('gx-w-pac', 'usarPacote', T('usarRoteirosPacote'), T('usarRoteirosPacoteDica'), r.usarPacote));
    c.appendChild(opc('gx-w-ia', 'ia', '✨ ' + T('gerarIA'), T('gerarIADica'), r.ia));
  };
  function geocodificar(texto) {
    if (!texto || !navigator.onLine) return Promise.resolve(null);
    return fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(texto), { headers: { 'Accept-Language': idioma() === 'en' ? 'en' : 'pt-BR' } })
      .then(function (x) { return x.ok ? x.json() : []; }).then(function (j) { return j && j[0] ? { lat: +(+j[0].lat).toFixed(4), lng: +(+j[0].lon).toFixed(4) } : null; }).catch(function () { return null; });
  }
  function criarViagem(r) {
    var v = { nome: (r.nome || r.destinoTexto).trim(), destino: r.destino, destinoTexto: r.destinoTexto, centro: r.centro || null, inicio: r.inicio, fim: r.fim,
      pessoas: r.pessoas.slice(), preferencias: r.preferencias, estadias: r.estadias.filter(function (e) { return e.nome || e.endereco; }), opcao_ativa: null };
    /* coordenadas: cidade digitada e hotel pelo endereço (1 pedido por vez, regra do OpenStreetMap) */
    var p = Promise.resolve();
    if (!v.centro) p = p.then(function () { return geocodificar(v.destinoTexto).then(function (c) { v.centro = c; }); });
    v.estadias.forEach(function (e) {
      if (e.lat == null && (e.endereco || e.nome)) p = p.then(function () { return geocodificar([e.endereco || e.nome, v.destinoTexto].join(', ')).then(function (c) { if (c) { e.lat = c.lat; e.lng = c.lng; } }); });
    });
    return p.then(function () { return Banco.gravar('viagens', v); }).then(function (nv) {
      return Banco.definirMeta('viagem-atual', nv.id).then(function () { return carregarViagem(nv.id); }).then(function () {
        var pr = Promise.resolve();
        if (r.destino && r.usarPacote && estado.pacote) pr = pr.then(function () { return criarOpcoesDoPacote(estado.viagem, estado.pacote); });
        return pr.then(function () { return carregarViagem(nv.id); }).then(function () {
          if (!estado.roteiros.length) return criarOpcaoEmBranco().then(function () { return carregarViagem(nv.id); });
        }).then(function () { if (r.ia) setTimeout(gerarComIA, 300); });
      });
    });
  }

  /* ------------------------------------------------------------------
     8. ENTRAR (acesso), CONTA E CONFIGURAÇÕES
     ------------------------------------------------------------------ */
  TELAS.entrar = function (tela) {
    var a = estado.acesso || {}, s = Conta.sessao();
    tela.appendChild(h('h1', { texto: T('entrarTitulo') }));
    tela.appendChild(h('p', { class: 'sub', texto: T('entrarTexto') }));
    if (a.motivo === 'sql-faltando') tela.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T('sqlFaltando') }), T('sqlFaltandoTexto')]));
    if (a.motivo === 'conferir' || a.motivo === 'sem-internet') tela.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T('conferirAcesso') }), T('conferirAcessoTexto')]));
    if (!s) {
      var volta = Conta.temVolta();
      if (volta && Bio.ligada()) {
        var mv = h('p', { class: 'pequeno', role: 'status', 'aria-live': 'polite' });
        var bv = h('button', { class: 'bt cheio', type: 'button', texto: T('entrarBio') });
        bv.addEventListener('click', function () {
          bv.disabled = true; mv.textContent = '';
          Bio.chaves().then(function (k) { return Conta.voltar(k.sessao).then(function () { if (Cofre.aberto()) return; return Cofre.temBio().then(function (t) { if (t) return Cofre.abrirComBio(k.cofre); }); }); })
            .then(iniciarAcesso).catch(function (e) {
              bv.disabled = false;
              mv.textContent = e.message === 'cancelado' ? '' : e.message === 'volta-expirou' ? T('bioExpirou') : navigator.onLine ? T('bioErro') : T('semInternet');
              if (e.message === 'volta-expirou') mostrar('entrar');
            });
        });
        tela.appendChild(h('div', { class: 'cartao' }, [h('p', { texto: T('bemVindoDeVolta', { email: volta.email }) }), bv, mv]));
        /* as outras formas ficam recolhidas: a digital é o caminho principal */
        var resto = h('div', { hidden: true, style: 'display:flex;flex-direction:column;gap:1.1rem' });
        tela.appendChild(h('button', { class: 'lk', type: 'button', texto: T('outroJeito'), onclick: function (e) { e.target.remove(); resto.hidden = false; } }));
        tela.appendChild(resto);
        tela = resto;
      }
      var email = h('input', { class: 'campo', type: 'email', id: 'gx-email', autocomplete: 'email', placeholder: 'voce@email.com', value: volta ? volta.email : '' });
      var senha = h('input', { class: 'campo', type: 'password', id: 'gx-senha', autocomplete: 'current-password' });
      var ver = h('button', { class: 'bt leve', type: 'button', 'aria-label': T('mostrarSenha'), texto: '👁', onclick: function () { senha.type = senha.type === 'password' ? 'text' : 'password'; } });
      var msg = h('p', { class: 'pequeno', role: 'status', 'aria-live': 'polite' });
      var bt = h('button', { class: 'bt cheio', type: 'button' }, T('entrar'));
      tela.appendChild(h('div', { class: 'cartao' }, [
        h('label', { class: 'rot', for: 'gx-email', texto: T('email') }), email,
        h('label', { class: 'rot', for: 'gx-senha', texto: T('senha') }), h('div', { class: 'linha', style: 'flex-wrap:nowrap' }, [senha, ver]), bt, msg,
        h('div', { class: 'linha' }, [
          h('button', { class: 'lk', type: 'button', onclick: function () { if (!email.value) { msg.textContent = T('digiteEmail'); email.focus(); return; } Conta.esqueci(email.value).then(function () { msg.textContent = T('emailEnviado'); }).catch(function () { msg.textContent = T('erroRede'); }); } }, T('esqueciSenha')),
          h('button', { class: 'lk', type: 'button', onclick: function () { if (!email.value || senha.value.length < 8) { msg.textContent = T('criarContaDica'); return; } Conta.criarConta(email.value, senha.value).then(function (j) { msg.textContent = j && j.access_token ? T('contaCriada') : T('confirmeEmail'); if (j && j.access_token) iniciarAcesso(); }).catch(function (e) { msg.textContent = e.message || T('erroRede'); }); } }, T('criarConta'))
        ]),
        h('button', { class: 'bt leve cheio', type: 'button', onclick: function () { Conta.google(); } }, 'Google')
      ]));
      /* sem senha: código de 6 números (ou link) por e-mail */
      var codBox = h('div', { hidden: true, style: 'display:flex;flex-direction:column;gap:.6rem' });
      var otp = h('input', { class: 'campo', id: 'gx-otp', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '000000' });
      var bOtp = h('button', { class: 'bt cheio', type: 'button', texto: T('confirmarCodigo') });
      codBox.appendChild(h('label', { class: 'rot', for: 'gx-otp', texto: T('codigoEmail') })); codBox.appendChild(otp); codBox.appendChild(bOtp);
      var mOtp = h('p', { class: 'pequeno', role: 'status', 'aria-live': 'polite' });
      var bEnviar = h('button', { class: 'bt sec cheio', type: 'button', texto: T('entrarSemSenha') });
      bEnviar.addEventListener('click', function () {
        if (!email.value) { mOtp.textContent = T('digiteEmail'); email.focus(); return; }
        bEnviar.disabled = true;
        Conta.enviarCodigo(email.value.trim()).then(function () {
          mOtp.textContent = T('codigoEnviado'); codBox.hidden = false; otp.focus();
          setTimeout(function () { bEnviar.disabled = false; bEnviar.textContent = T('reenviarCodigo'); }, 60000);
        }).catch(function (e) { bEnviar.disabled = false; mOtp.textContent = e.status === 429 ? T('esperaUmMinuto') : navigator.onLine ? T('codigoNaoEnviado') : T('semInternet'); });
      });
      var confirmar = function () {
        if (!/^\d{6}$/.test(otp.value.replace(/\D/g, ''))) { mOtp.textContent = T('codigo6'); otp.focus(); return; }
        bOtp.disabled = true;
        Conta.confirmarCodigo(email.value.trim(), otp.value).then(iniciarAcesso).catch(function () { bOtp.disabled = false; mOtp.textContent = T('codigoEmailErrado'); });
      };
      bOtp.addEventListener('click', confirmar);
      otp.addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmar(); });
      tela.appendChild(h('div', { class: 'cartao' }, [h('h3', { texto: T('semSenhaTitulo') }), bEnviar, mOtp, codBox]));
      var entrar = function () {
        if (!email.value || !senha.value) { msg.textContent = T('faltaLogin'); return; }
        bt.disabled = true; msg.textContent = T('entrando');
        Conta.entrar(email.value.trim(), senha.value).then(iniciarAcesso).catch(function (e) {
          bt.disabled = false; msg.textContent = e.status === 400 ? T('loginErrado') : (navigator.onLine ? (e.message || T('erroRede')) : T('semInternet'));
        });
      };
      bt.addEventListener('click', entrar);
      senha.addEventListener('keydown', function (e) { if (e.key === 'Enter') entrar(); });
      return;
    }
    /* com conta mas sem acesso: código de degustação */
    tela.appendChild(h('p', { texto: T('contaConectada', { email: s.email }) }));
    var cod = h('input', { class: 'campo', id: 'gx-codigo', autocomplete: 'off', placeholder: 'GX-XXXX-XXXX', style: 'text-transform:uppercase' });
    var m2 = h('p', { class: 'pequeno', role: 'status', 'aria-live': 'polite' });
    var b2 = h('button', { class: 'bt cheio', type: 'button' }, T('usarCodigo'));
    tela.appendChild(h('div', { class: 'cartao' }, [h('h3', { texto: T('temCodigo') }), h('p', { class: 'sub', texto: T('temCodigoTexto') }),
      h('label', { class: 'rot', for: 'gx-codigo', texto: T('codigoDegustacao') }), cod, b2, m2]));
    b2.addEventListener('click', function () {
      b2.disabled = true; m2.textContent = T('conferindo');
      Conta.resgatarCodigo(cod.value).then(function (x) {
        b2.disabled = false;
        if (x && x.liberado) { avisar(T('codigoOk', { ate: fData(String(x.valida_ate).slice(0, 10)) })); iniciarAcesso(); }
        else m2.textContent = T('codigo_' + ((x && x.mensagem) || 'invalido'));
      }).catch(function (e) { b2.disabled = false; m2.textContent = e.message === 'codigo-curto' ? T('codigo_invalido') : (e.codigo === 'PGRST202' ? T('sqlFaltando') : T('erroRede')); });
    });
    tela.appendChild(h('p', { class: 'sub', texto: T('pedirAcesso') }));
    tela.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: function () { iniciarAcesso(); } }, T('conferirDeNovo')));
    tela.appendChild(h('button', { class: 'bt perigo', type: 'button', onclick: function () { Conta.sair(); estado.acesso = { liberado: false, motivo: 'sem-conta' }; mostrar('entrar'); } }, T('sair')));
  };

  TELAS.conta = function (tela) {
    var s = Conta.sessao(), a = estado.acesso || {};
    tela.appendChild(h('h1', { texto: T('rota_conta') }));
    tela.appendChild(h('div', { class: 'cartao' }, [
      h('span', { texto: s ? T('contaConectada', { email: s.email }) : T('semContaAberto') }),
      h('span', { class: 'sub', texto: T('acesso_' + (a.origem || 'aberto')) + (a.ate ? ' · ' + T('ate', { d: fData(String(a.ate).slice(0, 10)) }) : '') + (a.offline ? ' · ' + T('semInternetUsando') : '') }),
      s && !Bio.ligada() ? h('button', { class: 'bt perigo', type: 'button', onclick: function () { Conta.sair(); iniciarAcesso(); } }, T('sair')) : null,
      s && Bio.ligada() ? h('button', { class: 'bt leve', type: 'button', onclick: function () {
        Bio.chaves().then(function (k) { return Conta.sairTrancando(k.sessao); }).then(function () { Cofre.fechar(); avisar(T('saiuVoltaBio')); iniciarAcesso(); })
          .catch(function (e) { if (e.message !== 'cancelado') avisar(T('bioErro')); });
      } }, T('sairBio')) : null,
      s && Bio.ligada() ? h('button', { class: 'bt perigo', type: 'button', onclick: function () { desligarBio().then(function () { Conta.sair(); Cofre.fechar(); iniciarAcesso(); }); } }, T('sairDeVez')) : null
    ]));
    tela.appendChild(h('div', { class: 'cartao' }, [h('h3', { texto: T('meusDados') }), h('p', { class: 'sub', texto: T('meusDadosTexto') }),
      h('button', { class: 'bt leve', type: 'button', onclick: exportar }, T('exportar')),
      h('button', { class: 'bt perigo', type: 'button', onclick: apagarTudo }, T('apagarTudo'))]));
  };
  function exportar() {
    Banco.exportarTudo().then(function (j) {
      var url = URL.createObjectURL(new Blob([JSON.stringify(j, null, 1)], { type: 'application/json' }));
      var a = h('a', { href: url, download: 'guiaxpert-meus-dados-' + hojeIso() + '.json' }); d.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      avisar(T('exportado'));
    });
  }
  function apagarTudo() {
    var campo = h('input', { class: 'campo', id: 'gx-apagar-tudo', autocomplete: 'off' });
    var bt = h('button', { class: 'bt perigo', type: 'button' }, T('apagarTudo'));
    var j = janela(T('apagarTudo'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { texto: T('apagarTudoTexto') }), h('button', { class: 'bt leve', type: 'button', onclick: exportar }, T('exportarAntes')),
      h('label', { class: 'rot', for: 'gx-apagar-tudo', texto: T('digiteApagar') }), campo, bt]));
    bt.addEventListener('click', function () {
      if (normalizar(campo.value).trim() !== normalizar(T('palavraApagar'))) { campo.focus(); return; }
      Cofre.fechar();
      Banco.apagarTudo().then(function () { j.fechar(); location.reload(); });
    });
  }

  TELAS.config = function (tela) {
    tela.appendChild(h('h1', { texto: T('rota_config') }));
    var tema = (function () { try { return localStorage.getItem('dgo:guiaxpert:tema') || 'auto'; } catch (e) { return 'auto'; } })();
    tela.appendChild(h('fieldset', {}, [h('legend', { texto: T('tema') }), h('div', { class: 'chips' }, ['auto', 'claro', 'escuro'].map(function (t) {
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': tema === t ? 'true' : 'false', onclick: function () { aplicarTema(t); mostrar('config'); } }, T('tema_' + t));
    }))]));
    tela.appendChild(h('fieldset', {}, [h('legend', { texto: T('trocarIdioma') }), h('div', { class: 'chips' }, ['pt', 'en'].map(function (l) {
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': idioma() === l ? 'true' : 'false', onclick: function () { trocarIdioma(l); } }, l === 'pt' ? 'Português' : 'English');
    }))]));
    if (window.DGO) tela.appendChild(h('div', { class: 'cartao' }, [h('h3', { texto: T('iaTitulo') }), h('p', { class: 'sub', texto: T('iaTexto') }),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { DGO.ia.guia(null, 'texto'); } }, T('iaConfigurar')),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { DGO.abrirConfiguracoes && DGO.abrirConfiguracoes(); } }, T('maisAjustes'))]));
    var cBio = h('div', { class: 'cartao' }, [h('h3', { texto: T('bioCartao') })]);
    tela.appendChild(cBio);
    Bio.suportada().then(function (ok) {
      if (!ok) { cBio.appendChild(h('p', { class: 'sub', texto: T('bioNaoSuportada') })); return; }
      if (!Bio.ligada()) {
        cBio.appendChild(h('p', { class: 'sub', texto: T('bioTexto') }));
        cBio.appendChild(Conta.sessao() ? h('button', { class: 'bt sec', type: 'button', texto: T('ligarBio'), onclick: function () { ligarBio().then(function () { mostrar('config'); }); } })
          : h('p', { class: 'pequeno', texto: T('bioPrecisaLogin') }));
        return;
      }
      cBio.appendChild(h('p', { class: 'sub', texto: T('bioLigadaTexto') }));
      Promise.all([Cofre.existe(), Cofre.temBio()]).then(function (r) {
        if (r[0] && !r[1]) cBio.appendChild(h('button', { class: 'bt sec', type: 'button', texto: T('bioNasReservas'), onclick: function () {
          var corpo = h('div', {}), j = janela(T('bioNasReservas'), corpo);
          pedirCofre(corpo, function () { Bio.chaves().then(function (k) { return Cofre.ligarBio(k.cofre); }).then(function () { avisar(T('bioLigada')); j.fechar(); mostrar('config'); }).catch(function () { avisar(T('bioErro')); }); });
        } }));
        cBio.appendChild(h('button', { class: 'bt perigo', type: 'button', texto: T('desligarBio'), onclick: function () { desligarBio().then(function () { mostrar('config'); }); } }));
      });
    });
    var esp = h('p', { class: 'sub', texto: T('carregando') });
    tela.appendChild(h('div', { class: 'cartao' }, [h('h3', { texto: T('espaco') }), esp,
      h('p', { class: 'pequeno', texto: T('semInternetComo') })]));
    Promise.all([Banco.espaco(), Banco.pendentes()]).then(function (r) {
      esp.textContent = (r[0] ? T('espacoUsado', { mb: (r[0].usage / 1048576).toFixed(1) }) : '') + ' · ' + T('pendentesNuvem', { n: r[1] });
    });
    tela.appendChild(h('p', { class: 'pequeno', texto: 'GuiaXpert ' + VERSAO_APP + ' · ' + T('umaSolucao') }));
  };
  function aplicarTema(t) {
    try { localStorage.setItem('dgo:guiaxpert:tema', t); } catch (e) {}
    if (t === 'auto') d.documentElement.removeAttribute('data-tema'); else d.documentElement.setAttribute('data-tema', t);
  }

  /* ------------------------------------------------------------------
     INÍCIO DO APP
     ------------------------------------------------------------------ */
  function iniciarAcesso() {
    return Conta.acesso().then(function (a) {
      estado.acesso = a;
      if (!a.liberado) { mostrar('entrar'); return; }
      return Banco.meta('viagem-atual', null).then(carregarViagem).then(atualizarRestricoesGrupo).then(function () {
        mostrar(estado.rota === 'entrar' ? 'inicio' : estado.rota);
        oferecerBio();
      });
    });
  }

  /* convite único depois do login: "da próxima vez, entre com digital ou rosto" */
  function oferecerBio() {
    var s = Conta.sessao();
    if (!s || Bio.ligada()) return;
    try { if (localStorage.getItem('guiaxpert.bio-oferta')) return; } catch (e) { return; }
    Bio.suportada().then(function (ok) {
      if (!ok) return;
      try { localStorage.setItem('guiaxpert.bio-oferta', '1'); } catch (e) {}
      var sim = h('button', { class: 'bt', type: 'button', texto: T('ligarBio') });
      var nao = h('button', { class: 'bt leve', type: 'button', texto: T('agoraNao') });
      var j = janela(T('bioTitulo'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
        h('p', { class: 'sub', texto: T('bioTexto') }), h('div', { class: 'acoes' }, [nao, sim])]));
      nao.addEventListener('click', function () { j.fechar(); });
      sim.addEventListener('click', function () { ligarBio().then(function (ok2) { if (ok2) j.fechar(); }); });
    });
  }
  function ligarBio() {
    var s = Conta.sessao();
    return Bio.ligar(s && s.email).then(function (k) {
      return (Cofre.aberto() ? Cofre.ligarBio(k.cofre) : Promise.resolve()).then(function () { avisar(T('bioLigada')); return true; });
    }).catch(function (e) {
      if (e.message !== 'cancelado') avisar(e.message === 'sem-prf' ? T('bioSemPrf') : T('bioErro'));
      return false;
    });
  }
  function desligarBio() {
    Bio.desligar(); Conta.esquecerVolta();
    return Cofre.desligarBio().then(function () { avisar(T('bioDesligada')); });
  }

  function iniciar() {
    try { estado.idioma = localStorage.getItem('dgo:guiaxpert:idioma') || ((navigator.language || 'pt').indexOf('pt') === 0 ? 'pt' : 'en'); } catch (e) {}
    try { aplicarTema(localStorage.getItem('dgo:guiaxpert:tema') || 'auto'); } catch (e) {}
    traduzirMoldura();
    var rota = Nav.iniciar();
    estado.rota = rota;
    $('bt-menu').addEventListener('click', abrirGaveta);
    $('fundo-gaveta').addEventListener('click', function () { Nav.fecharCamada(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('gaveta').hidden) Nav.fecharCamada(); });
    $('marca').addEventListener('click', function () { Nav.ir('inicio'); });
    $('marca').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Nav.ir('inicio'); } });
    $('bt-inicio').addEventListener('click', function () { Nav.ir('inicio'); });
    $('bt-config').addEventListener('click', function () { Nav.ir('config'); });
    $('bt-conta').addEventListener('click', function () { Nav.ir(estado.acesso && estado.acesso.liberado ? 'conta' : 'entrar'); });
    $('bt-busca').addEventListener('click', abrirBusca);
    $('bt-idioma').addEventListener('click', function () { trocarIdioma(idioma() === 'en' ? 'pt' : 'en'); });
    d.addEventListener('dgo:idioma', function (e) { if (e.detail && e.detail.idioma) { estado.idioma = e.detail.idioma; traduzirMoldura(); mostrar(estado.rota); } });
    d.addEventListener('gx:cofre', function () { cacheRestr = []; if (estado.rota === 'reservas') mostrar('reservas'); });
    window.addEventListener('online', function () { if (!estado.acesso || !estado.acesso.liberado || estado.acesso.offline) iniciarAcesso(); });
    estado.pronto = true;
    mostrar('entrar');
    Conta.lerVolta().then(function (volta) {
      if (!volta) return;
      if (volta.recente) { volta.confirmar(); return; }
      return new Promise(function (ok) {
        var sim = h('button', { class: 'bt', type: 'button' }, T('simFuiEu'));
        var nao = h('button', { class: 'bt leve', type: 'button' }, T('naoFuiEu'));
        var j = janela(T('confirmarConta'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [h('p', { texto: T('confirmarContaTexto', { email: volta.email }) }), sim, nao]), ok);
        sim.addEventListener('click', function () { volta.confirmar(); j.fechar(); });
        nao.addEventListener('click', function () { j.fechar(); });
      });
    }).catch(function () {}).then(iniciarAcesso);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.GuiaXpert = { versao: VERSAO_APP, estado: estado, ir: function (r) { Nav.ir(r); } };
})();
/* erro em promessa sem tratamento aparece no console (ajuda o suporte), sem derrubar a tela */
window.addEventListener('unhandledrejection', function (e) { console.error('GuiaXpert: promessa sem tratamento', e.reason && (e.reason.message || e.reason)); });
