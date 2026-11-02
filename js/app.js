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
  var VERSAO_APP = '1.5.11';

  /* ------------------------------------------------------------------
     1. UTILIDADES
     ------------------------------------------------------------------ */
  function idioma() { return (window.DGO && DGO.idioma && DGO.idioma()) || estado.idioma || 'pt'; }
  /* subcategoria: nome traduzido do guia, ou o nome que veio da fonte (ex.: "Bar" do Foursquare) */
  function nomeSub(sub) { return window.TEXTOS['sub_' + sub] ? T('sub_' + sub) : String(sub); }
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
    lupa: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/></svg>',
    quem: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3 19c.6-3.2 2.8-5 6-5s5.4 1.8 6 5M15.5 19c.3-2 1.4-3.3 3.2-3.6 1.3-.2 2.3.6 2.3 2"/></svg>',
    salvos: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    viagens: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/></svg>',
    alvo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>'
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
    opcao: null, dia: 0, filtro: 'todos', busca: '', descobertas: [], pos: null, soDia: false
  };

  function carregarViagem(id) {
    return Banco.listar('viagens').then(function (vs) {
      vs.sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
      var v = (id && vs.filter(function (x) { return x.id === id; })[0]) ||
              vs.filter(function (x) { return x.fim >= hojeIso(); })[0] || vs[vs.length - 1] || null;
      if (window.Contexto && !Contexto.emViagem()) v = null;      /* Explorar: sem viagem aberta */
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
      estado.papel = 'dono';
      if (estado.viagem && window.Nuvem) Nuvem.papel(estado.viagem.id).then(function (p) { estado.papel = p; });
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
    var meus = estado.lugaresProprios.filter(function (l) { return estado.viagem ? l.viagem_id === estado.viagem.id : !l.viagem_id; });
    return base.concat(meus);
  }
  /* troca de contexto (chip): recarrega a viagem (ou nenhuma) e a tela */
  function recarregarContexto() {
    return Contexto.carregar().then(function (c) { return carregarViagem(c.viagemId); }).then(atualizarRestricoesGrupo).then(function () { estado.descobertas = []; desenharChip(); });
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
  var ROTAS = { inicio: 1, roteiro: 1, lugares: 1, mapa: 1, reservas: 1, viagens: 1, nova: 1, familia: 1, conta: 1, config: 1, entrar: 1, explorar: 1, salvos: 1, ia: 1 };
  var Nav = {
    camadas: [], depois: [], guarda: false,
    base: function (r) { return r === 'inicio' || r === 'entrar' || r === 'explorar'; },
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
  var BARRA_VIAGEM = ['inicio', 'roteiro', 'mapa', 'reservas', 'familia'];
  var BARRA_EXPLORAR = ['explorar', 'salvos', 'viagens'];
  var ICONE_ROTA = { inicio: 'hoje', roteiro: 'roteiro', mapa: 'mapa', reservas: 'reservas', familia: 'quem', explorar: 'mapa', salvos: 'salvos', viagens: 'viagens' };
  function emViagem() { return !!(window.Contexto && Contexto.emViagem()); }

  function montarBarra() {
    var b = $('barra'); b.textContent = '';
    var liberado = estado.acesso && estado.acesso.liberado;
    b.hidden = !liberado;
    if (!liberado) return;
    (emViagem() ? BARRA_VIAGEM : BARRA_EXPLORAR).forEach(function (r) {
      var bt = h('button', { type: 'button', svg: ICONES[ICONE_ROTA[r]], 'aria-current': estado.rota === r ? 'page' : null, onclick: function () { Nav.ir(r); } });
      bt.appendChild(h('span', { texto: T(r === 'familia' ? 'barraQuem' : r === 'viagens' ? 'barraViagens' : 'rota_' + r) }));
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
      ['grupoViagem', [['inicio', '☀️'], ['roteiro', '🗓'], ['mapa', '🗺'], ['reservas', '🎫']]],
      ['grupoExplorar', [['explorar', '🌍'], ['salvos', '🔖']]],
      ['grupoPlanejar', [['viagens', '🧳'], ['nova', '➕'], ['familia', '👨‍👩‍👧'], ['ia', '✨']]],
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

  /* chip "🧳 Gramado, nov ▾" / "🌍 Explorar ▾": toca e troca de contexto */
  function desenharChip() {
    var c = $('chip'); if (!c) return;
    /* o emoji (🧳/🧭) fica num pedaço separado: em celular estreito ou com letra grande ele sai e sobra lugar para o nome */
    var rot = Contexto.rotulo(estado.viagem, T, idioma()), m = /^([^\p{L}\p{N}\s]+)\s+(.+)$/u.exec(rot);
    c.textContent = '';
    if (m) c.appendChild(h('span', { class: 'chip-ico', 'aria-hidden': 'true', texto: m[1] }));
    c.appendChild(h('span', { class: 'chip-nome', texto: m ? m[2] : rot })); c.appendChild(h('span', { class: 'seta', 'aria-hidden': 'true', texto: '▾' }));
    c.setAttribute('aria-label', (m ? m[2] : rot) + ' — ' + T('ondeVoceEsta'));
    c.hidden = !(estado.acesso && estado.acesso.liberado);
  }
  function janelaContexto() {
    Banco.listar('viagens').then(function (vs) {
      vs.sort(function (a, b) { return a.inicio > b.inicio ? -1 : 1; });
      var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.4rem' });
      var j = janela(T('ondeVoceEsta'), corpo);
      var item = function (ativo, rotulo, sub, fn) {
        return h('button', { class: 'escolha' + (ativo ? ' ativa' : ''), type: 'button', onclick: function () { j.fechar(fn); } }, [h('b', { texto: rotulo }), sub ? h('span', { class: 'pequeno', texto: sub }) : null]);
      };
      corpo.appendChild(item(!emViagem(), '🌍 ' + T('explorar'), T('explorarSub'), function () { Contexto.definir('explorar').then(recarregarContexto).then(function () { Nav.ir('explorar', { substituir: true }); }); }));
      vs.forEach(function (v) {
        corpo.appendChild(item(emViagem() && estado.viagem && estado.viagem.id === v.id, '🧳 ' + v.nome, fData(v.inicio, true) + ' – ' + fData(v.fim, true),
          function () { Contexto.definir('viagem', v.id).then(recarregarContexto).then(function () { Nav.ir('inicio', { substituir: true }); }); }));
      });
      corpo.appendChild(h('button', { class: 'bt sec', type: 'button', texto: '＋ ' + T('novoPasseioOuViagem'), onclick: function () { estado.rascunho = null; j.fechar(function () { Nav.ir('nova'); }); } }));
    });
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
    desenharChip();
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
          estado.busca = ''; estado.filtro = 'todos'; estado.abrirLugar = l.id; j.fechar(); setTimeout(function () { Nav.ir(emViagem() ? 'mapa' : 'explorar'); }, 0);
        } }, [placa(l.categoria), ' ', l.nome]));
      });
      /* lugares fora do app (OpenStreetMap, Foursquare, Tripadvisor): procura sozinho quando a pessoa para de digitar */
      var naNet = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.4rem' });
      lista.appendChild(naNet);
      clearTimeout(espera);
      if (q.length < 3) { if (lista.childNodes.length === 1) naNet.appendChild(h('p', { class: 'sub', texto: T('nadaAchado') })); return; }
      if (!navigator.onLine) { naNet.appendChild(h('p', { class: 'pequeno', texto: T('semInternet') })); return; }
      naNet.appendChild(h('p', { class: 'sub', texto: '🔎 ' + T('bscProcurandoFora', { q: campo.value.trim() }) }));
      var pedido = ++vez, texto = campo.value.trim();
      espera = setTimeout(function () {
        Descobrir.buscarNome(texto, estado.pos || centroViagem(), idioma()).catch(function () { return []; }).then(function (ls) {
          if (pedido !== vez) return;
          naNet.textContent = '';
          var ids = {}; todosLugares().forEach(function (l) { ids[normalizar(l.nome)] = 1; });
          ls = ls.filter(function (l) { return !ids[normalizar(l.nome)]; }).slice(0, 6);
          if (!ls.length) {
            naNet.appendChild(h('p', { class: 'sub', texto: T('bscNadaFora', { q: texto }) }));
            naNet.appendChild(h('button', { class: 'bt leve', type: 'button', texto: '🤝 ' + T('acharJuntos'), onclick: function () {
              j.fechar(function () { janelaAcharJuntos(texto, function (n) { if (estado.viagem && estado.opcao && podeEditar()) janelaAddAoRoteiro(n); }); });
            } }));
            return;
          }
          naNet.appendChild(h('p', { class: 'sub', texto: T('bscNaInternet') }));
          ls.forEach(function (l) {
            naNet.appendChild(h('button', { class: 'bt-grande', type: 'button', onclick: function () { j.fechar(function () { mostrarNoMapa(l); }); } }, [
              h('span', { class: 'ic-grande', 'aria-hidden': 'true', texto: '📍' }),
              h('span', { class: 'tx' }, [h('b', { texto: l.nome }), h('small', { texto: [[l.endereco, l.cidade].filter(Boolean).join(', '), l.fonte].filter(Boolean).join(' · ') })])]));
          });
        });
      }, 650);
    }
    var espera = null, vez = 0;
    campo.addEventListener('input', atualizar);
    campo.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(espera); atualizar(); } });
  }
  /* abre um lugar achado na internet no mapa (sem salvar ainda: no cartão dá para salvar e pôr no roteiro) */
  function mostrarNoMapa(l) {
    if (emViagem()) {
      if (!estado.descobertas.some(function (x) { return x.id === l.id; })) estado.descobertas.push(l);
      estado.busca = ''; estado.filtro = 'todos'; estado.abrirLugar = l.id; Nav.ir('mapa');
    } else {
      var ex = window.Explorar && Explorar.estado;
      if (ex && !ex.descobertas.some(function (x) { return x.id === l.id; })) ex.descobertas.push(l);
      estado.busca = ''; estado.abrirLugar = l.id; Nav.ir('explorar');
    }
  }

  /* ------------------------------------------------------------------
     5. TELAS — mostrar() troca o conteúdo de <main>
     ------------------------------------------------------------------ */
  var TELAS = {};
  function mostrar(rota) {
    if (!estado.pronto) { estado.rota = rota; return; }
    var mesmaTela = rota === estado.rota, rolagem = window.scrollY;
    var lib = estado.acesso && estado.acesso.liberado;
    if (!lib && rota !== 'config') rota = 'entrar';
    if (lib && rota === 'entrar') rota = 'inicio';
    if (rota === 'lugares') rota = emViagem() ? 'mapa' : 'explorar';
    if (lib && !emViagem() && (rota === 'inicio' || rota === 'roteiro' || rota === 'mapa' || rota === 'reservas')) rota = 'explorar';
    if (lib && emViagem() && (rota === 'explorar' || rota === 'salvos')) { /* permitido: explorar de dentro da viagem */ }
    estado.rota = rota;
    /* telas de mapa: a página não rola; só o mapa e a lista */
    d.body.classList.toggle('sem-rolagem', rota === 'mapa' || rota === 'explorar');
    d.body.classList.toggle('com-fundo', rota !== 'mapa' && rota !== 'explorar' && rota !== 'entrar');
    if (window.Mapa) Mapa.destruir();
    var m = $('conteudo'); m.textContent = '';
    var tela = h('section', { class: 'tela' + (rota === 'mapa' || rota === 'explorar' ? ' larga' : '') });
    m.appendChild(tela);
    $('bt-inicio').setAttribute('aria-current', rota === 'inicio' || rota === 'explorar' ? 'page' : 'false');
    montarBarra(); desenharChip(); if (lib) botaoAssistente();
    try { TELAS[rota](tela); } catch (e) { console.error(e); tela.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T('erroTela') }), String(e.message || e)])); }
    /* redesenho da mesma tela (marcou uma opção) fica onde estava; tela nova começa no topo */
    window.scrollTo(0, mesmaTela && !estado.irAoTopo ? rolagem : 0); estado.irAoTopo = false;
  }

  function semViagem(tela) {
    tela.appendChild(h('div', { class: 'cartao' }, [
      h('h2', { texto: T('semViagemTitulo') }), h('p', { class: 'sub', texto: T('semViagemTexto') }),
      h('button', { class: 'bt', type: 'button', onclick: function () { Nav.ir('nova'); } }, T('rota_nova'))
    ]));
  }

  /* ---------- Hoje ---------- */
  /* ---------- faixa de fotos (home, lista de viagens, entrar): leve, troca suave, créditos ----------
     Fotos de lugares icônicos sem pessoas (Wikimedia Commons, licenças livres; créditos em img/fundos/creditos.json).
     640 px no celular, 1280 px em tela grande. Começa pela foto do dia e troca a cada 8 s; para com "reduzir
     movimento" do aparelho e com a aba escondida. Nunca nas telas de uso (roteiro, mapa, reservas). */
  var FOTOS_MUNDO = ['cristo', 'coliseu', 'comida-pizza', 'oia', 'eiffel', 'taj', 'comida-doce', 'masp', 'iguacu', 'machu', 'guanabara', 'sydney', 'muralha', 'noronha', 'lencois', 'veadeiros'];
  /* fotos do próprio destino entram primeiro na viagem para lá (as do mundo seguem no rodízio) */
  var FOTOS_DESTINO = { gramado: ['gramado-lago', 'canela-caracol', 'gramado-hortensia'] };
  FOTOS_DESTINO.canela = FOTOS_DESTINO.gramado;
  function fotosDaViagem(v) {
    var txt = normalizar([v && v.destino, v && v.destinoTexto, v && v.nome].join(' '));
    for (var k in FOTOS_DESTINO) if (txt.indexOf(k) > -1) return FOTOS_DESTINO[k];
    return null;
  }
  var fotosTimer = null, creditosFotos = null;
  function faixaFotos(titulo, sub, op) {
    op = op || {};
    var dia = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    var FOTOS = op.destino ? op.destino.concat(FOTOS_MUNDO) : FOTOS_MUNDO;
    var n = FOTOS.length, inicio = (op.indice != null ? op.indice : op.destino ? dia % op.destino.length : dia) % n;
    var img = function (id, ativa) { return h('img', { class: 'hero-foto' + (ativa ? ' ativa' : ''), alt: '', decoding: 'async', loading: 'eager', sizes: '100vw',
      src: 'img/fundos/' + id + '-640.webp', srcset: 'img/fundos/' + id + '-640.webp 640w, img/fundos/' + id + '-1280.webp 1280w' }); };
    var a = img(FOTOS[inicio], true), b = img(FOTOS[(inicio + 1) % n], false);
    var cred = h('button', { class: 'hero-cred', type: 'button', texto: '📷', 'aria-label': T('creditosFotos'), onclick: janelaCreditosFotos });
    var caixa = h('div', { class: 'hero' + (op.compacta ? ' compacta' : ''), 'aria-hidden': 'true' }, [a, b, h('div', { class: 'hero-veu' }),
      h('div', { class: 'hero-texto' }, [titulo ? h('p', { class: 'hero-titulo', texto: titulo }) : null, sub ? h('p', { class: 'hero-sub', texto: sub }) : null]), cred]);
    cred.removeAttribute('aria-hidden');
    var i = inicio, atual = a, prox = b;
    var reduz = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearInterval(fotosTimer); fotosTimer = null;
    if (!reduz && n > 1) {
      fotosTimer = setInterval(function () {
        if (!caixa.isConnected) { clearInterval(fotosTimer); fotosTimer = null; return; }
        if (d.hidden) return;
        i = (i + 1) % n;
        prox.classList.add('ativa'); atual.classList.remove('ativa');
        var t = atual; atual = prox; prox = t;
        var seguinte = FOTOS[(i + 1) % n];
        setTimeout(function () { prox.src = 'img/fundos/' + seguinte + '-640.webp'; prox.srcset = 'img/fundos/' + seguinte + '-640.webp 640w, img/fundos/' + seguinte + '-1280.webp 1280w'; }, 1200);
      }, 8000);
    }
    return caixa;
  }
  function janelaCreditosFotos() {
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.5rem' }, [h('p', { class: 'sub', texto: T('creditosFotosTexto') })]);
    var j = janela(T('creditosFotos'), corpo);
    (creditosFotos ? Promise.resolve(creditosFotos) : fetch('img/fundos/creditos.json').then(function (r) { return r.json(); }).then(function (x) { creditosFotos = x; return x; })).then(function (lista) {
      lista.forEach(function (c) {
        corpo.appendChild(h('p', { class: 'pequeno' }, [h('a', { href: c.pagina, target: '_blank', rel: 'noopener', texto: c.titulo.replace(/\.(jpe?g|png)$/i, '').slice(0, 60) }), ' · ' + c.autor + ' · ' + c.licenca]));
      });
    }).catch(function () { corpo.appendChild(h('p', { class: 'sub', texto: 'Wikimedia Commons' })); });
  }

  TELAS.inicio = function (tela) {
    var v = estado.viagem;
    if (!v) {
      tela.appendChild(faixaFotos(T('boasVindas'), T('boasVindasTexto')));
      tela.appendChild(h('button', { class: 'bt cheio', type: 'button', onclick: function () { estado.rascunho = null; Nav.ir('nova'); } }, '＋ ' + T('novoPasseioOuViagem')));
      tela.appendChild(h('div', { class: 'cartao' }, [
        h('h3', { texto: T('comoFunciona') }),
        h('p', { class: 'sub', texto: T('comoFuncionaTexto') })
      ]));
      return;
    }
    var dias = diasDaViagem(v), hj = hojeIso(), di = dias.indexOf(hj);
    var antes = di < 0 && dataDe(v.inicio) > dataDe(hj);
    if (antes) tela.appendChild(faixaFotos(v.nome, fData(v.inicio) + ' – ' + fData(v.fim), { destino: fotosDaViagem(v) }));
    else tela.appendChild(h('div', {}, [h('h1', { texto: v.nome }), h('p', { class: 'sub', texto: fData(v.inicio) + ' – ' + fData(v.fim) })]));
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
    /* avisos que a própria pessoa guardou na viagem (texto, nunca HTML); toque para editar */
    (v.avisos || []).forEach(function (a, k) { tela.appendChild(h('button', { class: 'alerta alerta-bt', type: 'button', onclick: function () { if (podeEditar()) janelaAviso(v, k); } }, [h('b', { texto: a.titulo }), a.texto || ''])); });
    if (podeEditar()) tela.appendChild(h('button', { class: 'lk', type: 'button', style: 'align-self:flex-start', texto: '＋ ' + T('novoAviso'), onclick: function () { janelaAviso(v, null); } }));

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

    tela.appendChild(cartaoOffline(v));
    var ac = h('div', { class: 'grade' }, [
      h('button', { class: 'bt', type: 'button', onclick: function () { Nav.ir('roteiro'); } }, T('verRoteiro')),
      h('button', { class: 'bt sec', type: 'button', onclick: function () { estado.filtro = 'perto'; Nav.ir('mapa'); } }, '📍 ' + T('pertoDeMim')),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { Nav.ir('reservas'); } }, '🎫 ' + T('rota_reservas')),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaGuia(); } }, '✨ ' + T('perguntarGuia'))
    ]);
    tela.appendChild(ac);
    if (estado.pacote && estado.pacote.aviso) tela.appendChild(h('p', { class: 'pequeno', texto: estado.pacote.aviso[idioma()] || estado.pacote.aviso.pt }));
  };
  /* "Guardar para usar sem internet": mapa + pacote desta viagem */
  function cartaoOffline(v) {
    var c = h('div', { class: 'cartao' }), cidade = v && v.destino;
    if (!cidade || !window.Offline) return h('span', { hidden: true });
    Offline.estado(cidade).then(function (e) {
      if (!e.temMapa) { c.remove(); return; }
      var mb = (e.bytes / 1048576).toFixed(1).replace('.', ',');
      if (e.guardado) {
        c.appendChild(h('div', { class: 'linha entre' }, [h('b', { texto: '✓ ' + T('prontoSemInternet') }), h('span', { class: 'pequeno', texto: mb + ' MB' })]));
        c.appendChild(h('p', { class: 'sub', texto: T('prontoSemInternetTexto') }));
        c.appendChild(h('button', { class: 'bt leve', type: 'button', texto: T('apagarMapa', { mb: mb }), onclick: function () {
          Offline.apagar(cidade).then(function () { avisar(T('mapaApagado')); mostrar(estado.rota); });
        } }));
        return;
      }
      var prog = h('div', { class: 'progresso', hidden: true }, h('i', { style: 'width:0%' }));
      var bt = h('button', { class: 'bt sec', type: 'button', texto: '⬇ ' + T('guardarSemInternet', { mb: mb }) });
      bt.addEventListener('click', function () {
        bt.disabled = true; prog.hidden = false;
        Offline.guardarViagem(cidade, function (f) { prog.firstChild.style.width = Math.round(f * 100) + '%'; })
          .then(function () { avisar(T('guardadoSemInternet')); mostrar(estado.rota); })
          .catch(function () { bt.disabled = false; prog.hidden = true; avisar(navigator.onLine ? T('erroRede') : T('semInternet')); });
      });
      c.appendChild(h('h3', { texto: T('semInternetTitulo') })); c.appendChild(h('p', { class: 'sub', texto: T('semInternetTexto') })); c.appendChild(bt); c.appendChild(prog);
    });
    return c;
  }
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
      h('button', { type: 'button', texto: T('verNoMapa'), onclick: function () { estado.abrirLugar = l.id; estado.filtro = 'todos'; Nav.ir('mapa'); } })
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
          h('button', { class: 'lk', type: 'button', style: 'text-decoration:none', onclick: function () { janelaEditarItem(o, dmod, idx); } }, it.titulo),
          it.tipo === 'gratis' ? h('span', { class: 'etq gratis', texto: T('gratis') }) : null,
          it.tipo === 'ingresso' ? h('span', { class: 'etq', texto: T('ingresso') }) : null]),
        it.nota ? h('span', { class: 'nota', texto: it.nota }) : null
      ]);
      var conf = it.estado === 'confirmado';
      var btConf = h('button', { class: 'conf', type: 'button', 'aria-pressed': conf ? 'true' : 'false', 'aria-label': T(conf ? 'confirmado' : 'confirmar'), texto: '✓', onclick: function () {
        mudarItem(o, dmod, idx, function (item) { item.estado = item.estado === 'confirmado' ? null : 'confirmado'; }).then(recarregarTela); } });
      var rm = o.origem !== 'pacote' ? h('button', { class: 'fav', type: 'button', 'aria-label': T('tirarItem'), texto: '✕', onclick: function () {
        dmod.itens.splice(idx, 1); Banco.gravar('roteiros', o).then(recarregarTela); } }) : null;
      bloco.appendChild(h('div', { class: 'item' + (agora ? ' agora' : '') + (conf ? ' confirmado' : '') }, [h('span', { class: 'h', texto: it.hora || '—' }), x, h('span', { class: 'linha', style: 'flex-wrap:nowrap;gap:0' }, [btConf, rm])]));
    });
    if (!(dmod.itens || []).length) bloco.appendChild(h('p', { class: 'sub', style: 'padding:1rem', texto: T('diaVazio') }));
    tela.appendChild(bloco);
    if (o.origem === 'pacote') tela.appendChild(h('p', { class: 'pequeno', texto: T('pacoteEditar') }));
    if (podeEditar()) tela.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaItem(o, dmod); } }, '＋ ' + T('addItem')));
    else tela.appendChild(h('p', { class: 'pequeno', texto: T('soVe') }));
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
  /* ---------- "Vamos achar juntos?": quando a busca não acha ----------
     Três caminhos, pensados para quem não é do computador: o guia procura (IA + web),
     lista do Google (só ao vivo; guardamos só o que a pessoa confirma) e marcar no mapa.
     Em todos, termina em confirmarLugar(). aoCriar(lugar) recebe o lugar gravado. */
  var googleLugaresDisponivel = null;   /* null = ainda não sei; false = servidor sem chave */
  function buscarNoGoogle(q) {
    var cfg = window.GUIAXPERT_CONFIG || {};
    if (!cfg.SUPABASE_URL || !window.Conta || !Conta.sessao()) return Promise.resolve({ semChave: true, sugestoes: [] });
    var c = estado.pos || centroViagem();
    return Conta.token().then(function (tk) {
      var u = String(cfg.SUPABASE_URL).replace(/\/+$/, '') + '/functions/v1/google-lugares?q=' + encodeURIComponent(q) + '&lang=' + (idioma() === 'en' ? 'en' : 'pt') + (c ? '&lat=' + c.lat + '&lng=' + c.lng : '');
      return fetch(u, { headers: { apikey: cfg.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + tk } });
    }).then(function (r) {
      if (r.status === 503 || r.status === 403) { googleLugaresDisponivel = false; return { semChave: true, sugestoes: [] }; }
      if (!r.ok) throw new Error('google-' + r.status);
      googleLugaresDisponivel = true;
      return r.json().then(function (j) { return { sugestoes: j.sugestoes || [] }; });
    });
  }
  function cidadeAtual() {
    var v = estado.viagem;
    return (v && (v.destinoTexto || v.nome)) || (window.Explorar && Explorar.estado.nome) || '';
  }
  function janelaAcharJuntos(q, aoCriar, lugarPronto) {
    var corpo = h('div', { class: 'achar-juntos' });
    var j = janela(T('acharJuntos'), corpo);
    function botaoGrande(icone, titulo, dica, acao) {
      return h('button', { class: 'bt-grande', type: 'button', onclick: acao }, [h('span', { class: 'ic-grande', 'aria-hidden': 'true', texto: icone }), h('span', { class: 'tx' }, [h('b', { texto: titulo }), h('small', { texto: dica })])]);
    }
    function inicio() {
      corpo.textContent = '';
      corpo.appendChild(h('p', { class: 'grande', texto: T('naoAchei', { q: q }) }));
      corpo.appendChild(h('p', { class: 'sub', texto: navigator.onLine ? T('acharJuntosDica') : T('precisaInternetPara') }));
      if (navigator.onLine) {
        corpo.appendChild(botaoGrande('🧭', T('pedirAoGuia'), T('pedirAoGuiaDica'), pedirAoGuia));
        if (googleLugaresDisponivel !== false) corpo.appendChild(botaoGrande('G', T('procurarNoGoogle'), T('procurarNoGoogleDica'), procurarNoGoogle));
      }
      corpo.appendChild(botaoGrande('📍', T('marcarNoMapa'), T('marcarNoMapaDica'), marcarNoMapa));
      if (navigator.onLine) corpo.appendChild(h('a', { class: 'lk', href: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q + (cidadeAtual() ? ' ' + cidadeAtual() : '')), target: '_blank', rel: 'noopener',
        texto: '↗ ' + T('abrirNoGoogleMaps'), title: T('abrirNoGoogleMapsDica') }));
    }
    function voltar() { return h('button', { class: 'lk', type: 'button', texto: '‹ ' + T('voltar'), onclick: inicio }); }
    function carregando(txt) { corpo.textContent = ''; corpo.appendChild(h('p', { class: 'grande', texto: txt })); corpo.appendChild(h('div', { class: 'carregando', 'aria-hidden': 'true' })); }
    function pedirAoGuia() {
      if (!window.Guia || !Guia.pronta()) { avisar(T('guiaPrecisaChave')); return; }
      carregando(T('guiaProcurando'));
      Guia.procurarLugar(q, { cidade: cidadeAtual(), pais: estado.viagem && estado.viagem.pais, idioma: idioma() }).then(function (r) {
        corpo.textContent = ''; corpo.appendChild(voltar());
        if (!r.lugares.length) { corpo.appendChild(h('p', { class: 'grande', texto: T('guiaNaoAchou') })); corpo.appendChild(botaoGrande('📍', T('marcarNoMapa'), T('marcarNoMapaDica'), marcarNoMapa)); return; }
        if (!r.comWeb) corpo.appendChild(h('p', { class: 'dica', texto: T('guiaSemWeb') }));
        corpo.appendChild(h('p', { class: 'sub', texto: T('eEsse') + '?' }));
        r.lugares.forEach(function (l) {
          corpo.appendChild(h('button', { class: 'bt-grande', type: 'button', onclick: function () {
            confirmar({ nome: l.nome, endereco: [l.endereco, l.cidade].filter(Boolean).join(', '), telefone: l.telefone, site: l.site, fonte: l.fonte, origem: 'ia' });
          } }, [h('span', { class: 'ic-grande', 'aria-hidden': 'true', texto: '📌' }), h('span', { class: 'tx' }, [h('b', { texto: l.nome }), h('small', { texto: [l.endereco, l.cidade].filter(Boolean).join(', ') || '' })])]));
        });
      }).catch(function (e) { corpo.textContent = ''; corpo.appendChild(voltar()); corpo.appendChild(h('p', { class: 'alerta', texto: e && e.message === 'sem-chave' ? T('guiaPrecisaChave') : (e && e.status === 403 ? T('astSemAcesso') : T('iaErro')) })); });
    }
    function procurarNoGoogle() {
      carregando(T('carregando'));
      buscarNoGoogle(q).then(function (r) {
        corpo.textContent = ''; corpo.appendChild(voltar());
        if (r.semChave) { corpo.appendChild(h('p', { class: 'sub', texto: T('googleSemChave') })); return; }
        if (!r.sugestoes.length) { corpo.appendChild(h('p', { class: 'grande', texto: T('googleNaoAchou') })); return; }
        corpo.appendChild(h('p', { class: 'sub', texto: T('resultadosDoGoogle') }));
        r.sugestoes.forEach(function (sg) {
          corpo.appendChild(h('button', { class: 'bt-grande', type: 'button', onclick: function () {
            /* o que vai para o roteiro: o nome que a pessoa confirma e o ponto achado pelo ENDEREÇO na base aberta; do Google fica só o ID */
            confirmar({ nome: sg.nome, enderecoParaAchar: sg.endereco, google_place_id: sg.id, origem: 'google' });
          } }, [h('span', { class: 'ic-grande', 'aria-hidden': 'true', texto: '📌' }), h('span', { class: 'tx' }, [h('b', { texto: sg.nome }), h('small', { texto: sg.endereco || '' })])]));
        });
        corpo.appendChild(h('p', { class: 'pequeno atrib-google', texto: 'powered by Google' }));
      }).catch(function () { corpo.textContent = ''; corpo.appendChild(voltar()); corpo.appendChild(h('p', { class: 'alerta', texto: T('osmErro') })); });
    }
    function marcarNoMapa() {
      Mapa.escolherPonto({ centro: estado.pos || centroViagem(), zoom: estado.pos ? 16 : 14, cidade: estado.viagem && estado.viagem.destino, titulo: T('marcarNoMapa') }).then(function (p) {
        if (!p) { inicio(); return; }
        confirmar({ nome: q, lat: p.lat, lng: p.lng, origem: 'mapa' });
      });
    }
    /* passo final, igual para os três caminhos */
    function confirmar(l) {
      corpo.textContent = ''; corpo.appendChild(voltar());
      corpo.appendChild(h('h3', { texto: T('confirmarLugar') }));
      var nome = h('input', { class: 'campo', id: 'gx-aj-nome', maxlength: '80', value: l.nome || q });
      var cat = h('select', { class: 'campo', id: 'gx-aj-cat' }, ['comer', 'bebidas', 'doces', 'atracao', 'logistica'].map(function (c) { return h('option', { value: c }, T('cat_' + c)); }));
      cat.value = /bar|chop|cervej|pub/i.test(l.nome || q) ? 'bebidas' : /sorvet|doce|chocolat|confeit/i.test(l.nome || q) ? 'doces' : /igreja|capela|museu|parque|cachoeira|mirante|praça/i.test(l.nome || q) ? 'atracao' : /hotel|pousada|posto|farm/i.test(l.nome || q) ? 'logistica' : 'comer';
      var onde = h('p', { class: 'sub', texto: l.lat != null ? '📍 ' + (l.endereco || T('eAqui')) : T('semPontoNoMapa') });
      var marcar = h('button', { class: 'bt leve', type: 'button', texto: '📍 ' + T('marcarNoMapa') });
      var ok = h('button', { class: 'bt cheio', type: 'button', texto: '✓ ' + T('salvar') });
      corpo.appendChild(h('label', { class: 'rot', for: 'gx-aj-nome', texto: T('nome') })); corpo.appendChild(nome);
      corpo.appendChild(h('label', { class: 'rot', for: 'gx-aj-cat', texto: T('tipoLugar') })); corpo.appendChild(cat);
      corpo.appendChild(h('div', { class: 'rot', texto: T('ondeFica') })); corpo.appendChild(onde); corpo.appendChild(marcar); corpo.appendChild(ok);
      marcar.addEventListener('click', function () {
        Mapa.escolherPonto({ centro: l.lat != null ? { lat: l.lat, lng: l.lng } : (estado.pos || centroViagem()), zoom: l.lat != null ? 16 : 14, cidade: estado.viagem && estado.viagem.destino })
          .then(function (p) { if (p) { l.lat = p.lat; l.lng = p.lng; onde.textContent = '📍 ' + (l.endereco || T('eAqui')); } });
      });
      /* endereço sem ponto: acha na base aberta (OpenStreetMap); o ponto passa a ser nosso */
      var paraAchar = l.enderecoParaAchar || (l.lat == null ? l.endereco : null);
      if (paraAchar && navigator.onLine) {
        onde.textContent = T('achandoEndereco'); ok.disabled = true;
        Descobrir.buscarNome(paraAchar, estado.pos || centroViagem(), idioma()).then(function (ls) {
          ok.disabled = false;
          var a = ls[0];
          if (!a) { onde.textContent = T('enderecoNaoAchado'); return; }
          l.lat = a.lat; l.lng = a.lng; if (!l.endereco) l.endereco = a.endereco || null;
          onde.textContent = '📍 ' + (l.endereco || a.nome);
        }).catch(function () { ok.disabled = false; onde.textContent = T('enderecoNaoAchado'); });
      }
      ok.addEventListener('click', function () {
        if (!nome.value.trim()) { nome.focus(); return; }
        if (l.lat == null) { avisar(T('semPontoNoMapa')); marcar.focus(); return; }
        var reg = { nome: nome.value.trim(), categoria: cat.value, subcategoria: null, descricao: l.origem === 'ia' ? T('fonteIA') : null, endereco: l.endereco || null,
          telefone: l.telefone || null, site: l.site || null, fonte_url: l.fonte || null, google_place_id: l.google_place_id || null,
          lat: +l.lat.toFixed(5), lng: +l.lng.toFixed(5), confianca: 'meu', gratis: false, viagem_id: estado.viagem ? estado.viagem.id : null };
        Banco.gravar('lugares', reg).then(function (n) {
          estado.lugaresProprios.push(n); avisar(T('lugarCriado'));
          j.fechar(function () { if (aoCriar) aoCriar(n); });
        });
      });
      setTimeout(function () { nome.focus(); }, 50);
    }
    if (lugarPronto) confirmar(lugarPronto); else inicio();
  }

  /* campo "Lugar" com busca na internet: a pessoa digita "O Legítimo" e escolhe; o lugar vira da viagem e fica no select */
  function campoLugarComBusca(sel, aoEscolher) {
    var q = h('input', { class: 'campo', type: 'search', placeholder: T('exProcurarLugar'), 'aria-label': T('procurarLugar'), autocomplete: 'off' });
    var bt = h('button', { class: 'bt sec', type: 'button', texto: '🔎' , 'aria-label': T('buscar') });
    var lista = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.25rem' });
    function procurar() {
      var t = q.value.trim(); if (t.length < 3) { q.focus(); return; }
      bt.disabled = true; lista.textContent = ''; lista.appendChild(h('p', { class: 'sub', texto: T('carregando') }));
      Descobrir.buscarNome(t, estado.pos || centroViagem(), idioma()).then(function (achados) {
        bt.disabled = false; lista.textContent = '';
        if (!achados.length) {
          lista.appendChild(h('p', { class: 'sub', texto: T('nadaNaInternet') }));
          lista.appendChild(h('button', { class: 'bt sec', type: 'button', texto: '🤝 ' + T('acharJuntos'), onclick: function () {
            janelaAcharJuntos(t, function (n) { if (!sel.querySelector('option[value="' + n.id + '"]')) sel.appendChild(h('option', { value: n.id }, n.nome)); sel.value = n.id; lista.textContent = ''; q.value = ''; if (aoEscolher) aoEscolher(n); });
          } }));
          return;
        }
        var fontes = ['OpenStreetMap']; if (achados.some(function (l) { return l.confianca === 'foursquare'; })) fontes.unshift('Powered by Foursquare'); if (achados.some(function (l) { return l.confianca === 'tripadvisor'; })) fontes.unshift('Tripadvisor');
        if (fontes.length > 1) lista.appendChild(h('p', { class: 'pequeno', texto: fontes.join(' · ') }));
        achados.slice(0, 6).forEach(function (l) {
          lista.appendChild(h('button', { class: 'bt leve', type: 'button', style: 'text-align:left;display:block;line-height:1.3', onclick: function () {
            var ja = lugarPorId(l.id);
            var pr = ja ? Promise.resolve(ja) : Banco.gravar('lugares', Object.assign({}, l, { viagem_id: estado.viagem ? estado.viagem.id : null })).then(function (n) { estado.lugaresProprios.push(n); return n; });
            pr.then(function (n) {
              if (!sel.querySelector('option[value="' + n.id + '"]')) sel.appendChild(h('option', { value: n.id }, n.nome));
              sel.value = n.id; lista.textContent = ''; q.value = '';
              if (aoEscolher) aoEscolher(n);
            });
          } }, [h('strong', { texto: ({ comer: '🍽', atracao: '🎡', bebidas: '🍷', doces: '🍰', logistica: '🅿️' }[l.categoria] || '📍') + ' ' + l.nome }), l.endereco ? h('span', { class: 'sub', style: 'display:block', texto: l.endereco }) : null]));
        });
      }).catch(function () { bt.disabled = false; lista.textContent = ''; lista.appendChild(h('p', { class: 'sub', texto: navigator.onLine ? T('osmErro') : T('semInternet') })); });
    }
    bt.addEventListener('click', procurar);
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); procurar(); } });
    return h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [sel, h('div', { class: 'linha', style: 'flex-wrap:nowrap' }, [q, bt]), lista]);
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
      h('label', { class: 'rot', for: 'gx-item-lugar', texto: T('lugarOpcional') }), campoLugarComBusca(sel, function (n) { if (!tit.value) tit.value = n.nome; }), ok]);
    var j = janela(T('addItem'), corpo);
    sel.addEventListener('change', function () { if (sel.value && !tit.value) tit.value = lugarPorId(sel.value).nome; });
    ok.addEventListener('click', function () {
      if (!tit.value.trim()) { tit.focus(); avisar(T('faltaOque')); return; }
      addItemNaOpcao(o, dmod, { hora: hora.value, titulo: tit.value.trim(), nota: null, tipo: null, lugarId: sel.value || null }).then(function () { j.fechar(); recarregar(); });
    });
  }
  /* editar um item do dia: hora, o que, nota, lugar; ver no mapa; tirar */
  function janelaEditarItem(o, dmod, idx) {
    var it = dmod.itens[idx], l = it.lugarId ? lugarPorId(it.lugarId) : null;
    var hora = h('input', { class: 'campo', type: 'time', id: 'gx-ed-hora', value: it.hora || '' });
    var tit = h('input', { class: 'campo', type: 'text', id: 'gx-ed-tit', maxlength: '100', value: it.titulo || '' });
    var nota = h('input', { class: 'campo', type: 'text', id: 'gx-ed-nota', maxlength: '200', value: it.nota || '', placeholder: T('exNotaItem') });
    var sel = h('select', { class: 'campo', id: 'gx-ed-lugar' }, [h('option', { value: '' }, T('semLugar'))].concat(
      todosLugares().slice().sort(function (a, b) { return a.nome < b.nome ? -1 : 1; }).map(function (x) { return h('option', { value: x.id, selected: x.id === it.lugarId }, x.nome); })));
    var ok = h('button', { class: 'bt', type: 'button' }, T('salvar'));
    var tirar = h('button', { class: 'bt perigo', type: 'button' }, T('tirarItem'));
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('label', { class: 'rot', for: 'gx-ed-hora', texto: T('hora') }), hora,
      h('label', { class: 'rot', for: 'gx-ed-tit', texto: T('oQue') }), tit,
      h('label', { class: 'rot', for: 'gx-ed-nota', texto: T('nota') }), nota,
      h('label', { class: 'rot', for: 'gx-ed-lugar', texto: T('lugarOpcional') }), campoLugarComBusca(sel, function (n) { if (!tit.value.trim()) tit.value = n.nome; }),
      l ? h('div', { class: 'linha' }, [h('button', { class: 'bt sec', type: 'button', texto: '🗺 ' + T('verNoMapa'), onclick: function () { estado.abrirLugar = l.id; estado.filtro = 'todos'; j.fechar(function () { Nav.ir('mapa'); }); } }),
        h('a', { class: 'bt leve', href: Geo.linkRota(l, estado.pos), target: '_blank', rel: 'noopener' }, T('rota'))]) : null,
      h('div', { class: 'acoes' }, [tirar, ok])]);
    var j = janela(T('editarItem'), corpo);
    if (!podeEditar()) { ok.disabled = true; tirar.disabled = true; }
    ok.addEventListener('click', function () {
      if (!tit.value.trim()) { tit.focus(); avisar(T('faltaOque')); return; }
      mudarItem(o, dmod, idx, function (item) { item.hora = hora.value; item.titulo = tit.value.trim(); item.nota = nota.value.trim() || null; item.lugarId = sel.value || null; })
        .then(function (alvo) { alvo.dias.forEach(function (dd) { (dd.itens || []).sort(function (a, b) { return (a.hora || '99') < (b.hora || '99') ? -1 : 1; }); }); return Banco.gravar('roteiros', alvo); })
        .then(function () { j.fechar(); avisar(T('salvo')); recarregar(); });
    });
    tirar.addEventListener('click', function () {
      mudarItem(o, dmod, idx, function () {}).then(function (alvo) { var i2 = o.dias.indexOf(dmod); alvo.dias[i2].itens.splice(idx, 1); return Banco.gravar('roteiros', alvo); })
        .then(function () { j.fechar(); recarregar(); });
    });
  }
  /* muda um item (o roteiro do pacote não muda: cria a cópia "minha" e muda a cópia) */
  function mudarItem(o, dmod, idx, mudar) {
    var alvo = o, i = o.dias.indexOf(dmod), pr = Promise.resolve();
    if (o.origem === 'pacote') {
      alvo = { viagem_id: o.viagem_id, nome: o.nome + ' (' + T('minhaVersao') + ')', origem: 'manual', base_id: null, favorito: false, ordem: (o.ordem || 0) + 0.5, dias: JSON.parse(JSON.stringify(o.dias)) };
      pr = Banco.gravar('roteiros', alvo).then(function (n) { alvo = n; estado.viagem.opcao_ativa = n.id; return Banco.gravar('viagens', estado.viagem); });
    }
    return pr.then(function () { mudar(alvo.dias[i].itens[idx]); return Banco.gravar('roteiros', alvo); });
  }
  /* avisos da viagem (estacionamento pago, feriado…): a pessoa cria, edita e tira */
  function janelaAviso(v, idx) {
    var a = idx != null ? v.avisos[idx] : { titulo: '', texto: '' };
    var tit = h('input', { class: 'campo', id: 'gx-av-tit', maxlength: '60', value: a.titulo, placeholder: T('exAvisoTitulo') });
    var txt = h('input', { class: 'campo', id: 'gx-av-txt', maxlength: '200', value: a.texto || '', placeholder: T('exAvisoTexto') });
    var ok = h('button', { class: 'bt', type: 'button' }, T('salvar'));
    var tirar = idx != null ? h('button', { class: 'bt perigo', type: 'button' }, T('apagar')) : null;
    var j = janela(T(idx != null ? 'editarAviso' : 'novoAviso'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('label', { class: 'rot', for: 'gx-av-tit', texto: T('titulo') }), tit, h('label', { class: 'rot', for: 'gx-av-txt', texto: T('detalhe') }), txt, h('div', { class: 'acoes' }, [tirar, ok])]));
    var gravar = function () { return Banco.gravar('viagens', v).then(function (nv) { estado.viagem = nv; j.fechar(); mostrar(estado.rota); }); };
    ok.addEventListener('click', function () {
      if (!tit.value.trim()) { tit.focus(); return; }
      v.avisos = v.avisos || [];
      var novo = { titulo: tit.value.trim(), texto: txt.value.trim() };
      if (idx != null) v.avisos[idx] = novo; else v.avisos.push(novo);
      gravar();
    });
    if (tirar) tirar.addEventListener('click', function () { v.avisos.splice(idx, 1); gravar(); });
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

  /* ---------- IA: o que a chave dá, com exemplos da viagem ---------- */
  function contextoGuia() {
    var v = estado.viagem;
    if (!v) return Promise.resolve({ viagem: null, pessoas: [], pacote: null, lugares: todosLugares(), dia: null, di: 0, data: hojeIso(), clima: null, idioma: idioma(), opcao: null, tela: estado.rota, onde: ondeEstouTexto() });
    var dias = diasDaViagem(v), hj = hojeIso(), di = dias.indexOf(hj);
    if (di < 0) di = Math.max(0, Math.min(estado.dia, dias.length - 1));
    var o = estado.opcao, dia = o ? o.dias[mapearDia(di, dias.length, o.dias.length)] : null;
    var c = centroViagem();
    return (c ? Clima.previsao(c.lat, c.lng).catch(function () { return null; }) : Promise.resolve(null)).then(function (p) {
      var clima = p && p.dias.filter(function (x) { return x.data === dias[di]; })[0] || null;
      return { viagem: v, pessoas: pessoasDaViagem(v), pacote: estado.pacote, lugares: todosLugares(), dia: dia, di: di, data: dias[di], clima: clima, idioma: idioma(), opcao: o, tela: estado.rota, onde: ondeEstouTexto() };
    });
  }
  TELAS.ia = function (tela) {
    tela.appendChild(h('h1', { texto: T('iaTela') }));
    var ok = window.Guia && Guia.pronta();
    var propria = !!(window.DGO && DGO.ia && (DGO.ia.chavePara('texto') || DGO.ia.provedores().some(function (p) { return p.temChave && !(DGO.ia.proxyDe && DGO.ia.proxyDe(p.id)); })));
    tela.appendChild(h('p', { class: 'sub', texto: T(ok ? (propria ? 'iaTelaOk' : 'iaTelaFabrica') : 'iaTelaSem') }));
    if (ok && !propria) tela.appendChild(h('div', { class: 'cartao' }, [h('p', { texto: T('iaChavePropriaOpcional') }),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { DGO.ia.guia(null, 'texto'); } }, T('iaConfigurar'))]));
    if (!ok) tela.appendChild(h('div', { class: 'cartao' }, [h('p', { texto: T('iaSemChave') }),
      h('button', { class: 'bt', type: 'button', onclick: function () { DGO.ia.guia(null, 'texto'); } }, T('iaConfigurar')),
      h('p', { class: 'pequeno', texto: T('iaChaveOnde') })]));
    var v = estado.viagem, ex = v ? (estado.pacote ? Pacotes.nome(estado.pacote, idioma()) : v.destinoTexto) : T('suaViagem');
    var cartao = function (icone, titulo, texto, exemplo, botao, fn) {
      return h('div', { class: 'cartao' }, [h('h3', { texto: icone + ' ' + titulo }), h('p', { class: 'sub', texto: texto }),
        h('p', { class: 'exemplo', texto: '“' + exemplo + '”' }),
        h('button', { class: 'bt ' + (ok && v ? 'sec' : 'leve'), type: 'button', disabled: !ok || !v, onclick: fn }, botao)]);
    };
    tela.appendChild(cartao('🗓', T('iaMontar'), T('iaMontarTexto'), T('iaMontarEx', { cidade: ex }), T('gerarIA'), gerarComIA));
    tela.appendChild(cartao('🌦', T('iaReplanejar'), T('iaReplanejarTexto'), T('iaReplanejarEx'), T('replanejarHoje'), replanejarHoje));
    tela.appendChild(cartao('💬', T('perguntarGuia'), T('iaPerguntarTexto'), T('iaPerguntarEx'), T('perguntarGuia'), janelaGuia));
    tela.appendChild(cartao('✉', T('iaLerReserva'), T('iaLerReservaTexto'), T('iaLerReservaEx'), T('colarEmail'), function () { Nav.ir('reservas'); setTimeout(function () { janelaImportar(''); }, 200); }));
    tela.appendChild(h('p', { class: 'pequeno', texto: T('iaRegras') }));
  };
  /* replanejar hoje: a IA propõe; a pessoa vê o que mudou e aplica numa cópia (o original não some) */
  function replanejarHoje() {
    if (!estado.viagem || !estado.opcao) { avisar(T('semOpcoes')); return; }
    if (!Guia.pronta()) { Nav.ir('ia'); return; }
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [h('p', { class: 'sub', texto: T('iaMontando') })]);
    var j = janela(T('replanejarHoje'), corpo);
    contextoGuia().then(function (ctx) {
      return Guia.replanejar(ctx).then(function (r) {
        corpo.textContent = '';
        corpo.appendChild(h('p', { class: 'sub', texto: semana(ctx.data) + ', ' + fData(ctx.data) + (ctx.clima ? ' · ' + Clima.icone(ctx.clima.codigo) + ' ' + ctx.clima.min + '°/' + ctx.clima.max + '°' + (ctx.clima.chuva != null ? ' ☔' + ctx.clima.chuva + '%' : '') : '') }));
        if (r.motivo) corpo.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T('iaMudou') }), r.motivo]));
        var bloco = h('div', { class: 'tempo' });
        r.itens.forEach(function (it) {
          bloco.appendChild(h('div', { class: 'item' + (it.mudou ? ' agora' : '') }, [h('span', { class: 'h', texto: it.hora || '—' }),
            h('div', { class: 'x' }, [h('b', { texto: it.titulo }), it.nota ? h('span', { class: 'nota', texto: it.nota }) : null]), h('span', { texto: it.mudou ? '✨' : '' })]));
        });
        corpo.appendChild(bloco);
        corpo.appendChild(h('p', { class: 'pequeno', texto: T('iaConfiraTexto') }));
        corpo.appendChild(h('div', { class: 'acoes' }, [
          h('button', { class: 'bt leve', type: 'button', texto: T('agoraNao'), onclick: function () { j.fechar(); } }),
          h('button', { class: 'bt', type: 'button', texto: T('aplicarPlano'), onclick: function () {
            var o = ctx.opcao, nova = { viagem_id: estado.viagem.id, nome: o.nome + ' · ' + T('replanejado', { d: fData(ctx.data, true) }), origem: 'ia', favorito: false, ordem: (o.ordem || 0) + 0.25, dias: JSON.parse(JSON.stringify(o.dias)) };
            var idx = mapearDia(ctx.di, diasDaViagem(estado.viagem).length, o.dias.length);
            nova.dias[idx].itens = r.itens.map(function (it) { return { hora: it.hora, titulo: it.titulo, nota: it.nota || null, tipo: null, lugarId: it.lugarId, estado: null }; });
            Banco.gravar('roteiros', nova).then(function (n) { estado.viagem.opcao_ativa = n.id; return Banco.gravar('viagens', estado.viagem); })
              .then(function () { j.fechar(); avisar(T('planoAplicado')); estado.dia = ctx.di; recarregar().then(function () { Nav.ir('roteiro'); }); });
          } })]));
      });
    }).catch(function (e) { corpo.textContent = ''; corpo.appendChild(h('p', { class: 'conferir', texto: e.message === 'sem-internet' ? T('semInternet') : e.message === 'ia-formato' ? T('iaFormato') : T('iaErro') })); });
  }
  /* perguntar ao guia: conversa presa aos lugares; nomes de lugares viram links para o mapa */
  var conversaGuia = [];
  function janelaGuia() {
    if (!estado.viagem) { avisar(T('semViagemTexto')); return; }
    if (!window.Guia || !Guia.pronta()) { Nav.ir('ia'); return; }
    var lista = h('div', { class: 'conversa' });
    var campo = h('input', { class: 'campo', id: 'gx-guia', placeholder: T('guiaPlaceholder'), autocomplete: 'off', maxlength: '300' });
    var enviar = h('button', { class: 'bt', type: 'button', texto: '➤', 'aria-label': T('enviar') });
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;flex:1;min-height:0' }, [lista, h('div', { class: 'linha', style: 'flex-wrap:nowrap' }, [campo, enviar])]);
    var j = janela(T('perguntarGuia'), corpo);
    j.caixa.classList.add('cheia');
    var nomes = todosLugares().filter(function (l) { return l.nome.length > 3; }).sort(function (a, b) { return b.nome.length - a.nome.length; });
    function balao(papel, texto) {
      var el = h('div', { class: 'balao ' + papel });
      if (papel === 'ia') {
        /* nome de lugar do pacote vira link que abre no mapa */
        var resto = texto, achou;
        while (resto.length) {
          achou = null;
          nomes.forEach(function (l) { var i = resto.indexOf(l.nome); if (i > -1 && (!achou || i < achou.i)) achou = { i: i, l: l }; });
          if (!achou) { el.appendChild(d.createTextNode(resto)); break; }
          el.appendChild(d.createTextNode(resto.slice(0, achou.i)));
          el.appendChild((function (lug) { return h('button', { class: 'lk', type: 'button', texto: lug.nome, onclick: function () { estado.abrirLugar = lug.id; estado.filtro = 'todos'; j.fechar(function () { Nav.ir('mapa'); }); } }); })(achou.l));
          resto = resto.slice(achou.i + achou.l.nome.length);
        }
      } else el.textContent = texto;
      lista.appendChild(el); lista.scrollTop = lista.scrollHeight;
    }
    if (!conversaGuia.length) balao('ia', T('guiaOla'));
    conversaGuia.forEach(function (m) { balao(m.papel, m.texto); });
    [T('guiaSug1'), T('guiaSug2'), T('guiaSug3')].forEach(function (s) {
      lista.appendChild(h('button', { class: 'chip', type: 'button', texto: s, style: 'align-self:flex-start', onclick: function () { campo.value = s; mandar(); } }));
    });
    function mandar() {
      var t = campo.value.trim(); if (!t) return;
      campo.value = ''; enviar.disabled = true;
      balao('pessoa', t); var pensando = h('div', { class: 'balao ia', texto: '…' }); lista.appendChild(pensando);
      contextoGuia().then(function (ctx) { return Guia.perguntar(ctx, t, conversaGuia); }).then(function (r) {
        pensando.remove(); conversaGuia.push({ papel: 'pessoa', texto: t }, { papel: 'ia', texto: r }); conversaGuia = conversaGuia.slice(-12); balao('ia', r);
      }).catch(function (e) { pensando.remove(); balao('ia', e.message === 'sem-internet' ? T('semInternet') : T('iaErro')); }).then(function () { enviar.disabled = false; campo.focus(); });
    }
    enviar.addEventListener('click', mandar);
    campo.addEventListener('keydown', function (e) { if (e.key === 'Enter') mandar(); });
    setTimeout(function () { campo.focus(); }, 80);
  }

  /* ---------- ✦ o assistente: fala ou digita, o app age ---------- */
  function ondeEstouTexto() {
    var p = estado.pos; if (!p) return '';
    var c = cidadeAtual();
    return p.lat.toFixed(4) + ',' + p.lng.toFixed(4) + (c ? ' (perto de ' + c + ')' : '');
  }
  var conversaAssistente = [];
  function janelaAssistente(textoInicial) {
    var lista = h('div', { class: 'conversa' });
    var campo = h('input', { class: 'campo', id: 'gx-ast', placeholder: T('astPlaceholder'), autocomplete: 'off', maxlength: '300' });
    var mic = h('button', { class: 'bt sec mic', type: 'button', texto: '🎤', 'aria-label': T('falar') });
    var enviar = h('button', { class: 'bt', type: 'button', texto: '➤', 'aria-label': T('enviar') });
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;flex:1;min-height:0' }, [lista, h('div', { class: 'linha', style: 'flex-wrap:nowrap' }, [mic, campo, enviar])]);
    var j = janela('✦ ' + T('assistente'), corpo);
    j.caixa.classList.add('cheia');
    function balao(papel, texto, extra) { var el = h('div', { class: 'balao ' + papel, texto: texto }); if (extra) el.appendChild(extra); lista.appendChild(el); lista.scrollTop = lista.scrollHeight; return el; }
    if (!(window.Guia && Guia.pronta())) {
      balao('ia', navigator.onLine ? T('astSemIA') : T('semInternet'));
      lista.appendChild(h('button', { class: 'bt leve', type: 'button', texto: T('iaConfigurar'), onclick: function () { j.fechar(function () { Nav.ir('ia'); }); } }));
    } else if (!conversaAssistente.length) balao('ia', T('astOla'));
    conversaAssistente.forEach(function (m) { balao(m.papel, m.texto); });
    if (!conversaAssistente.length) [T('astSug1'), T('astSug2'), T('astSug3')].forEach(function (s) {
      lista.appendChild(h('button', { class: 'chip', type: 'button', texto: s, style: 'align-self:flex-start', onclick: function () { campo.value = s; mandar(); } }));
    });
    if (!(window.Guia && Guia.temVoz())) mic.hidden = true;
    mic.addEventListener('click', function () {
      mic.disabled = true; mic.textContent = '…';
      Guia.ouvir(idioma()).then(function (t) { campo.value = t; mandar(); }).catch(function () { avisar(T('naoOuvi')); }).then(function () { mic.disabled = false; mic.textContent = '🎤'; });
    });
    function mandar() {
      var t = campo.value.trim(); if (!t) return;
      if (!(window.Guia && Guia.pronta())) return;
      campo.value = ''; enviar.disabled = true;
      balao('pessoa', t); var pensando = balao('ia', '…');
      contextoGuia().then(function (ctx) { return Guia.pedir(ctx, t, conversaAssistente); }).then(function (r) {
        pensando.remove();
        conversaAssistente.push({ papel: 'pessoa', texto: t }, { papel: 'ia', texto: r.texto }); conversaAssistente = conversaAssistente.slice(-12);
        if (r.tipo === 'lugar' && r.busca) {
          balao('ia', r.texto || T('astProcurando'));
          acharPeloAssistente(r.busca, j);
        } else if (r.tipo === 'mapa' && r.busca) {
          var l = todosLugares().filter(function (x) { return x.nome.toLowerCase() === r.busca.toLowerCase(); })[0];
          balao('ia', r.texto, l ? h('button', { class: 'bt sec', type: 'button', style: 'margin-top:.4rem', texto: '🗺 ' + T('verNoMapa'), onclick: function () { estado.abrirLugar = l.id; estado.filtro = 'todos'; j.fechar(function () { Nav.ir('mapa'); }); } }) : null);
        } else if (r.tipo === 'replanejar') {
          balao('ia', r.texto, estado.viagem ? h('button', { class: 'bt sec', type: 'button', style: 'margin-top:.4rem', texto: '🌦 ' + T('replanejarHoje'), onclick: function () { j.fechar(function () { replanejarHoje(); }); } }) : null);
        } else balao('ia', r.texto || T('iaErro'));
      }).catch(function (e) { pensando.remove(); balao('ia', e.message === 'sem-internet' ? T('semInternet') : (/cota/.test(e.message) || e.status === 429 ? T('astCota') : (/sem-acesso|403/.test(e.message + ' ' + (e.status || '')) ? T('astSemAcesso') : T('iaErro')))); }).then(function () { enviar.disabled = false; });
    }
    /* "acha o bar do zé": primeiro as bases (catálogo, OSM, Foursquare), depois o guia na internet; a pessoa confirma e salva */
    function acharPeloAssistente(busca, jan) {
      var caixa = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.35rem' });
      var el = balao('ia', '', caixa);
      function opcao(l, origem) {
        return h('button', { class: 'bt-grande', type: 'button', onclick: function () {
          var pr = origem === 'ia' ? Promise.resolve(null) : Banco.gravar('lugares', Object.assign({}, l, { viagem_id: estado.viagem ? estado.viagem.id : null })).then(function (n) { estado.lugaresProprios.push(n); return n; });
          if (origem === 'ia') { jan.fechar(function () { janelaAcharJuntosConfirmar({ nome: l.nome, endereco: [l.endereco, l.cidade].filter(Boolean).join(', '), telefone: l.telefone, site: l.site, fonte: l.fonte, origem: 'ia' }); }); return; }
          pr.then(function (n) { avisar(T('lugarCriado')); jan.fechar(function () { if (estado.viagem && estado.opcao && podeEditar()) janelaAddAoRoteiro(n); else { estado.abrirLugar = n.id; Nav.ir(emViagem() ? 'mapa' : 'explorar'); } }); });
        } }, [h('span', { class: 'ic-grande', 'aria-hidden': 'true', texto: '📌' }), h('span', { class: 'tx' }, [h('b', { texto: l.nome }), h('small', { texto: [l.endereco, l.cidade].filter(Boolean).join(', ') || (l.fonte || '') })])]);
      }
      Descobrir.buscarNome(busca, estado.pos || centroViagem(), idioma()).catch(function () { return []; }).then(function (ls) {
        var bons = ls.filter(function (l) { return l.categoria !== 'atracao' || l.subcategoria; }).slice(0, 3);
        if (bons.length) { caixa.appendChild(h('p', { class: 'sub', texto: T('eEsse') + '?' })); bons.forEach(function (l) { caixa.appendChild(opcao(l, 'base')); }); }
        return Guia.procurarLugar(busca, { cidade: cidadeAtual(), idioma: idioma() }).catch(function () { return { lugares: [] }; }).then(function (r) {
          var novos = r.lugares.filter(function (l) { return !bons.some(function (b) { return b.nome.toLowerCase() === l.nome.toLowerCase(); }); });
          if (novos.length) { caixa.appendChild(h('p', { class: 'sub', texto: T('fonteIA') + ':' })); novos.forEach(function (l) { caixa.appendChild(opcao(l, 'ia')); }); }
          if (!bons.length && !novos.length) caixa.appendChild(h('p', { texto: T('guiaNaoAchou') }));
          caixa.appendChild(h('button', { class: 'bt leve', type: 'button', texto: '🤝 ' + T('acharJuntos'), onclick: function () { jan.fechar(function () { janelaAcharJuntos(busca, function (n) { if (estado.viagem && estado.opcao && podeEditar()) janelaAddAoRoteiro(n); }); }); } }));
          lista.scrollTop = lista.scrollHeight;
        });
      });
    }
    enviar.addEventListener('click', mandar);
    campo.addEventListener('keydown', function (e) { if (e.key === 'Enter') mandar(); });
    if (textoInicial) { campo.value = textoInicial; setTimeout(mandar, 50); }
    else setTimeout(function () { (Guia.temVoz && Guia.temVoz() ? mic : campo).focus(); }, 80);
  }
  /* o passo "Confira e salve" do Vamos achar juntos, aberto direto com um lugar já achado */
  function janelaAcharJuntosConfirmar(l) { janelaAcharJuntos(l.nome, function (n) { if (estado.viagem && estado.opcao && podeEditar()) janelaAddAoRoteiro(n); }, l); }
  function botaoAssistente() {
    var antigo = $('bt-assistente');
    if (antigo) { var r = antigo.querySelector('.ia-rotulo'); if (r) r.textContent = idioma() === 'en' ? 'AI' : 'IA'; return; }
    var b = h('button', { class: 'bt-assistente', id: 'bt-assistente', type: 'button', 'aria-label': T('assistente'), title: T('assistente'), onclick: function () { janelaAssistente(); } },
      [h('span', { 'aria-hidden': 'true', texto: '✦' }), h('span', { class: 'ia-rotulo', 'aria-hidden': 'true', texto: idioma() === 'en' ? 'AI' : 'IA' })]);
    d.body.appendChild(b);
  }

  /* ---------- Mapa da viagem (mapa + lista + cartão: mapa.js) ---------- */
  var FILTROS = ['todos', 'paraVoces', 'favoritos', 'perto', 'comer', 'atracao', 'gratis', 'bebidas', 'doces', 'logistica'];
  TELAS.mapa = function (tela) {
    if (!estado.viagem) return semViagem(tela);
    somaGostos = Gostos.doGrupo(pessoasDaViagem());
    var v = estado.viagem, dias = diasDaViagem(v);
    Mapa.tela(tela, {
      lugares: function () { return todosLugares().concat(estado.descobertas.filter(function (x) { return !lugarPorId(x.id); })); },
      itensDoDia: function () {
        var o = estado.opcao; if (!o) return [];
        var dmod = o.dias[mapearDia(estado.dia, dias.length, o.dias.length)];
        return (dmod && dmod.itens || []).filter(function (it) { return it.lugarId; });
      },
      centro: centroViagem(), zoom: 13, cidade: v.destino, filtros: FILTROS,
      buscarFora: function (q) { return Descobrir.buscarNome(q, estado.pos || centroViagem(), idioma()); },
      acrescentar: function (ls) { var ids = {}; estado.descobertas.forEach(function (x) { ids[x.id] = 1; }); ls.forEach(function (l) { if (!ids[l.id] && !lugarPorId(l.id)) estado.descobertas.push(l); }); },
      acharJuntos: function (q, aoCriar) { janelaAcharJuntos(q, aoCriar); },
      topo: function (topo) {
        /* dia do roteiro (os mesmos chips do Roteiro) */
        if (!estado.opcao) return;
        var tabs = h('div', { class: 'dias', role: 'tablist', 'aria-label': T('diasDaViagem') });
        dias.forEach(function (dt, i) {
          tabs.appendChild(h('button', { class: 'dia', role: 'tab', type: 'button', 'aria-selected': i === estado.dia ? 'true' : 'false', onclick: function () { estado.dia = i; mostrar('mapa'); } },
            [h('span', { texto: semana(dt) }), h('small', { texto: fData(dt, true) })]));
        });
        topo.appendChild(tabs);
      },
      rodape: function () {
        var c = centroViagem();
        return h('div', { class: 'cartao', style: 'margin:.5rem' }, [
          h('div', { class: 'linha' }, [
            h('button', { class: 'bt sec', type: 'button', disabled: !c, texto: T('descobrirBotao'), onclick: function (e) {
              var bt = e.currentTarget; bt.disabled = true; bt.textContent = T('carregando');
              Descobrir.perto(estado.pos || c, 8000).then(function (l) { estado.descobertas = l; avisar(T('descobertos', { n: l.length })); mostrar('mapa'); })
                .catch(function () { bt.disabled = false; bt.textContent = T('descobrirBotao'); avisar(navigator.onLine ? T('osmErro') : T('semInternet')); });
            } }),
            h('button', { class: 'bt leve', type: 'button', texto: '＋ ' + T('novoLugar'), onclick: janelaNovoLugar })
          ]),
          h('p', { class: 'pequeno', texto: '© OpenStreetMap contributors (ODbL)' })
        ]);
      }
    });
  };
  TELAS.explorar = function (tela) { Explorar.tela(tela); };
  TELAS.salvos = function (tela) {
    tela.appendChild(h('h1', { texto: T('rota_salvos') }));
    tela.appendChild(h('p', { class: 'sub', texto: T('salvosTexto') }));
    var ls = estado.lugaresProprios.filter(function (l) { return !l.viagem_id; });
    if (!ls.length) tela.appendChild(h('p', { class: 'sub', texto: T('semSalvos') }));
    var restr = restricoesDoGrupo();
    ls.forEach(function (l) { tela.appendChild(cartaoLugar(l, restr)); });
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
  /* dono | edita | ve (vem da nuvem; sem nuvem, dono) */
  function papelViagem() { return estado.papel || 'dono'; }
  function podeEditar() { return papelViagem() !== 've'; }
  function cartaoLugar(l, restr) {
    var fav = !!estado.favoritos['lugar:' + l.id];
    var det = h('details', { class: 'lugar', 'data-id': l.id });
    var meta = h('span', { class: 'meta' }, [placa(l.categoria), l.subcategoria ? nomeSub(l.subcategoria) : null,
      l._km != null ? Geo.formatarKm(l._km) : null, l.gratis ? h('span', { class: 'etq gratis', texto: T('gratis') }) : null,
      Gostos.combina(l, somaGostos) > 0 ? h('span', { class: 'etq combina', texto: '♥ ' + T('combina') }) : null,
      l.confianca === 'baixa' ? h('span', { class: 'conferir', texto: T('conferir') }) : null,
      l.nota != null ? h('span', { class: 'etq', texto: '★ ' + String(l.nota).replace('.', ',') }) : null,
      l.confianca === 'osm' ? h('span', { class: 'pequeno', texto: 'OSM' }) : null,
      l.confianca === 'foursquare' ? h('span', { class: 'pequeno', texto: 'Foursquare' }) : null,
      l.confianca === 'tripadvisor' ? h('span', { class: 'pequeno', texto: 'Tripadvisor' }) : null]);
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
    if (estado.viagem && estado.opcao && podeEditar()) corpo.appendChild(h('button', { class: 'bt', type: 'button', onclick: function () { janelaAddAoRoteiro(l); } }, '＋ ' + T('porNoDia')));
    if (!estado.viagem && window.Explorar) Explorar.acoes(l, corpo);
    else if ((l.confianca === 'osm' || l.confianca === 'foursquare' || l.confianca === 'tripadvisor') && !estado.lugaresProprios.some(function (x) { return x.id === l.id; })) corpo.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: function () {
      Banco.gravar('lugares', Object.assign({}, l, { viagem_id: estado.viagem.id })).then(function () { avisar(T('salvo')); recarregar(); }); } }, T('salvarLugar')));
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
    var achar = h('button', { class: 'bt leve', type: 'button' }, '🔎 ' + T('acharNoMapa'));
    var ok = h('button', { class: 'bt', type: 'button' }, T('salvar'));
    var pos = null;
    var j = janela(T('novoLugar'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { class: 'sub', texto: T('novoLugarDica') }),
      h('label', { class: 'rot', for: 'gx-nl-nome', texto: T('nome') }), nome, h('label', { class: 'rot', for: 'gx-nl-cat', texto: T('tipoLugar') }), cat,
      h('label', { class: 'rot', for: 'gx-nl-end', texto: T('endereco') }), end, h('div', { class: 'linha' }, [achar, aqui]), h('label', { class: 'rot', for: 'gx-nl-nota', texto: T('nota') }), nota, ok]));
    aqui.addEventListener('click', function () { pegarPosicao().then(function (p) { pos = p; aqui.textContent = '📍 ✓ ±' + p.precisao + ' m'; }); });
    achar.addEventListener('click', function () {
      var q = [nome.value.trim(), end.value.trim()].filter(Boolean).join(', ');
      if (!q) { nome.focus(); return; }
      achar.disabled = true; achar.textContent = T('carregando');
      Descobrir.buscarNome(q, estado.pos || centroViagem(), idioma()).then(function (ls) {
        achar.disabled = false;
        if (!ls.length) { achar.textContent = '🔎 ' + T('nadaNaInternet'); return; }
        var l = ls[0]; pos = { lat: l.lat, lng: l.lng, precisao: 0 };
        if (!end.value.trim() && l.endereco) end.value = l.endereco;
        if (l.categoria) cat.value = l.categoria;
        achar.textContent = '✓ ' + (l.endereco || l.nome).slice(0, 40);
      }).catch(function () { achar.disabled = false; achar.textContent = '🔎 ' + T(navigator.onLine ? 'osmErro' : 'semInternet'); });
    });
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
        tela.appendChild(h('div', { class: 'linha' }, [
          h('button', { class: 'bt', type: 'button', onclick: function () { janelaReserva(null); } }, '＋ ' + T('novaReserva')),
          h('button', { class: 'bt sec', type: 'button', onclick: function () { janelaImportar(''); } }, '✉ ' + T('colarEmail'))]));
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
      if (!existe) return Cofre.temNaConta().then(function (naConta) { if (naConta) { caixaTrazerCofre(tela, pronto); return null; } return false; });
      return true;
    }).then(function (existe) {
      if (existe === null) return;
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
  /* este celular não tem o cofre, mas a conta tem (reservas de outro celular) */
  function caixaTrazerCofre(tela, pronto) {
    var caixa = h('div', { class: 'cartao' }, [h('h3', { texto: T('trazerCofre') }), h('p', { class: 'sub', texto: T('trazerCofreTexto') })]);
    var pin = h('input', { class: 'campo', id: 'gx-tc-pin', type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: '6', placeholder: '••••••' });
    var msg = h('p', { class: 'pequeno', role: 'status', 'aria-live': 'polite' });
    var fim = function (p) { return p.then(function (codigo) { return codigo ? mostrarCodigo(codigo) : null; }).then(function () { caixa.remove(); avisar(T('cofreTrazido')); pronto(); }); };
    var erro = function (e) { msg.textContent = e.message === 'pin-formato' ? T('pinFormato') : e.message === 'cancelado' ? '' : T('codigoErrado'); };
    var bQR = h('button', { class: 'bt', type: 'button', texto: '📷 ' + T('lerQR'), onclick: function () {
      if (!/^\d{6}$/.test(pin.value)) { msg.textContent = T('pinFormato'); pin.focus(); return; }
      lerQR().then(function (b64) { return fim(Cofre.importarChave(b64, pin.value)); }).catch(erro);
    } });
    var cod = h('input', { class: 'campo', id: 'gx-tc-cod', autocomplete: 'off', placeholder: 'XXXXX-XXXXX-XXXXX-XXXXX' });
    var bCod = h('button', { class: 'bt sec', type: 'button', texto: T('usarCodigoRecuperacao'), onclick: function () {
      if (!/^\d{6}$/.test(pin.value)) { msg.textContent = T('pinFormato'); pin.focus(); return; }
      if (cod.hidden) { cod.hidden = false; cod.focus(); return; }
      fim(Cofre.importarPorCodigo(cod.value, pin.value)).catch(erro);
    } });
    cod.hidden = true;
    var bNovo = h('button', { class: 'lk', type: 'button', texto: T('criarCofreNovo'), onclick: function () {
      if (!confirm(T('criarCofreNovoAviso'))) return;
      Banco.apagar('cofre', 'recuperacao').then(function () { caixa.remove(); pedirCofre(tela, pronto); });
    } });
    caixa.appendChild(h('label', { class: 'rot', for: 'gx-tc-pin', texto: T('pinNovoAqui') })); caixa.appendChild(pin);
    caixa.appendChild(bQR); caixa.appendChild(bCod); caixa.appendChild(cod); caixa.appendChild(msg); caixa.appendChild(bNovo);
    tela.appendChild(caixa);
  }
  var qrLibs = null;
  function carregarQR() {
    if (window.qrcode && window.jsQR) return Promise.resolve();
    if (qrLibs) return qrLibs;
    qrLibs = ['vendor/qr/qrcode.js', 'vendor/qr/jsqr.js'].reduce(function (p, src) {
      return p.then(function () { return new Promise(function (ok, erro) { var s = h('script', { src: src }); s.onload = ok; s.onerror = function () { qrLibs = null; erro(new Error('qr')); }; d.head.appendChild(s); }); });
    }, Promise.resolve());
    return qrLibs;
  }
  /* celular antigo: QR com a chave (só com o cofre aberto; some em 2 min) */
  function mostrarQR() {
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:center;gap:.6rem' }, [h('p', { class: 'sub', texto: T('qrTexto') })]);
    var j = janela(T('qrTitulo'), corpo);
    Promise.all([carregarQR(), Cofre.exportarChave()]).then(function (r) {
      var q = qrcode(0, 'M'); q.addData('GXK1:' + r[1]); q.make();
      var img = h('img', { src: q.createDataURL(6, 8), alt: T('qrTitulo'), style: 'width:min(70vw,18rem);height:auto;border-radius:12px;background:#fff' });
      corpo.appendChild(img);
      corpo.appendChild(h('p', { class: 'pequeno', texto: T('qrSome') }));
      setTimeout(function () { j.fechar(); }, 120000);
    }).catch(function () { corpo.appendChild(h('p', { class: 'conferir', texto: T('cofreErro') })); });
  }
  /* celular novo: lê o QR pela câmera (ou cola o texto do QR) */
  function lerQR() {
    return new Promise(function (ok, erro) {
      var video = h('video', { playsinline: true, autoplay: true, muted: true, style: 'width:100%;border-radius:12px;background:#000;max-height:50vh' });
      var manual = h('input', { class: 'campo', placeholder: 'GXK1:…', 'aria-label': T('colarQR'), autocomplete: 'off' });
      var msg = h('p', { class: 'pequeno', role: 'status' });
      var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [h('p', { class: 'sub', texto: T('lerQRTexto') }), video, manual, msg]);
      var fluxo = null, parar = function () { if (fluxo) fluxo.getTracks().forEach(function (t) { t.stop(); }); fluxo = null; };
      var j = janela(T('lerQR'), corpo, function () { parar(); erro(new Error('cancelado')); });
      var achou = function (txt) { var m = /^GXK1:([A-Za-z0-9+\/=]{40,48})$/.exec(String(txt || '').trim()); if (!m) { msg.textContent = T('qrInvalido'); return; } parar(); j.fechar(function () { ok(m[1]); }); };
      manual.addEventListener('change', function () { achou(manual.value); });
      carregarQR().then(function () {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { video.hidden = true; msg.textContent = T('semCamera'); return; }
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
          fluxo = s; video.srcObject = s;
          var cv = d.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
          (function tick() {
            if (!fluxo) return;
            if (video.readyState >= 2) {
              cv.width = video.videoWidth; cv.height = video.videoHeight; cx.drawImage(video, 0, 0);
              var im = cx.getImageData(0, 0, cv.width, cv.height), r = jsQR(im.data, im.width, im.height);
              if (r && r.data) { achou(r.data); return; }
            }
            requestAnimationFrame(tick);
          })();
        }).catch(function () { video.hidden = true; msg.textContent = T('semCamera'); });
      });
    });
  }
  /* e-mail de reserva → reservas (regras no aparelho; IA se a pessoa pedir) */
  function janelaImportar(textoInicial) {
    if (!estado.viagem) { avisar(T('semViagemTexto')); return; }
    var txt = h('textarea', { class: 'campo', id: 'gx-imp', rows: '7', placeholder: T('colarEmailDica') }, textoInicial || '');
    var lista = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.5rem' });
    var msg = h('p', { class: 'pequeno', role: 'status', 'aria-live': 'polite' });
    var bLer = h('button', { class: 'bt', type: 'button', texto: T('lerEmail') });
    var bIA = h('button', { class: 'bt sec', type: 'button', texto: '✨ ' + T('lerComIA') });
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [h('p', { class: 'sub', texto: T('importarTexto') }), txt, h('div', { class: 'linha' }, [bLer, bIA]), msg, lista]);
    var j = janela(T('importarTitulo'), corpo, function () { if (estado.rota === 'reservas') mostrar('reservas'); });
    function mostrarCandidatos(cs) {
      lista.textContent = '';
      if (!cs.length) { msg.textContent = T('nadaEncontrado'); return; }
      msg.textContent = T('encontrei', { n: cs.length });
      cs.forEach(function (c) {
        var card = h('div', { class: 'cartao', style: 'background:var(--sup2)' }, [
          h('span', { class: 'pequeno', texto: T('res_' + c.tipo) + (c.fonte === 'ia' ? ' · ✨' : '') }), h('b', { texto: c.titulo }),
          c.quando ? h('span', { texto: fData(c.quando.slice(0, 10)) + (c.quando.length > 10 ? ' · ' + c.quando.slice(11, 16) : '') }) : null,
          c.codigo ? h('span', { class: 'linha' }, [T('codigo') + ': ', h('code', { texto: c.codigo })]) : null,
          c.local ? h('span', { class: 'sub', texto: c.local }) : null, c.nota ? h('span', { class: 'sub', texto: c.nota }) : null]);
        var add = h('button', { class: 'bt', type: 'button', texto: '＋ ' + T('adicionarReserva') });
        add.addEventListener('click', function () {
          add.disabled = true;
          var gravar = function () {
            return Cofre.cifrar({ tipo: c.tipo, titulo: c.titulo, quando: c.quando || '', codigo: c.codigo || '', local: c.local || '', nota: c.nota || '' })
              .then(function (blob) { return Banco.gravar('reservas', { viagem_id: estado.viagem.id, tipo: c.tipo, conteudo: blob }); })
              .then(function () { add.textContent = '✓ ' + T('adicionado2'); });
          };
          if (Cofre.aberto()) gravar(); else { var cx = h('div', {}); card.appendChild(cx); pedirCofre(cx, function () { cx.remove(); gravar(); }); add.disabled = false; }
        });
        card.appendChild(add); lista.appendChild(card);
      });
    }
    bLer.addEventListener('click', function () { mostrarCandidatos(Importar.porRegras(txt.value)); });
    bIA.addEventListener('click', function () {
      if (!confirm(T('lerComIAAviso'))) return;
      bIA.disabled = true; msg.textContent = T('carregando');
      Importar.porIA(txt.value, idioma()).then(mostrarCandidatos).catch(function (e) { msg.textContent = e.message === 'sem-ia' ? T('iaSemChave') : T('iaErro'); }).then(function () { bIA.disabled = false; });
    });
    if (textoInicial) setTimeout(function () { mostrarCandidatos(Importar.porRegras(textoInicial)); }, 50);
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
    if (estado.viagem) tela.appendChild(cartaoCompartilhar(estado.viagem));
    var v = estado.viagem, naViagem = v && v.pessoas || [];
    [['familia', 'grupoFamilia', 'grupoFamiliaTexto'], ['convidado', 'grupoConvidados', 'grupoConvidadosTexto'], ['viagem', 'grupoSoViagem', 'grupoSoViagemTexto']].forEach(function (gr) {
      var ps = estado.pessoas.filter(function (p) { return grupoDe(p) === gr[0]; });
      if (!ps.length) return;
      tela.appendChild(h('div', { class: 'secao-cab' }, [h('h2', { texto: T(gr[1]) }), h('p', { class: 'pequeno', texto: T(gr[2]) })]));
      ps.forEach(function (p) { tela.appendChild(cartaoPessoa(p, v && naViagem.indexOf(p.id) > -1 ? v : null)); });
    });
  };
  /* compartilhar a viagem: membros, convite por link, e cartão de texto para quem fica em casa */
  function cartaoCompartilhar(v) {
    var c = h('div', { class: 'cartao' }, [h('h3', { texto: T('compartilharViagem') })]);
    var s = Conta.sessao();
    if (!s || !window.Nuvem) { c.appendChild(h('p', { class: 'sub', texto: T('compartilharPrecisaConta') })); return c; }
    var papel = papelViagem();
    if (papel !== 'dono') {
      c.appendChild(h('p', { class: 'sub', texto: T(papel === 'edita' ? 'vocePodeEditar' : 'voceSoVe') }));
      c.appendChild(h('button', { class: 'bt perigo', type: 'button', texto: T('sairDaViagem'), onclick: function () {
        if (!confirm(T('sairDaViagemAviso'))) return;
        Nuvem.sairViagem(v.id).then(function () { return apagarViagemLocal(v); }).then(function () { return Contexto.definir('explorar'); }).then(recarregarContexto).then(function () { Nav.ir('viagens'); });
      } }));
      return c;
    }
    c.appendChild(h('p', { class: 'sub', texto: T('compartilharTexto') }));
    var lista = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.3rem' });
    c.appendChild(lista);
    Nuvem.membros(v.id).then(function (ms) {
      (ms || []).forEach(function (m) {
        lista.appendChild(h('div', { class: 'linha entre' }, [h('span', { texto: m.email }), h('span', { class: 'linha', style: 'gap:.3rem' }, [
          h('button', { class: 'chip', type: 'button', 'aria-pressed': m.papel === 've' ? 'true' : 'false', texto: T('papelVe'), onclick: function () { Nuvem.mudarMembro(v.id, m.user_id, 've').then(function () { mostrar('familia'); }); } }),
          h('button', { class: 'chip', type: 'button', 'aria-pressed': m.papel === 'edita' ? 'true' : 'false', texto: T('papelEdita'), onclick: function () { Nuvem.mudarMembro(v.id, m.user_id, 'edita').then(function () { mostrar('familia'); }); } }),
          h('button', { class: 'fav', type: 'button', 'aria-label': T('tirarMembro'), texto: '✕', onclick: function () { Nuvem.mudarMembro(v.id, m.user_id, null).then(function () { mostrar('familia'); }); } })])]));
      });
      if (!(ms || []).length) lista.appendChild(h('p', { class: 'pequeno', texto: T('semMembros') }));
    }).catch(function () { lista.appendChild(h('p', { class: 'pequeno', texto: navigator.onLine ? T('erroRede') : T('semInternet') })); });
    c.appendChild(h('div', { class: 'linha' }, [
      h('button', { class: 'bt sec', type: 'button', texto: '🔗 ' + T('convidarVe'), onclick: function () { convidar(v, 've'); } }),
      h('button', { class: 'bt sec', type: 'button', texto: '🔗 ' + T('convidarEdita'), onclick: function () { convidar(v, 'edita'); } })
    ]));
    c.appendChild(h('p', { class: 'pequeno', texto: T('convitePrivacidade') }));
    c.appendChild(h('h3', { texto: T('quemFicaEmCasa'), style: 'margin-top:.5rem' }));
    c.appendChild(h('p', { class: 'sub', texto: T('quemFicaEmCasaTexto') }));
    c.appendChild(h('div', { class: 'linha' }, [
      h('button', { class: 'bt leve', type: 'button', texto: '🏨 ' + T('compartilharHotel'), onclick: function () { compartilharCartao(v, 'hotel'); } }),
      h('button', { class: 'bt leve', type: 'button', texto: '✈ ' + T('compartilharVoos'), onclick: function () { compartilharCartao(v, 'voo'); } })
    ]));
    return c;
  }
  function convidar(v, papel) {
    avisar(T('carregando'));
    Nuvem.criarConvite(v.id, papel, 14).then(function (tok) {
      var link = location.origin + location.pathname + '#convite=' + tok;
      var texto = T('conviteMensagem', { nome: v.nome, papel: T(papel === 'edita' ? 'papelEdita' : 'papelVe').toLowerCase() }) + '\n' + link;
      enviarTexto(T('convite'), texto);
    }).catch(function () { avisar(navigator.onLine ? T('erroRede') : T('semInternet')); });
  }
  /* cartão de texto (hotel ou voos) para mandar pelo WhatsApp: pede o cofre, monta só o essencial */
  function compartilharCartao(v, tipo) {
    var corpo = h('div', {}), j = janela(T(tipo === 'hotel' ? 'compartilharHotel' : 'compartilharVoos'), corpo);
    pedirCofre(corpo, function () {
      Banco.listar('reservas', function (r) { return r.viagem_id === v.id && r.tipo === tipo; }).then(function (rs) {
        return Promise.all(rs.map(function (r) { return Cofre.decifrar(r.conteudo).catch(function () { return null; }); }));
      }).then(function (cs) {
        cs = cs.filter(Boolean);
        var linhas = [T('cartaoTitulo', { nome: v.nome, de: fData(v.inicio, true), ate: fData(v.fim, true) })];
        if (tipo === 'hotel') {
          var e = (v.estadias || [])[0];
          if (e && e.nome) linhas.push('🏨 ' + e.nome + (e.endereco ? ' · ' + e.endereco : ''));
          cs.forEach(function (c) { linhas.push('🏨 ' + c.titulo + (c.local ? ' · ' + c.local : '') + (c.quando ? ' · ' + fData(c.quando.slice(0, 10), true) : '') + (c.nota ? ' · ' + c.nota : '')); });
        } else {
          cs.sort(function (a, b) { return (a.quando || '') < (b.quando || '') ? -1 : 1; });
          cs.forEach(function (c) { linhas.push('✈ ' + c.titulo + (c.quando ? ' · ' + fData(c.quando.slice(0, 10), true) + (c.quando.length > 10 ? ' ' + c.quando.slice(11, 16) : '') : '')); });
        }
        if (linhas.length === 1) linhas.push(T('cartaoVazio'));
        linhas.push(T('cartaoRodape'));
        var texto = linhas.join('\n');
        corpo.textContent = '';
        corpo.appendChild(h('pre', { class: 'cartao-texto', texto: texto }));
        corpo.appendChild(h('p', { class: 'pequeno', texto: T('cartaoSemCodigo') }));
        corpo.appendChild(h('button', { class: 'bt', type: 'button', texto: T('enviar'), onclick: function () { enviarTexto(v.nome, texto); } }));
      });
    });
  }
  function enviarTexto(titulo, texto) {
    if (navigator.share) return navigator.share({ title: titulo, text: texto }).catch(function () {});
    return navigator.clipboard.writeText(texto).then(function () { avisar(T('copiadoCole')); }).catch(function () { prompt(T('copieManual'), texto); });
  }
  function apagarViagemLocal(v) {
    return Banco.listar('roteiros', function (r) { return r.viagem_id === v.id; }).then(function (rs) { return Promise.all(rs.map(function (r) { return Banco.gravarDeFora('roteiros', Object.assign(r, { apagado: true })); })); })
      .then(function () { return Banco.gravarDeFora('viagens', Object.assign(v, { apagado: true })); });
  }
  /* link de convite (#convite=…): guardado até a pessoa entrar; depois aceita e abre a viagem */
  function lerConvite() {
    var m = (location.hash || '').match(/^#convite=([a-z0-9]{16,40})$/);
    if (m) { try { localStorage.setItem('guiaxpert.convite', m[1]); } catch (e) {} history.replaceState(null, '', location.pathname); }
  }
  function aceitarConvitePendente() {
    var tok = null; try { tok = localStorage.getItem('guiaxpert.convite'); } catch (e) {}
    if (!tok || !Conta.sessao() || !window.Nuvem) return Promise.resolve(false);
    try { localStorage.removeItem('guiaxpert.convite'); } catch (e) {}
    avisar(T('aceitandoConvite'));
    return Nuvem.aceitarConvite(tok).then(function (r) {
      return Nuvem.sincronizar().then(function () { return Contexto.definir('viagem', r.viagem_id); }).then(recarregarContexto).then(function () {
        avisar(T('conviteAceito', { nome: r.nome || '' })); Nav.ir('inicio', { substituir: true }); return true;
      });
    }).catch(function (e) { avisar(e && /inválido|vencido/i.test(e.message) ? T('conviteInvalido') : T('erroRede')); return false; });
  }
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
      var rolagem = j.caixa ? j.caixa.scrollTop : 0;   /* a folha não pode pular a cada toque */
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
      if (j.caixa) j.caixa.scrollTop = rolagem;
      if (foco) { var b = lista.querySelector('.gosto[data-id="' + foco + '"]'); if (b) b.focus({ preventScroll: true }); }
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
    tela.appendChild(faixaFotos(T('rota_viagens'), null, { compacta: true }));
    tela.appendChild(h('div', { class: 'linha entre' }, [h('span'), h('button', { class: 'bt', type: 'button', onclick: function () { estado.rascunho = null; Nav.ir('nova'); } }, '＋ ' + T('novo'))]));
    tela.appendChild(h('p', { class: 'sub', texto: T('viagensTexto') }));
    Banco.listar('viagens').then(function (vs) {
      vs.sort(function (a, b) { return a.inicio > b.inicio ? -1 : 1; });
      if (!vs.length) tela.appendChild(h('p', { class: 'sub', texto: T('semViagemTexto') }));
      vs.forEach(function (v) {
        var atual = estado.viagem && estado.viagem.id === v.id;
        tela.appendChild(h('div', { class: 'cartao', style: atual ? 'border-color:var(--serra)' : null }, [
          h('div', { class: 'linha entre' }, [h('b', { texto: v.nome }), atual ? h('span', { class: 'etq gratis', texto: T('emUso') }) : null]),
          h('span', { class: 'sub', texto: fData(v.inicio) + ' – ' + fData(v.fim) + ' · ' + T('nPessoas', { n: (v.pessoas || []).length }) }),
          h('div', { class: 'linha' }, [
            !atual ? h('button', { class: 'bt sec', type: 'button', onclick: function () { Contexto.definir('viagem', v.id).then(recarregarContexto).then(function () { Nav.ir('inicio'); }); } }, T('abrirViagem')) : null,
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
      }).then(function () {
        /* a cidade não tem mais viagem? tira o mapa guardado também */
        if (!v.destino || !window.Offline) return;
        return Banco.listar('viagens', function (x) { return x.destino === v.destino; }).then(function (outras) { if (!outras.length) return Offline.apagar(v.destino); });
      }).then(function () { j.fechar(); return Contexto.definir('explorar'); }).then(recarregarContexto).then(function () { Nav.ir('viagens'); });
    });
  }

  /* ------------------------------------------------------------------
     7. WIZARD "NOVA VIAGEM" — Passo X de N, Voltar/Próximo, guarda o
     rascunho para continuar depois. Reaproveita a família já cadastrada.
     ------------------------------------------------------------------ */
  var PASSOS_VIAGEM = ['tipo', 'destino', 'datas', 'quem', 'estilo', 'estadia', 'pronto'];
  var PASSOS_PASSEIO = ['tipo', 'destino', 'datas', 'quem', 'pronto'];
  function passosDe(r) { return r.tipo === 'passeio' ? PASSOS_PASSEIO : PASSOS_VIAGEM; }
  TELAS.nova = function (tela) {
    var r = estado.rascunho || (estado.rascunho = { passo: 0, tipo: null, destino: null, destinoTexto: '', inicio: '', fim: '', pessoas: estado.pessoas.filter(function (p) { return grupoDe(p) === 'familia'; }).map(function (p) { return p.id; }), preferencias: { ritmo: 'equilibrado', orcamento: 'medio', interesses: [], transporte: 'carro' }, estadias: [], usarPacote: true, ia: false });
    var PASSOS = passosDe(r), i = r.passo, total = PASSOS.length;
    tela.appendChild(h('p', { class: 'passo', texto: (r.tipo ? T(r.tipo === 'passeio' ? 'novoPasseio' : 'novaViagem') + ' · ' : '') + T('passoDe', { i: i + 1, n: total }) }));
    tela.appendChild(h('div', { class: 'progresso', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(total), 'aria-valuenow': String(i + 1) }, h('i', { style: 'width:' + Math.round((i + 1) / total * 100) + '%' })));
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.75rem' });
    tela.appendChild(corpo);
    var erro = h('p', { class: 'conferir', role: 'alert' });
    var voltar = h('button', { class: 'bt leve', type: 'button', disabled: i === 0, onclick: function () { r.passo--; estado.irAoTopo = true; mostrar('nova'); } }, T('voltar'));
    var prox = h('button', { class: 'bt', type: 'button' }, i === total - 1 ? T('criarViagem') : T('proximo'));
    var validar = function () { return true; };
    PASSO[PASSOS[i]](corpo, r, function (f) { validar = f; });
    tela.appendChild(erro);
    tela.appendChild(h('div', { class: 'acoes' }, [voltar, prox]));
    prox.addEventListener('click', function () {
      var msg = validar();
      if (msg !== true) { erro.textContent = msg; return; }
      if (i < total - 1) { r.passo++; estado.irAoTopo = true; mostrar('nova'); return; }
      prox.disabled = true; prox.textContent = T('criando');
      criarViagem(r).then(function () { estado.rascunho = null; Nav.ir('roteiro', { substituir: true }); }).catch(function () { prox.disabled = false; erro.textContent = T('erroSalvar'); });
    });
  };
  var PASSO = {};
  PASSO.tipo = function (c, r, val) {
    c.appendChild(h('h1', { texto: T('pTipo') }));
    var opcao = function (tipo, icone, titulo, texto) {
      return h('button', { class: 'escolha' + (r.tipo === tipo ? ' ativa' : ''), type: 'button', onclick: function () {
        r.tipo = tipo;
        if (tipo === 'passeio') { r.inicio = r.inicio || hojeIso(); r.fim = r.inicio; }
        r.passo = 1; estado.irAoTopo = true; mostrar('nova');
      } }, [h('b', { texto: icone + ' ' + titulo }), h('span', { class: 'pequeno', texto: texto })]);
    };
    c.appendChild(opcao('passeio', '🚶', T('tipoPasseio'), T('tipoPasseioTexto')));
    c.appendChild(opcao('viagem', '🧳', T('tipoViagem'), T('tipoViagemTexto')));
    val(function () { return r.tipo ? true : T('escolhaTipo'); });
  };
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
    if (r.tipo === 'passeio') {
      c.appendChild(h('h1', { texto: T('pQueDia') }));
      var hj = hojeIso(), am = iso(new Date(Date.now() + 86400000));
      var escolher = function (dt) { r.inicio = dt; r.fim = dt; mostrar('nova'); };
      c.appendChild(h('div', { class: 'chips' }, [
        h('button', { class: 'chip', type: 'button', 'aria-pressed': r.inicio === hj ? 'true' : 'false', texto: T('hoje'), onclick: function () { escolher(hj); } }),
        h('button', { class: 'chip', type: 'button', 'aria-pressed': r.inicio === am ? 'true' : 'false', texto: T('amanha'), onclick: function () { escolher(am); } })]));
      var um = h('input', { class: 'campo', type: 'date', id: 'gx-w-ini', value: r.inicio });
      um.addEventListener('change', function () { r.inicio = um.value; r.fim = um.value; });
      c.appendChild(h('label', { class: 'rot', for: 'gx-w-ini', texto: T('ouOutroDia') })); c.appendChild(um);
      val(function () { return r.inicio ? true : T('faltaDatas'); });
      return;
    }
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
    var sugestao = r.tipo === 'passeio' ? T('nomePasseioSugestao', { d: semana(r.inicio) + ' ' + fData(r.inicio, true) }) + (r.destinoTexto ? ' · ' + r.destinoTexto : '') : (r.destinoTexto + ', ' + fData(r.inicio, true).split('/')[1] + ' ' + r.inicio.slice(0, 4));
    var nome = h('input', { class: 'campo', id: 'gx-w-nome', maxlength: '60', value: r.nome || sugestao, placeholder: T('exNomeViagem') });
    nome.addEventListener('input', function () { r.nome = nome.value; });
    r.nome = nome.value;
    c.appendChild(h('label', { class: 'rot', for: 'gx-w-nome', texto: T(r.tipo === 'passeio' ? 'nomePasseio' : 'nomeViagem') })); c.appendChild(nome);
    c.appendChild(h('p', { class: 'dica', texto: T('nomeDica') }));
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
    var v = { nome: (r.nome || r.destinoTexto).trim(), tipo: r.tipo || 'viagem', destino: r.destino, destinoTexto: r.destinoTexto, centro: r.centro || null, inicio: r.inicio, fim: r.fim,
      pessoas: r.pessoas.slice(), preferencias: r.preferencias, estadias: r.estadias.filter(function (e) { return e.nome || e.endereco; }), opcao_ativa: null };
    /* coordenadas: cidade digitada e hotel pelo endereço (1 pedido por vez, regra do OpenStreetMap) */
    var p = Promise.resolve();
    if (!v.centro) p = p.then(function () { return geocodificar(v.destinoTexto).then(function (c) { v.centro = c; }); });
    v.estadias.forEach(function (e) {
      if (e.lat == null && (e.endereco || e.nome)) p = p.then(function () { return geocodificar([e.endereco || e.nome, v.destinoTexto].join(', ')).then(function (c) { if (c) { e.lat = c.lat; e.lng = c.lng; } }); });
    });
    return p.then(function () { return Banco.gravar('viagens', v); }).then(function (nv) {
      return Contexto.definir('viagem', nv.id).then(function () { return carregarViagem(nv.id); }).then(function () {
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
    tela.appendChild(faixaFotos(T('entrarTitulo'), T('entrarTexto')));
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
    var sinc = h('p', { class: 'pequeno' });
    if (window.Nuvem && s) Nuvem.ultima().then(function (u) { sinc.textContent = u ? T('nuvemUltima', { d: fData(u.slice(0, 10)), h: new Date(u).toTimeString().slice(0, 5) }) : T('nuvemNunca'); });
    tela.appendChild(h('div', { class: 'cartao' }, [h('h3', { texto: T('meusDados') }), h('p', { class: 'sub', texto: T('meusDadosTexto') }), sinc,
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
      (window.Nuvem ? Nuvem.apagarTudo().catch(function () {}) : Promise.resolve()).then(function () { return Banco.apagarTudo(); }).then(function () { j.fechar(); location.reload(); });
    });
  }

  /* ---------- Chaves do serviço (só dono/admin da equipe) ----------
     A chave é colada uma vez, vai por HTTPS para o banco e fica CIFRADA no Supabase Vault. Nunca volta inteira:
     a tela só mostra "termina em …4f2a". Salvar ou apagar pede que a pessoa confirme a identidade (login recente).
     As funções do servidor (ia, lugares, google-lugares) leem do cofre; o celular nunca vê a chave. */
  var SERVICOS_CHAVE = [
    { nome: 'GEMINI_API_KEY', icone: '✦', titulo: 'chv_gemini', dica: 'chv_geminiDica', site: 'https://aistudio.google.com/apikey', siteNome: 'Google AI Studio',
      passos: 'chv_geminiPassos', formato: /^\S{20,300}$/, teste: 'gemini' },
    { nome: 'TRIPADVISOR_KEY', icone: '🦉', titulo: 'chv_tripadvisor', dica: 'chv_tripadvisorDica', site: 'https://terra.tripadvisor.com/', siteNome: 'Tripadvisor Terra API',
      passos: 'chv_tripadvisorPassos', formato: /^[0-9A-Za-z_.-]{16,}$/, teste: 'tripadvisor' },
    { nome: 'FOURSQUARE_KEY', icone: '📍', titulo: 'chv_foursquare', dica: 'chv_foursquareDica', site: 'https://foursquare.com/developers', siteNome: 'Foursquare Developers',
      passos: 'chv_foursquarePassos', formato: /^\S{20,}$/, teste: 'foursquare' },
    { nome: 'GOOGLE_PLACES_KEY', icone: 'G', titulo: 'chv_google', dica: 'chv_googleDica', site: 'https://console.cloud.google.com/apis/library/places.googleapis.com', siteNome: 'Google Cloud',
      passos: 'chv_googlePassos', formato: /^\S{20,300}$/, teste: 'google' }
  ];
  function chamarFuncao(nome, op) {
    var cfg = window.GUIAXPERT_CONFIG || {};
    return Conta.token().then(function (tk) {
      if (!tk) throw new Error('sem-sessao');
      var u = String(cfg.SUPABASE_URL).replace(/\/+$/, '') + '/functions/v1/' + nome + (op.query ? '?' + op.query : '');
      return fetch(u, { method: op.corpo ? 'POST' : 'GET', headers: { apikey: cfg.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
        body: op.corpo ? JSON.stringify(op.corpo) : undefined });
    }).then(function (r) { return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) {} return { status: r.status, j: j || {} }; }); });
  }
  /* testa se o serviço aceitou a chave: { ok, msg } */
  function testarChave(sv) {
    var p;
    if (sv.teste === 'gemini') p = chamarFuncao('ia', { corpo: { app: 'guiaxpert', limite: 300, mensagens: [{ papel: 'pessoa', texto: 'Responda apenas: ok' }] } })
      .then(function (r) { return r.status === 200 ? { ok: true } : { ok: false, status: r.status, erro: r.j.erro, motivo: r.j.motivo, detalhe: r.j.detalhe }; });
    else if (sv.teste === 'google') p = chamarFuncao('google-lugares', { query: 'q=Gramado' })
      .then(function (r) { return r.status === 200 ? { ok: true } : { ok: false, status: r.status, erro: r.j.erro, detalhe: r.j.detalhe }; });
    else p = chamarFuncao('lugares', { query: 'q=Gramado&teste=' + sv.teste })
      .then(function (r) { return r.j.ok ? { ok: true } : { ok: false, status: r.j.status || r.status, erro: r.j.motivo || r.j.erro, detalhe: r.j.detalhe }; });
    return p.then(function (x) {
      if (x.ok) return { ok: true, msg: T('chv_testeOk') };
      if (x.erro === 'sem-chave') return { ok: false, semChave: true, msg: T('chv_testeSemChave') };
      if (x.erro === 'cota' || x.erro === 'cota-dia' || x.erro === 'cota-mes') return { ok: true, msg: T('chv_testeCota') };
      if (x.erro === 'ia-tempo' || x.status === 546 || x.status === 504) return { ok: false, msg: T('chv_testeDemorou', { servico: T(sv.titulo) }) };
      if (x.erro === 'ia-429' || x.motivo === 'RESOURCE_EXHAUSTED') return { ok: false, msg: T('chv_testeSemCotaGoogle') };
      /* o código do serviço (ex.: ia-401 → 401) diz mais que o 502 do nosso servidor */
      var cod = (x.erro || '').replace(/\D/g, '') || x.status;
      var extra = x.detalhe ? ' — ' + String(x.detalhe).slice(0, 160) : '';
      return { ok: false, msg: T('chv_testeRecusou', { servico: T(sv.titulo), cod: cod || '?' }) + extra };
    }).catch(function () { return { ok: false, msg: navigator.onLine ? T('erroRede') : T('semInternet') }; });
  }
  /* "confirme que é você": senha ou código por e-mail; resolve quando há um login novo */
  function confirmarIdentidade(retomar) {
    return new Promise(function (ok, falha) {
      var s = Conta.sessao() || {}, email = s.email || '';
      var senha = h('input', { class: 'campo', type: 'password', id: 'gx-ri-senha', autocomplete: 'current-password', placeholder: T('senha') });
      var bSenha = h('button', { class: 'bt', type: 'button', texto: T('confirmar') });
      var bCod = h('button', { class: 'bt leve', type: 'button', texto: '✉ ' + T('chv_receberCodigo') });
      var cod = h('input', { class: 'campo', id: 'gx-ri-cod', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', placeholder: '123456', hidden: true });
      var bCodOk = h('button', { class: 'bt', type: 'button', texto: T('confirmar'), hidden: true });
      var msg = h('p', { class: 'sub', role: 'status' });
      var feito = false;
      /* se a pessoa confirmar pelo link do e-mail, outra janela do app grava uma sessão nova; esta janela percebe e segue sozinha */
      var tokAntes = (Conta.sessao() || {}).access_token;
      function aoMudarSessao(e) {
        if (e.key !== 'solverone.sessao.v1' || !e.newValue || feito) return;
        try { var n = JSON.parse(e.newValue); if (n && n.access_token && n.access_token !== tokAntes) { msg.textContent = T('chv_confirmadoOutraJanela'); pronto(); } } catch (x) {}
      }
      window.addEventListener('storage', aoMudarSessao);
      /* digital conferida no servidor (se este celular já tem uma cadastrada): um toque e pronto */
      var bDig = Digital.temNeste() ? h('button', { class: 'bt', type: 'button', texto: '👆 ' + T('dig_confirmar') }) : null;
      if (bDig) bDig.addEventListener('click', function () {
        bDig.disabled = true; msg.textContent = T('carregando');
        Digital.confirmar(chamarDigital).then(function () { msg.textContent = ''; pronto(); }).catch(function (e) {
          bDig.disabled = false;
          msg.textContent = e.message === 'cancelado' ? '' : e.message === 'sem-digital' ? T('dig_semCadastro') : T('dig_falhou');
          if (e.message === 'sem-digital') bDig.remove();
        });
      });
      var j = janela(T('chv_confirmeTitulo'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
        h('p', { texto: T('chv_confirmeTexto', { email: email }) }),
        bDig, bDig ? h('p', { class: 'pequeno', texto: T('dig_ouSenha') }) : null,
        h('label', { class: 'rot', for: 'gx-ri-senha', texto: T('senha') }), senha, bSenha,
        h('p', { class: 'pequeno', texto: T('chv_ouCodigo') }), bCod, cod, bCodOk, msg]), function () { window.removeEventListener('storage', aoMudarSessao); if (!feito) falha(new Error('cancelado')); });
      function pronto() { feito = true; window.removeEventListener('storage', aoMudarSessao); j.fechar(function () { ok(); }); }
      bSenha.addEventListener('click', function () {
        if (!senha.value) { senha.focus(); return; }
        bSenha.disabled = true; msg.textContent = T('carregando');
        Conta.entrar(email, senha.value).then(pronto).catch(function () { bSenha.disabled = false; msg.textContent = T('chv_senhaErrada'); });
      });
      senha.addEventListener('keydown', function (e) { if (e.key === 'Enter') bSenha.click(); });
      bCod.addEventListener('click', function () {
        bCod.disabled = true;
        /* se a pessoa tocar no link do e-mail, o app abre de novo já confirmado e volta para esta tela */
        if (retomar) { try { localStorage.setItem('guiaxpert.retomar', JSON.stringify(Object.assign({ ate: Date.now() + 15 * 60000 }, retomar))); } catch (e) {} }
        Conta.enviarCodigo(email).then(function () { cod.hidden = false; bCodOk.hidden = false; msg.textContent = T('chv_codigoEnviado', { email: email }); cod.focus(); })
          .catch(function () { bCod.disabled = false; msg.textContent = T('erroRede'); });
      });
      bCodOk.addEventListener('click', function () {
        bCodOk.disabled = true; msg.textContent = T('carregando');
        Conta.confirmarCodigo(email, cod.value).then(pronto).catch(function () { bCodOk.disabled = false; msg.textContent = T('chv_codigoErrado'); });
      });
    });
  }
  /* chama uma função admin; se o banco pedir login recente, confirma a identidade e tenta de novo uma vez */
  function rpcAdmin(nome, args, retomar) {
    return Conta.rpc(nome, args).catch(function (e) {
      if (!/login-recente/.test(e.message)) throw e;
      var tinhaDigital = Digital.temNeste();
      return confirmarIdentidade(retomar).then(function () {
        var r = Conta.rpc(nome, args);
        if (!tinhaDigital) r.then(function () { setTimeout(oferecerDigitalChaves, 1800); }, function () {});
        return r;
      });
    });
  }
  /* fala com a função "digital" do servidor */
  function chamarDigital(acao, extra) {
    return chamarFuncao('digital', { corpo: Object.assign({ acao: acao }, extra || {}) });
  }
  /* cadastra a digital deste celular para as próximas confirmações; se o login não é recente, confirma antes */
  function cadastrarDigitalChaves() {
    return Digital.cadastrar(chamarDigital, T('dig_nomeAparelho')).catch(function (e) {
      if (e.message !== 'login-recente') throw e;
      return confirmarIdentidade().then(function () { return Digital.cadastrar(chamarDigital, T('dig_nomeAparelho')); });
    }).then(function () { avisar(T('dig_ligada')); return true; }).catch(function (e) {
      if (e.message !== 'cancelado') avisar(e.message === 'ja-existe' ? T('dig_jaExiste') : T('dig_falhou'));
      return false;
    });
  }
  /* convite, uma vez por aparelho, logo depois de confirmar com senha ou código */
  function oferecerDigitalChaves() {
    if (Digital.temNeste()) return;
    try { if (localStorage.getItem('guiaxpert.digital-oferta')) return; } catch (e) { return; }
    Digital.suportada().then(function (ok) {
      if (!ok) return;
      try { localStorage.setItem('guiaxpert.digital-oferta', '1'); } catch (e) {}
      var sim = h('button', { class: 'bt', type: 'button', texto: '👆 ' + T('dig_ligar') });
      var nao = h('button', { class: 'bt leve', type: 'button', texto: T('agoraNao') });
      var j = janela(T('dig_titulo'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
        h('p', { class: 'sub', texto: T('dig_texto') }), h('div', { class: 'acoes' }, [nao, sim])]));
      nao.addEventListener('click', function () { j.fechar(); });
      sim.addEventListener('click', function () { sim.disabled = true; cadastrarDigitalChaves().then(function (ok2) { sim.disabled = false; if (ok2) j.fechar(); }); });
    });
  }
  function cartaoChaves(caixa) {
    Conta.rpc('sou_admin_equipe', {}).then(function (sim) {
      if (sim !== true) return;
      var cartao = h('div', { class: 'cartao chaves' }, [h('h3', { texto: '🔐 ' + T('chv_titulo') }), h('p', { class: 'sub', texto: T('chv_texto') })]);
      var lista = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.6rem' });
      cartao.appendChild(lista);
      cartao.appendChild(h('button', { class: 'lk', type: 'button', style: 'align-self:flex-start', texto: T('chv_historico'), onclick: janelaHistoricoChaves }));
      var linhaDig = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.4rem;border-top:1px solid var(--linha);padding-top:.7rem;margin-top:.3rem' });
      cartao.appendChild(linhaDig);
      Digital.suportada().then(function (ok) {
        if (!ok) return;
        linhaDig.appendChild(h('strong', { texto: '👆 ' + T('dig_titulo') }));
        if (Digital.temNeste()) {
          linhaDig.appendChild(h('p', { class: 'sub', texto: T('dig_ligadaTexto') }));
          linhaDig.appendChild(h('button', { class: 'lk', type: 'button', style: 'align-self:flex-start', texto: T('dig_desligar'), onclick: function () {
            Digital.esquecer(); avisar(T('dig_desligada')); linhaDig.textContent = ''; mostrar('config');
          } }));
        } else {
          linhaDig.appendChild(h('p', { class: 'sub', texto: T('dig_texto') }));
          linhaDig.appendChild(h('button', { class: 'bt sec', type: 'button', texto: '👆 ' + T('dig_ligar'), onclick: function (ev) {
            var b = ev.currentTarget; b.disabled = true;
            cadastrarDigitalChaves().then(function (ok2) { b.disabled = false; if (ok2) mostrar('config'); });
          } }));
        }
      });
      caixa.appendChild(cartao);
      desenhar();
      function desenhar() {
        lista.textContent = ''; lista.appendChild(h('p', { class: 'sub', texto: T('carregando') }));
        Conta.rpc('admin_status_chaves', {}).then(function (rows) {
          lista.textContent = '';
          var porNome = {}; (rows || []).forEach(function (r) { porNome[r.nome] = r; });
          SERVICOS_CHAVE.forEach(function (sv) {
            var st = porNome[sv.nome] || {};
            var estadoTxt = st.cadastrada ? '✓ ' + T('chv_ligada', { final: st.final, data: fData(String(st.atualizado_em).slice(0, 10), true) }) : T('chv_desligada');
            var linha = h('div', { class: 'chave-linha' + (st.cadastrada ? ' ligada' : '') }, [
              h('div', { class: 'chave-cab' }, [h('span', { class: 'ic-grande', 'aria-hidden': 'true', texto: sv.icone }),
                h('div', {}, [h('b', { texto: T(sv.titulo) }), h('small', { class: 'sub', style: 'display:block', texto: T(sv.dica) }), h('small', { class: 'chave-estado', texto: estadoTxt })])]),
              h('div', { class: 'linha' }, [
                h('button', { class: 'bt ' + (st.cadastrada ? 'leve' : 'sec'), type: 'button', texto: st.cadastrada ? T('chv_trocar') : T('chv_cadastrar'), onclick: function () { janelaCadastrarChave(sv, desenhar); } }),
                st.cadastrada ? h('button', { class: 'bt leve', type: 'button', texto: T('chv_testar'), onclick: function (ev) {
                  var b = ev.currentTarget; b.disabled = true; b.textContent = T('carregando');
                  testarChave(sv).then(function (x) { b.disabled = false; b.textContent = T('chv_testar'); avisar(x.msg); });
                } }) : null,
                st.cadastrada ? h('button', { class: 'bt perigo', type: 'button', texto: T('apagar'), onclick: function () {
                  if (!confirm(T('chv_apagarConfirma', { servico: T(sv.titulo) }))) return;
                  rpcAdmin('admin_apagar_chave', { p_nome: sv.nome }).then(function () { avisar(T('chv_apagada')); desenhar(); }).catch(function (e) { if (e.message !== 'cancelado') avisar(T('erroRede')); });
                } }) : null])]);
            lista.appendChild(linha);
          });
        }).catch(function () { lista.textContent = ''; lista.appendChild(h('p', { class: 'alerta', texto: T('erroRede') })); });
      }
    }).catch(function () { /* sem login ou sem a função: não mostra nada */ });
  }
  function janelaCadastrarChave(sv, depois) {
    var campo = h('input', { class: 'campo', type: 'password', id: 'gx-chv', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: T('chv_coleAqui') });
    var ver = h('button', { class: 'bt leve', type: 'button', texto: '👁', 'aria-label': T('mostrarSenha'), 'aria-pressed': 'false' });
    var colar = navigator.clipboard && navigator.clipboard.readText ? h('button', { class: 'bt sec', type: 'button', texto: '📋 ' + T('chv_colar') }) : null;
    var salvar = h('button', { class: 'bt cheio', type: 'button', texto: '🔐 ' + T('chv_salvarCifrada') });
    var msg = h('p', { class: 'sub', role: 'status' });
    var passos = T(sv.passos).split('|').map(function (p) { return h('li', { texto: p }); });
    var j = janela(T(sv.titulo), h('div', { class: 'linha chave-cadastro', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { class: 'grande', texto: '1. ' + T('chv_passo1') }),
      h('ol', { class: 'passos' }, passos),
      h('a', { class: 'bt sec', href: sv.site, target: '_blank', rel: 'noopener', texto: '↗ ' + T('chv_abrirSite', { site: sv.siteNome }) }),
      h('p', { class: 'grande', texto: '2. ' + T('chv_passo2') }),
      h('div', { class: 'linha', style: 'flex-wrap:nowrap' }, [campo, ver]), colar,
      h('p', { class: 'grande', texto: '3. ' + T('chv_passo3') }),
      salvar, msg,
      h('p', { class: 'pequeno', texto: '🔒 ' + T('chv_seguranca') })]), function () { campo.value = ''; });
    ver.addEventListener('click', function () { var m = campo.type === 'password'; campo.type = m ? 'text' : 'password'; ver.setAttribute('aria-pressed', m ? 'true' : 'false'); });
    if (colar) colar.addEventListener('click', function () { navigator.clipboard.readText().then(function (t) { campo.value = String(t || '').trim(); msg.textContent = campo.value ? T('chv_colado', { final: campo.value.slice(-4) }) : ''; }).catch(function () { campo.focus(); }); });
    salvar.addEventListener('click', function () {
      var v = campo.value.trim();
      if (!v) { campo.focus(); msg.textContent = T('chv_vazia'); return; }
      if (!sv.formato.test(v)) { msg.textContent = T('chv_formato', { servico: T(sv.titulo) }); return; }
      salvar.disabled = true; msg.textContent = T('chv_salvando');
      rpcAdmin('admin_salvar_chave', { p_nome: sv.nome, p_valor: v }, { acao: 'chave', nome: sv.nome }).then(function () {
        campo.value = ''; v = '';
        try { if (localStorage.getItem('guiaxpert.retomar')) localStorage.setItem('guiaxpert.retomar', JSON.stringify({ acao: 'salva', nome: sv.nome, ate: Date.now() + 5 * 60000 })); } catch (e) {}
        try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText('').catch(function () {}); } catch (e) {}
        msg.textContent = T('chv_salvaTestando');
        /* as funções guardam a chave por até 1 minuto: testa já e, se precisar, de novo */
        var tentativas = [0, 20000, 65000], i = 0;
        (function tentar() {
          setTimeout(function () {
            testarChave(sv).then(function (x) {
              if (!x.ok && i < tentativas.length - 1) { i++; msg.textContent = T('chv_aguardando'); tentar(); return; }
              msg.textContent = x.msg; salvar.disabled = false; salvar.textContent = '✓ ' + T('pronto');
              salvar.onclick = function () { j.fechar(depois); };
              if (x.ok) { avisar(x.msg); setTimeout(function () { j.fechar(depois); }, 1800); }
            });
          }, tentativas[i]);
        })();
      }).catch(function (e) {
        salvar.disabled = false;
        msg.textContent = e.message === 'cancelado' ? T('chv_cancelado') : (/formato/i.test(e.message) ? T('chv_formato', { servico: T(sv.titulo) }) : T('erroRede'));
      });
    });
  }
  /* volta do link do e-mail de confirmação: reabre a tela onde a pessoa estava (a chave nunca fica guardada; ela cola de novo) */
  function retomarPendente() {
    function ler() { try { return JSON.parse(localStorage.getItem('guiaxpert.retomar') || 'null'); } catch (e) { return null; } }
    var r0 = ler();
    if (!r0 || !r0.ate || r0.ate < Date.now()) return;
    /* dá tempo da janela antiga (onde a chave já estava colada) salvar sozinha */
    setTimeout(function () {
      var r = ler(); try { localStorage.removeItem('guiaxpert.retomar'); } catch (e) {}
      if (!r || !r.ate || r.ate < Date.now()) return;
      if (r.acao === 'salva') { Nav.ir('config'); avisar(T('chv_salvaOutraJanela')); return; }
      retomarChave(r);
    }, 3000);
  }
  function retomarChave(r) {
    if (r.acao === 'chave') {
      var sv = SERVICOS_CHAVE.filter(function (x) { return x.nome === r.nome; })[0];
      if (!sv) return;
      Nav.ir('config');
      setTimeout(function () { avisar(T('chv_retomando')); janelaCadastrarChave(sv, function () { mostrar('config'); }); }, 700);
    }
  }
  function janelaHistoricoChaves() {
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.4rem' }, [h('p', { class: 'sub', texto: T('carregando') })]);
    janela(T('chv_historico'), corpo);
    Conta.rpc('admin_historico_chaves', {}).then(function (rows) {
      corpo.textContent = '';
      if (!rows || !rows.length) { corpo.appendChild(h('p', { class: 'sub', texto: T('chv_semHistorico') })); return; }
      rows.forEach(function (r) {
        var sv = SERVICOS_CHAVE.filter(function (x) { return x.nome === r.nome; })[0];
        corpo.appendChild(h('p', { class: 'pequeno', texto: fData(String(r.quando).slice(0, 10), true) + ' ' + String(r.quando).slice(11, 16) + ' · ' +
          (r.acao === 'chave-salva' ? T('chv_hSalva', { final: r.final || '' }) : T('chv_hApagada')) + ' · ' + (sv ? T(sv.titulo) : r.nome) + ' · ' + (r.quem || '') }));
      });
    }).catch(function () { corpo.textContent = ''; corpo.appendChild(h('p', { class: 'alerta', texto: T('erroRede') })); });
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
      h('button', { class: 'bt sec', type: 'button', onclick: function () { Nav.ir('ia'); } }, '✨ ' + T('oQueAIAFaz')),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { DGO.ia.guia(null, 'texto'); } }, T('iaConfigurar')),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { DGO.abrirConfiguracoes && DGO.abrirConfiguracoes(); } }, T('maisAjustes'))]));
    var caixaChaves = h('div', {}); tela.appendChild(caixaChaves); if (window.Conta && Conta.sessao()) cartaoChaves(caixaChaves);
    if (estado.viagem) tela.appendChild(cartaoOffline(estado.viagem));
    else if (window.Offline) {
      var cm = h('div', { class: 'cartao' }, [h('h3', { texto: T('mapasGuardados') })]); tela.appendChild(cm);
      Offline.guardados().then(function (ls) {
        if (!ls.length) { cm.appendChild(h('p', { class: 'sub', texto: T('semMapasGuardados') })); return; }
        ls.forEach(function (m) {
          var mb = (m.bytes / 1048576).toFixed(1).replace('.', ',');
          cm.appendChild(h('div', { class: 'linha entre' }, [h('span', { texto: (m.nome && (m.nome[idioma()] || m.nome.pt)) || m.id }),
            h('button', { class: 'bt leve', type: 'button', texto: T('apagarMapa', { mb: mb }), onclick: function () { Offline.apagar(m.id).then(function () { avisar(T('mapaApagado')); mostrar('config'); }); } })]));
        });
      });
    }
    tela.appendChild(h('div', { class: 'cartao' }, [h('h3', { texto: T('cofreOutroCelular') }), h('p', { class: 'sub', texto: T('cofreOutroCelularTexto') }),
      h('button', { class: 'bt leve', type: 'button', texto: '▦ ' + T('mostrarQR'), onclick: function () {
        if (Cofre.aberto()) { mostrarQR(); return; }
        var cx = h('div', {}); var j = janela(T('cofreFechado'), cx); pedirCofre(cx, function () { j.fechar(mostrarQR); });
      } })]));
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
      cBio.appendChild(opcaoTrava());
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
      h('p', { class: 'pequeno', texto: T('semInternetComo') }),
      jaInstalado() ? h('p', { class: 'pequeno', texto: '✓ ' + T('jaInstalado') }) : h('button', { class: 'bt sec', type: 'button', texto: '⬇ ' + T('instalarNaTela'), onclick: function () { instalarApp(); } })]));
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
      return recarregarContexto().then(function () {
        mostrar(estado.rota === 'entrar' ? (emViagem() ? 'inicio' : 'explorar') : estado.rota);
        oferecerBio();
        setTimeout(oferecerInstalar, 2500);
        aceitarConvitePendente().then(function (aceito) { if (!aceito) sincronizarNuvem(); });
        retomarPendente();
        var compartilhado = window.Importar && Importar.doEndereco();
        if (compartilhado) setTimeout(function () { if (estado.viagem) { Nav.ir('reservas'); setTimeout(function () { janelaImportar(compartilhado); }, 200); } else avisar(T('semViagemTexto')); }, 400);
      });
    });
  }

  /* nuvem: se chegou algo novo da conta, recarrega a viagem e a tela */
  function sincronizarNuvem() {
    if (!window.Nuvem) return Promise.resolve();
    return Nuvem.sincronizar().then(function (r) {
      if (r && r.baixados && Contexto.automatico()) return recarregarContexto().then(function () {
        /* chegou uma viagem e a pessoa ainda não tinha escolhido contexto: entra nela */
        if (emViagem() && (estado.rota === 'explorar' || estado.rota === 'salvos')) mostrar('inicio');
      });
    });
  }
  /* ---- instalar na tela inicial (PWA) ---- */
  var pedidoInstalar = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); pedidoInstalar = e; });
  function jaInstalado() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function ehIphone() { return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream; }
  function instalarApp() {
    if (pedidoInstalar) {
      var ev = pedidoInstalar; pedidoInstalar = null;
      ev.prompt();
      return ev.userChoice.then(function (r) { if (r && r.outcome === 'accepted') { avisar(T('instalado')); try { localStorage.setItem('guiaxpert.instalar', 'nunca'); } catch (e) {} } });
    }
    /* sem pedido do navegador (iPhone, ou Chrome que ainda não liberou): mostra o caminho */
    var j = janela(T('instalarTitulo'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { texto: T(ehIphone() ? 'instalarIphone' : 'instalarAndroid') }),
      h('button', { class: 'bt', type: 'button', texto: T('entendi'), onclick: function () { j.fechar(); } })]));
    return Promise.resolve();
  }
  /* convite depois do login: Instalar / Agora não (volta em 3 dias) / Não mostrar mais */
  function oferecerInstalar() {
    if (jaInstalado() || !(estado.acesso && estado.acesso.liberado)) return;
    var pref = null; try { pref = localStorage.getItem('guiaxpert.instalar'); } catch (e) { return; }
    if (pref === 'nunca') return;
    if (pref && /^\d+$/.test(pref) && Date.now() < +pref) return;
    if (d.querySelector('.janela')) { setTimeout(oferecerInstalar, 4000); return; }   /* espera outra janela (digital, convite) fechar */
    var depois = function (v) { try { localStorage.setItem('guiaxpert.instalar', v); } catch (e) {} };
    var sim = h('button', { class: 'bt', type: 'button', texto: '⬇ ' + T('instalar') });
    var nao = h('button', { class: 'bt leve', type: 'button', texto: T('agoraNao') });
    var nunca = h('button', { class: 'lk', type: 'button', texto: T('naoMostrarMais') });
    var j = janela(T('instalarTitulo'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { class: 'sub', texto: T('instalarTexto') }), h('div', { class: 'acoes' }, [nao, sim]), nunca]));
    sim.addEventListener('click', function () { j.fechar(function () { instalarApp(); }); });
    nao.addEventListener('click', function () { depois(String(Date.now() + 3 * 86400000)); j.fechar(); });
    nunca.addEventListener('click', function () { depois('nunca'); j.fechar(); });
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
  /* "Pedir a digital ao abrir o GuiaXpert" + depois de quanto tempo parado */
  function opcaoTrava() {
    var marca = h('input', { type: 'checkbox', id: 'gx-trava' }); marca.checked = Trava.ligada();
    var sel = h('select', { class: 'campo', id: 'gx-trava-min', 'aria-label': T('trv_depois') });
    [1, 5, 15, 60].forEach(function (m) { var o = h('option', { value: String(m), texto: T(m === 60 ? 'trv_1h' : 'trv_min', { n: m }) }); if (m === Trava.minutos()) o.selected = true; sel.appendChild(o); });
    var linhaMin = h('div', { class: 'linha', style: 'gap:.5rem;align-items:center' }, [h('label', { for: 'gx-trava-min', class: 'pequeno', texto: T('trv_depois') }), sel]);
    linhaMin.hidden = !marca.checked;
    marca.addEventListener('change', function () {
      if (marca.checked) { Trava.ligar(+sel.value); avisar(T('trv_ligada', { n: sel.options[sel.selectedIndex].text })); } else { Trava.desligar(); avisar(T('trv_desligada')); }
      linhaMin.hidden = !marca.checked;
    });
    sel.addEventListener('change', function () { if (marca.checked) Trava.ligar(+sel.value); });
    return h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.4rem;margin:.4rem 0' }, [
      h('label', { class: 'linha', for: 'gx-trava', style: 'gap:.6rem;align-items:center;font-weight:700' }, [marca, h('span', { texto: T('trv_opcao') })]),
      h('p', { class: 'pequeno', texto: T('trv_explica') }), linhaMin]);
  }
  function desligarBio() {
    Trava.desligar();
    Bio.desligar(); Conta.esquecerVolta();
    return Cofre.desligarBio().then(function () { avisar(T('bioDesligada')); });
  }

  /* ------------------------------------------------------------------
     Trava ao abrir (opcional, por aparelho): depois de alguns minutos sem
     usar, o GuiaXpert pede a digital ou o rosto antes de mostrar qualquer
     coisa. Usa a mesma chave de acesso de "Digital ou rosto" (WebAuthn,
     leitura de verdade no aparelho). Alternativa: senha ou código por e-mail.
     As reservas continuam com o cofre próprio (fecha sozinho em 5 min).
     ------------------------------------------------------------------ */
  var Trava = (function () {
    var CFG = 'guiaxpert.trava', USO = 'guiaxpert.trava-uso', travada = false, relogio = null;
    function cfg() { try { return JSON.parse(localStorage.getItem(CFG) || 'null'); } catch (e) { return null; } }
    function marcarUso() { if (travada) return; try { localStorage.setItem(USO, String(Date.now())); } catch (e) {} }
    function ultimoUso() {
      var u = 0; try { u = +localStorage.getItem(USO) || 0; } catch (e) {}
      var s = Conta.sessao(), desde = s && s.desde ? Date.parse(s.desde) : 0;   /* acabou de entrar com a senha = acabou de usar */
      return Math.max(u, desde || 0);
    }
    function ligada() { var c = cfg(); return !!(c && c.ativa && Bio.ligada()); }
    function minutos() { var c = cfg(); return c && c.minutos > 0 ? c.minutos : 5; }
    function precisa() { return ligada() && !!Conta.sessao() && Date.now() - ultimoUso() > minutos() * 60000; }
    function destravar() {
      travada = false; marcarUso();
      var t = $('trava'); if (t) t.remove();
      d.body.classList.remove('travado');
      [].forEach.call(d.querySelectorAll('.janela-fundo.na-trava'), function (j) { j.classList.remove('na-trava'); });
    }
    function travar() {
      if (travada) return; travada = true;
      [].forEach.call(d.querySelectorAll('.janela-fundo'), function (j) { j.classList.add('na-trava'); });
      d.body.classList.add('travado');
      var msg = h('p', { class: 'sub', role: 'status' });
      var bDig = h('button', { class: 'bt', type: 'button', texto: '👆 ' + T('trv_abrir') });
      var bSenha = h('button', { class: 'lk', type: 'button', texto: T('trv_senha') });
      var caixa = h('div', { id: 'trava', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'trava-titulo' }, [
        h('img', { src: 'icone-192.png', alt: '', width: '72', height: '72' }),
        h('h2', { id: 'trava-titulo', texto: T('trv_titulo') }), h('p', { class: 'sub', texto: T('trv_texto') }), bDig, msg, bSenha]);
      d.body.appendChild(caixa);
      bDig.addEventListener('click', function () {
        bDig.disabled = true; msg.textContent = '';
        Bio.chaves().then(destravar).catch(function (e) {
          bDig.disabled = false;
          msg.textContent = e && e.message === 'cancelado' ? '' : T('trv_falhou');
        });
      });
      bSenha.addEventListener('click', function () { confirmarIdentidade().then(destravar).catch(function () {}); });
      setTimeout(function () { bDig.focus(); }, 30);
    }
    function conferir() { if (!travada && precisa()) travar(); }
    return {
      ligada: ligada, minutos: minutos, travada: function () { return travada; }, marcarUso: marcarUso,
      ligar: function (min) { try { localStorage.setItem(CFG, JSON.stringify({ ativa: true, minutos: min || 5 })); } catch (e) {} marcarUso(); },
      desligar: function () { try { localStorage.removeItem(CFG); } catch (e) {} if (travada) destravar(); },
      iniciar: function () {
        conferir();
        /* enquanto a tela está na frente, conta como uso; ao sair, guarda a hora; ao voltar, confere o prazo */
        clearInterval(relogio); relogio = setInterval(function () { if (!d.hidden) marcarUso(); }, 30000);
        d.addEventListener('visibilitychange', function () { if (d.hidden) marcarUso(); else conferir(); });
        window.addEventListener('pageshow', conferir);
        ['pointerdown', 'keydown'].forEach(function (ev) { d.addEventListener(ev, function () { if (!travada && Date.now() - ultimoUso() > 20000) marcarUso(); }, { passive: true }); });
      }
    };
  })();

  function iniciar() {
    /* guarda o endereço como chegou: o link do e-mail traz o login no #access_token, e a navegação abaixo troca o # */
    var hashChegada = location.hash || '';
    try { estado.idioma = localStorage.getItem('dgo:guiaxpert:idioma') || ((navigator.language || 'pt').indexOf('pt') === 0 ? 'pt' : 'en'); } catch (e) {}
    try { aplicarTema(localStorage.getItem('dgo:guiaxpert:tema') || 'auto'); } catch (e) {}
    traduzirMoldura();
    lerConvite();
    var rota = Nav.iniciar();
    estado.rota = rota;
    $('bt-menu').addEventListener('click', abrirGaveta);
    $('fundo-gaveta').addEventListener('click', function () { Nav.fecharCamada(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('gaveta').hidden) Nav.fecharCamada(); });
    $('marca').addEventListener('click', function () { Nav.ir(emViagem() ? 'inicio' : 'explorar'); });
    $('marca').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Nav.ir(emViagem() ? 'inicio' : 'explorar'); } });
    $('chip').addEventListener('click', janelaContexto);
    $('bt-inicio').addEventListener('click', function () { Nav.ir(emViagem() ? 'inicio' : 'explorar'); });
    $('bt-config').addEventListener('click', function () { Nav.ir('config'); });
    $('bt-conta').addEventListener('click', function () { Nav.ir(estado.acesso && estado.acesso.liberado ? 'conta' : 'entrar'); });
    $('bt-busca').addEventListener('click', abrirBusca);
    $('bt-idioma').addEventListener('click', function () { trocarIdioma(idioma() === 'en' ? 'pt' : 'en'); });
    d.addEventListener('dgo:idioma', function (e) { if (e.detail && e.detail.idioma) { estado.idioma = e.detail.idioma; traduzirMoldura(); mostrar(estado.rota); } });
    /* chegou algo da conta (ex.: a família mudou o roteiro): recarrega sem a pessoa fazer nada */
    d.addEventListener('gx:nuvem', function () {
      if (!estado.acesso || !estado.acesso.liberado || d.querySelector('.janela')) return;   /* não atrapalha quem está digitando numa janela */
      recarregarContexto().then(function () { if (estado.rota !== 'nova') mostrar(estado.rota); });
    });
    /* papel na viagem mudou (dono promoveu/tirou): redesenha */
    d.addEventListener('gx:papeis', function (e) {
      if (!estado.viagem) return;
      var p = (e.detail || {})[estado.viagem.id] || 'dono';
      if (p !== estado.papel) { estado.papel = p; mostrar(estado.rota); }
    });
    d.addEventListener('gx:cofre', function () { cacheRestr = []; if (estado.rota === 'reservas') mostrar('reservas'); });
    window.addEventListener('online', function () { if (!estado.acesso || !estado.acesso.liberado || estado.acesso.offline) iniciarAcesso(); });
    Trava.iniciar();
    estado.pronto = true;
    var ab = $('abertura'); if (ab) { ab.classList.add('sai'); setTimeout(function () { ab.remove(); }, 600); }
    mostrar('entrar');
    Conta.lerVolta(hashChegada.indexOf('access_token=') > -1 ? hashChegada : '').then(function (volta) {
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
  /* ajudantes para os módulos de tela (mapa.js, explorar.js): uma porta só */
  window.GX = { h: h, T: T, idioma: idioma, estado: estado, Nav: Nav, janela: janela, mostrar: mostrar, avisar: avisar, fData: fData, semana: semana, hojeIso: hojeIso,
    normalizar: normalizar, ICONES: ICONES, placa: placa, nomeSub: nomeSub, cartaoLugar: cartaoLugar, pegarPosicao: pegarPosicao, restricoesDoGrupo: restricoesDoGrupo,
    somaGostos: function () { return somaGostos; }, recarregarContexto: recarregarContexto, recarregar: recarregar, lugarPorId: lugarPorId, todosLugares: todosLugares, acharJuntos: janelaAcharJuntos };
})();
/* erro em promessa sem tratamento aparece no console (ajuda o suporte), sem derrubar a tela */
window.addEventListener('unhandledrejection', function (e) { console.error('GuiaXpert: promessa sem tratamento', e.reason && (e.reason.message || e.reason)); });
