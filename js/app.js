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
  var VERSAO_APP = '1.5.50';

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
  function avisar(msg, botao, acao, ms) {
    var t = $('gx-toast');
    if (!t) { t = h('div', { id: 'gx-toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); d.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    if (botao) t.appendChild(h('button', { class: 'toast-bt', type: 'button', texto: botao, onclick: function () { t.hidden = true; acao(); } }));
    clearTimeout(relogioAviso); relogioAviso = setTimeout(function () { t.hidden = true; }, ms || 3500);
  }
  /* hora sempre em 24h (o campo "time" do navegador às vezes mostra AM/PM): "930", "9h30", "21h" → "09:30", "21:00" */
  function normHora(s) {
    s = String(s || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return '';
    var m = s.match(/^(\d{1,2})(?:[:h.]?(\d{2})?)?h?$/) || s.match(/^(\d{1,2})(\d{2})$/);
    if (!m) return null;
    var hh = +m[1], mm = m[2] != null ? +m[2] : 0;
    if (hh > 23 || mm > 59) return null;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function campoHora(id, valor) {
    var c = h('input', { class: 'campo hora24', type: 'text', id: id, inputmode: 'numeric', maxlength: '5', placeholder: '09:30', autocomplete: 'off', value: valor || '' });
    c.addEventListener('blur', function () { var n = normHora(c.value); if (n != null) c.value = n; });
    return c;
  }
  /* hora do campo: '' (sem hora), 'HH:MM' ou null (inválida: avisa e foca) */
  function lerHora(c) { var n = normHora(c.value); if (n == null) { avisar(T('horaInvalida')); c.focus(); } else c.value = n; return n; }
  /* texto com endereços da internet viram links que abrem fora do app */
  var RE_LINK = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;
  function comLinks(t) {
    var out = [], ult = 0; t = String(t || ''); RE_LINK.lastIndex = 0; var m;
    while ((m = RE_LINK.exec(t))) {
      if (m.index > ult) out.push(t.slice(ult, m.index));
      var u = m[1], curto = u.replace(/^https?:\/\/(www\.)?/, '');
      out.push(h('a', { href: u, target: '_blank', rel: 'noopener', texto: curto.length > 40 ? curto.slice(0, 38) + '…' : curto }));
      ult = m.index + u.length;
    }
    if (ult < t.length) out.push(t.slice(ult));
    return out;
  }
  function escLinks(t) {
    t = String(t || ''); RE_LINK.lastIndex = 0;
    var out = '', ult = 0, m;
    while ((m = RE_LINK.exec(t))) { out += esc(t.slice(ult, m.index)) + '<a href="' + esc(m[1]) + '">' + esc(m[1].replace(/^https?:\/\/(www\.)?/, '')) + '</a>'; ult = m.index + m[1].length; }
    return out + esc(t.slice(ult));
  }
  /* ---------- atualização: o app se atualiza sozinho ao abrir com internet; aqui só avisa e mostra o que mudou ---------- */
  function compararVersao(a, b) {
    a = String(a).split('.').map(Number); b = String(b).split('.').map(Number);
    for (var i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
    return 0;
  }
  function verNovidades(desde) {
    fetch('versoes.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
      var vs = (j.versoes || []).filter(function (x) { return !desde || compararVersao(x.versao, desde) > 0; }).slice(0, desde ? 12 : 6);
      janela(T('novidades'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.6rem' }, [h('p', { class: 'sub', texto: T('novidadesTexto') })].concat(vs.map(function (x) {
        return h('div', { class: 'cartao', style: 'margin:0' }, [h('b', { texto: x.versao + ' · ' + fData(x.data) }),
          h('ul', { class: 'novidades' }, ((x.itens || {})[idioma()] || (x.itens || {}).pt || []).map(function (t) { return h('li', { texto: t }); }))]);
      }))));
    }).catch(function () { avisar(T('semInternet')); });
  }
  /* o celular está com a versão mais nova? compara com versoes.json do servidor; "Atualizar agora" limpa a cópia guardada e recarrega */
  function atualizarAgora() {
    if (!navigator.onLine) { avisar(T('semInternet')); return; }
    avisar(T('atualizando'));
    var p1 = window.caches ? caches.keys().then(function (ns) { return Promise.all(ns.filter(function (n) { return /^dgo-guiaxpert-/.test(n); }).map(function (n) { return caches.delete(n); })); }) : Promise.resolve();
    var p2 = navigator.serviceWorker && navigator.serviceWorker.getRegistrations ? navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.update().catch(function () {}); })); }) : Promise.resolve();
    Promise.all([p1, p2]).catch(function () {}).then(function () { location.reload(); });
  }
  function procurarAtualizacao(manual) {
    if (!navigator.onLine) { if (manual) avisar(T('semInternet')); return Promise.resolve(false); }
    return fetch('versoes.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var ultima = j && j.versoes && j.versoes[0] && j.versoes[0].versao;
      if (ultima && compararVersao(ultima, VERSAO_APP) > 0) {
        if (manual) atualizarAgora();
        else avisar(T('novaVersao', { v: ultima }), T('atualizarAgora'), atualizarAgora, 15000);
        return true;
      }
      if (manual) avisar(T('versaoEmDia', { v: VERSAO_APP }));
      return false;
    }).catch(function () { if (manual) avisar(T('erroRede')); return false; });
  }
  function rodapeVersao() {
    return comMarca(h('p', { class: 'pequeno', style: 'text-align:center;margin-top:1rem' }, [
      'GuiaXpert ' + VERSAO_APP + ' · ',
      h('button', { class: 'lk', type: 'button', texto: '🔄 ' + T('procurarAtualizacao'), onclick: function () { procurarAtualizacao(true); } })]));
  }
  function avisarAtualizacao() {
    var vista = null;
    try { vista = localStorage.getItem('guiaxpert.versaoVista'); localStorage.setItem('guiaxpert.versaoVista', VERSAO_APP); } catch (e) {}
    if (vista && compararVersao(VERSAO_APP, vista) > 0) avisar(T('atualizadoPara', { v: VERSAO_APP }), T('verNovidades'), function () { verNovidades(vista); }, 9000);
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
  /* busca que perdoa erro de digitação: sem acento, letra dobrada vale uma (nonna = nona), y = i (florybal = floribal),
     e uma ou duas letras trocadas em palavras maiores (pastaciuta acha Pastasciutta). Devolve uma nota: 0 = não serve. */
  function chaveBusca(t) { return normalizar(t).replace(/[^a-z0-9]+/g, ' ').replace(/y/g, 'i').replace(/ph/g, 'f').replace(/([a-z])\1+/g, '$1').replace(/\s+/g, ' ').trim(); }
  function distLetras(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var ant = [], i, j; for (j = 0; j <= b.length; j++) ant[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i], menor = i;
      for (j = 1; j <= b.length; j++) { cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < menor) menor = cur[j]; }
      if (menor > max) return max + 1; ant = cur;
    }
    return ant[b.length];
  }
  var PALAVRAS_VAZIAS = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1, o: 1, a: 1, os: 1, as: 1, com: 1, no: 1, na: 1, em: 1, para: 1, pra: 1, the: 1, of: 1, with: 1 };
  function palavraBate(t, palavras) {
    var k = t.length >= 7 ? 2 : t.length >= 4 ? 1 : 0, melhor = 0;
    palavras.forEach(function (w) {
      if (w.indexOf(t) === 0) melhor = Math.max(melhor, 3);
      else if (k && (distLetras(t, w, k) <= k || (w.length > t.length && distLetras(t, w.slice(0, t.length), k) <= k))) melhor = Math.max(melhor, 2);
    });
    return melhor;
  }
  function notaBusca(l, q) {
    var qq = chaveBusca(q); if (!qq) return 1;
    var nome = chaveBusca([l.nome].concat(l.apelidos || []).join(' ')), resto = chaveBusca([l.descricao, l.endereco, l.subcategoria, l.cidade].join(' '));
    if (nome.indexOf(qq) > -1) return 20 + (nome.indexOf(qq) === 0 ? 5 : 0);
    var ts = qq.split(' '); if (ts.length > 1) ts = ts.filter(function (t) { return !PALAVRAS_VAZIAS[t]; });
    var pn = nome.split(' '), pr = resto.split(' '), soma = 0;
    for (var i = 0; i < ts.length; i++) {
      var n = palavraBate(ts[i], pn);
      if (n) { soma += n * 2; continue; }
      if (resto.indexOf(ts[i]) > -1 && ts[i].length >= 3) { soma += 1; continue; }
      if (ts[i].length >= 5 && palavraBate(ts[i], pr) >= 2) { soma += .5; continue; }
      return 0;
    }
    return soma;
  }

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
  /* ícones de reserva: traço fino, mesma família dos ícones da barra (desenhos do Lucide, licença ISC; ver CREDITOS.md) */
  var ICONES_RES = {
    voo: '<svg viewBox="0 0 24 24"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
    hotel: '<svg viewBox="0 0 24 24"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>',
    carro: '<svg viewBox="0 0 24 24"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
    ingresso: '<svg viewBox="0 0 24 24"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 11v2M13 17v2"/></svg>',
    transfer: '<svg viewBox="0 0 24 24"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8"/><path d="M7 14h.01M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2M19 18v2"/></svg>',
    onibus: '<svg viewBox="0 0 24 24"><path d="M8 6v6M15 6v6M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>',
    passeio: '<svg viewBox="0 0 24 24"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>',
    restaurante: '<svg viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>',
    outro: '<svg viewBox="0 0 24 24"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.6A4 4 0 1 1 18 8.8l-8.6 8.6a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>'
  };
  function iconeRes(tipo) { return h('span', { class: 'ic-res', 'aria-hidden': 'true', svg: ICONES_RES[tipo] || ICONES_RES.outro }); }
  function rotuloRes(tipo, extra) { return h('span', { class: 'rot-res' }, [iconeRes(tipo), T('res_' + (tipo || 'outro')) + (extra || '')]); }
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

  /* aberta uma viagem que já passou: deixa claro (é o arquivo) e oferece a próxima com um toque */
  function avisoViagemPassada(tela, rota) {
    var v = estado.viagem;
    if (!v || !emViagem() || !ehPassada(v) || ['inicio', 'roteiro', 'reservas', 'salvos', 'familia', 'mapa'].indexOf(rota) < 0) return;
    var cx = h('div', { class: 'aviso-passada' + (rota === 'mapa' ? ' no-mapa' : '') }, [h('span', { texto: '🗂 ' + T('viagemPassada', { nome: v.nome, data: fData(v.fim) }) })]);
    if (rota === 'mapa') tela.appendChild(cx); else tela.insertBefore(cx, tela.firstChild);
    Banco.listar('viagens').then(function (vs) {
      var prox = vs.filter(function (x) { return x.fim >= hojeIso(); }).sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; })[0];
      if (!prox) return;
      cx.appendChild(h('button', { class: 'bt', type: 'button', texto: T('abrirProxima', { nome: prox.nome }), onclick: function () {
        Contexto.definir('viagem', prox.id).then(recarregarContexto).then(function () { mostrar(rota); });
      } }));
    }).catch(function () {});
  }
  /* viagem que já terminou vai para o arquivo (fora do seletor e das listas principais) */
  function ehPassada(v) { return !!(v && v.fim && v.fim < hojeIso()); }
  function iconeViagem(v) { return v && v.tipo === 'passeio' ? '🚶' : '🧳'; }
  var primeiraCarga = true;
  function carregarViagem(id) {
    return Banco.listar('viagens').then(function (vs) {
      vs.sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
      var proxima = vs.filter(function (x) { return x.fim >= hojeIso(); })[0];
      var v = (id && vs.filter(function (x) { return x.id === id; })[0]) || proxima || vs[vs.length - 1] || null;
      /* ao abrir o app: se a viagem aberta já passou e existe uma próxima, abre a próxima (a passada fica no arquivo) */
      if (primeiraCarga && ehPassada(v) && proxima && window.Contexto && Contexto.emViagem()) { v = proxima; Contexto.definir('viagem', v.id); }
      primeiraCarga = false;
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
      /* ordem das opções: a ordem em que foram criadas (a ⭐ só acende, não muda o lugar do chip) */
      estado.roteiros.sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
      var v = estado.viagem;
      estado.opcao = v ? (estado.roteiros.filter(function (o) { return o.id === v.opcao_ativa; })[0] || estado.roteiros[0] || null) : null;
      acharPontoHotel(v);
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

  /* 🎤 falar em vez de digitar: reconhecimento de voz do próprio navegador (Chrome/Android e Safari/iPhone; sem chave de IA).
     No Chrome precisa de internet; no iPhone funciona também sem. Põe o botão em cada campo de texto da área. */
  var SR_VOZ = window.SpeechRecognition || window.webkitSpeechRecognition;
  function comVoz(raiz) {
    if (!SR_VOZ || !raiz) return;
    [].forEach.call(raiz.querySelectorAll('input:not([type]), input[type="text"], input[type="search"], textarea'), function (c) {
      if (c.dataset.voz || c.classList.contains('hora24') || c.hasAttribute('data-sem-voz') || c.readOnly) return;
      c.dataset.voz = '1';
      var bt = h('button', { class: 'bt-voz', type: 'button', 'aria-label': T('falarNoCampo'), title: T('falarNoCampo'), svg: '<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4"/></svg>' });
      var caixa = h('span', { class: 'campo-voz' + (c.tagName === 'TEXTAREA' ? ' area' : '') });
      c.parentNode.insertBefore(caixa, c); caixa.appendChild(c); caixa.appendChild(bt);
      var rec = null;
      bt.addEventListener('click', function () {
        if (rec) { try { rec.stop(); } catch (e) {} return; }
        rec = new SR_VOZ(); rec.lang = idioma() === 'en' ? 'en-US' : 'pt-BR'; rec.interimResults = true; rec.maxAlternatives = 1;
        var base = c.value ? c.value.replace(/\s+$/, '') + ' ' : '';
        bt.classList.add('ouvindo'); bt.setAttribute('aria-pressed', 'true');
        rec.onresult = function (e) {
          var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
          c.value = (base + t).slice(0, +(c.getAttribute('maxlength') || 1000));
          c.dispatchEvent(new Event('input', { bubbles: true }));
        };
        rec.onerror = function (e) {
          avisar(T(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'vozPermitir' : e.error === 'network' ? 'vozSemInternet' : e.error === 'no-speech' ? 'naoOuvi' : 'vozErro'));
        };
        rec.onend = function () { rec = null; bt.classList.remove('ouvindo'); bt.setAttribute('aria-pressed', 'false'); c.focus(); };
        try { rec.start(); } catch (e) { rec = null; bt.classList.remove('ouvindo'); }
      });
    });
  }
  /* janela (folha que sobe): é uma camada do Voltar */
  function janela(titulo, conteudo, aoFechar) {
    var fundo = h('div', { class: 'janela-fundo' });
    var caixa = h('div', { class: 'janela', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
    var fechar = h('button', { class: 'ic', type: 'button', 'aria-label': T('fechar'), texto: '✕' });
    caixa.appendChild(h('div', { class: 'linha entre' }, [h('h2', { texto: titulo }), fechar]));
    caixa.appendChild(conteudo);
    fundo.appendChild(caixa); d.body.appendChild(fundo);
    comVoz(caixa);
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
      emViagem() ? ['grupoViagem', [['inicio', '☀️'], ['roteiro', '🗓'], ['mapa', '🗺'], ['salvos', '⭐'], ['reservas', '🎫']]] : ['grupoViagem', [['inicio', '☀️'], ['roteiro', '🗓'], ['mapa', '🗺'], ['reservas', '🎫']]],
      emViagem() ? ['grupoExplorar', [['explorar', '🌍']]] : ['grupoExplorar', [['explorar', '🌍'], ['salvos', '🔖']]],
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
          [h('span', { 'aria-hidden': 'true', texto: it[1] }), T(it[0] === 'salvos' && emViagem() ? 'rota_ideias' : 'rota_' + it[0])]));
      })));
    });
    g.appendChild(h('h2', { texto: T('grupoMais') }));
    g.appendChild(h('ul', {}, [h('li', {}, h('a', { href: '/', target: '_blank', rel: 'noopener' }, [h('span', { 'aria-hidden': 'true', texto: '🧭' }), T('portal') + ' ↗']))]));
    g.appendChild(h('p', { class: 'pequeno' }, [comMarca(h('button', { class: 'lk', type: 'button', texto: 'GuiaXpert ' + VERSAO_APP, onclick: function () { Nav.fecharCamada(function () { verNovidades(null); }); } })), ' · ' + T('umaSolucao')]));
    g.appendChild(h('p', { class: 'pequeno' }, h('button', { class: 'lk', type: 'button', texto: '🔄 ' + T('procurarAtualizacao'), onclick: function () { procurarAtualizacao(true); } })));
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
      function itemViagem(v) {
        return item(emViagem() && estado.viagem && estado.viagem.id === v.id, iconeViagem(v) + ' ' + v.nome,
          (v.inicio === v.fim ? semana(v.inicio) + ' ' + fData(v.inicio, true) : fData(v.inicio, true) + ' – ' + fData(v.fim, true)) + (ehPassada(v) ? ' · ' + T('passada') : ''),
          function () { Contexto.definir('viagem', v.id).then(recarregarContexto).then(function () { Nav.ir('inicio', { substituir: true }); }); });
      }
      /* próximas e em andamento, a mais perto primeiro; as passadas ficam recolhidas no arquivo */
      var futuras = vs.filter(function (v) { return !ehPassada(v); }).sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
      var passadas = vs.filter(ehPassada);
      futuras.forEach(function (v) { corpo.appendChild(itemViagem(v)); });
      if (passadas.length) {
        var aberta = estado.viagem && passadas.some(function (v) { return v.id === estado.viagem.id; }) && emViagem();
        var lista = h('div', { class: 'linha arquivo', style: 'flex-direction:column;align-items:stretch;gap:.4rem', hidden: !aberta });
        passadas.forEach(function (v) { lista.appendChild(itemViagem(v)); });
        var bt = h('button', { class: 'bt leve', type: 'button', 'aria-expanded': aberta ? 'true' : 'false', texto: '🗂 ' + T('viagensPassadas', { n: passadas.length }) });
        bt.addEventListener('click', function () { lista.hidden = !lista.hidden; bt.setAttribute('aria-expanded', lista.hidden ? 'false' : 'true'); });
        corpo.appendChild(bt); corpo.appendChild(lista);
      }
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
      todosLugares().map(function (l) { return { l: l, n: notaBusca(l, q) }; }).filter(function (x) { return x.n > 0; })
        .sort(function (a, b) { return b.n - a.n; }).map(function (x) { return x.l; }).slice(0, 20).forEach(function (l) {
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
          var longe = ls.longe || [];
          ls = ls.filter(function (l) { return !ids[normalizar(l.nome)]; }).slice(0, 6);
          function linhaNet(l) {
            return h('button', { class: 'bt-grande', type: 'button', onclick: function () { j.fechar(function () { mostrarNoMapa(l); }); } }, [
              h('span', { class: 'ic-grande', 'aria-hidden': 'true', texto: '📍' }),
              h('span', { class: 'tx' }, [h('b', { texto: l.nome }), h('small', { texto: [[l.endereco, l.cidade].filter(Boolean).join(', '), l.longe && emViagem() ? '📍 ' + T('bscLonge') : null, l.fonte].filter(Boolean).join(' · ') })])]);
          }
          var verLonge = botaoVerLonge(longe, function (cx) { longe.forEach(function (l) { cx.appendChild(linhaNet(l)); }); });
          if (!ls.length) {
            naNet.appendChild(h('p', { class: 'sub', texto: T('bscNadaFora', { q: texto }) }));
            if (verLonge) naNet.appendChild(verLonge);
            naNet.appendChild(h('button', { class: 'bt leve', type: 'button', texto: '🤝 ' + T('acharJuntos'), onclick: function () {
              j.fechar(function () { janelaAcharJuntos(texto, function (n) { if (estado.viagem && estado.opcao && podeEditar()) janelaAddAoRoteiro(n); }); });
            } }));
            return;
          }
          naNet.appendChild(h('p', { class: 'sub', texto: T('bscNaInternet') }));
          ls.forEach(function (l) { naNet.appendChild(linhaNet(l)); });
          if (verLonge) naNet.appendChild(verLonge);
        });
      }, 650);
    }
    var espera = null, vez = 0;
    campo.addEventListener('input', atualizar);
    campo.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(espera); atualizar(); } });
  }
  /* resultados longe da viagem (outra cidade, outro país): escondidos atrás de um botão */
  function botaoVerLonge(longe, desenhar) {
    if (!longe || !longe.length) return null;
    var cx = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.4rem' });
    var bt = h('button', { class: 'lk', type: 'button', texto: '🌎 ' + T('verLonge', { n: longe.length }), onclick: function () { bt.remove(); cx.appendChild(h('p', { class: 'pequeno', texto: T('verLongeDica') })); desenhar(cx); } });
    return h('div', {}, [bt, cx]);
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
    d.body.classList.toggle('na-entrar', rota === 'entrar');
    if (window.Mapa) Mapa.destruir();
    var m = $('conteudo');
    /* redesenho da mesma tela: segura a altura enquanto a tela nova monta (as partes que chegam depois, como
       compromissos fixos e clima, não deixam a página "encolher" e pular para o topo) */
    clearTimeout(relogioAltura);
    if (mesmaTela) m.style.minHeight = m.offsetHeight + 'px'; else m.style.minHeight = '';
    m.textContent = '';
    var tela = h('section', { class: 'tela' + (rota === 'mapa' || rota === 'explorar' ? ' larga' : ''), 'data-rota': rota });
    m.appendChild(tela);
    fundoDaTela();
    $('bt-inicio').setAttribute('aria-current', rota === 'inicio' || rota === 'explorar' ? 'page' : 'false');
    montarBarra(); desenharChip(); if (lib) botaoAssistente();
    try { TELAS[rota](tela); } catch (e) { console.error(e); tela.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T('erroTela') }), String(e.message || e)])); }
    avisoViagemPassada(tela, rota);
    comVoz(tela);
    /* redesenho da mesma tela (marcou uma opção) fica onde estava; tela nova começa no topo */
    var alvoY = mesmaTela && !estado.irAoTopo ? rolagem : 0;
    /* trocou o dia no Roteiro: se a pessoa já tinha rolado para baixo dos dias, mostra o começo do dia novo
       com a fileira de dias no alto; se estava acima, fica exatamente onde estava */
    if (mesmaTela && estado.manterDias) {
      var dz = tela.querySelector('.dias');
      if (dz) { var topoDias = dz.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(d.documentElement).fontSize) * 4.4); alvoY = Math.max(0, Math.min(rolagem, topoDias)); }
    }
    estado.manterDias = false;
    window.scrollTo(0, alvoY); estado.irAoTopo = false;
    if (mesmaTela) relogioAltura = setTimeout(function () { m.style.minHeight = ''; }, 1500);
  }
  var relogioAltura = null;

  /* computador: a foto de fundo vira foto de verdade (a da viagem, nítida); no celular continua a discreta e leve */
  var MQ_LARGO = window.matchMedia ? matchMedia('(min-width: 1024px)') : { matches: false };
  function fundoDaTela() {
    var f = $('fundo-foto'); if (!f) return;
    var fotos = estado.viagem && emViagem() ? fotosDaViagem(estado.viagem) : null;
    var id = (fotos && fotos.length ? fotos[(new Date().getDate()) % fotos.length] : null) || window.GX_FOTO_DO_DIA;
    if (!id) return;
    var alvo = 'img/fundos/' + id + (MQ_LARGO.matches ? '-1280.webp' : '-fundo.webp');
    if (f.getAttribute('src') !== alvo) f.setAttribute('src', alvo);
    var lista = fotos && fotos.length > 1 ? fotos : FOTOS_MUNDO;
    var k = Math.max(0, lista.indexOf(id));
    fundoAnimado(lista.slice(k).concat(lista.slice(0, k)));
  }
  /* computador: as fotos passam devagar atrás do conteúdo (troca suave + zoom lento).
     A camada fica fora da tela: navegar pelo app não recomeça nem recarrega a foto.
     Só de 1024px para cima; com "reduzir movimento" ou aba escondida, fica parada. */
  var fundoAnim = { chave: null, i: 0, timer: null, imgs: null };
  var MQ_CALMO = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function fundoAnimado(lista) {
    var pode = MQ_LARGO.matches && !MQ_CALMO.matches && lista && lista.length > 1;
    var cx = $('fundo-anim');
    if (!pode) {
      clearInterval(fundoAnim.timer); fundoAnim.timer = null; fundoAnim.chave = null;
      d.body.classList.remove('fundo-anim'); if (cx) cx.remove();
      return;
    }
    var chave = lista.join(',');
    if (fundoAnim.chave === chave && cx) return;          /* mesma viagem: continua de onde estava */
    fundoAnim.chave = chave; fundoAnim.lista = lista; fundoAnim.i = 0;
    if (!cx) {
      cx = h('div', { id: 'fundo-anim', 'aria-hidden': 'true' }, [h('img', { alt: '', decoding: 'async' }), h('img', { alt: '', decoding: 'async' })]);
      d.body.insertBefore(cx, d.body.firstChild);
    }
    fundoAnim.imgs = cx.querySelectorAll('img');
    mostrarFundo(fundoAnim.imgs[0], fundoAnim.imgs[1], lista[0]);
    d.body.classList.add('fundo-anim');
    clearInterval(fundoAnim.timer);
    fundoAnim.timer = setInterval(function () {
      if (d.hidden) return;
      var ims = fundoAnim.imgs, ativa = ims[0].classList.contains('ativa') ? 0 : 1;
      fundoAnim.i = (fundoAnim.i + 1) % fundoAnim.lista.length;
      mostrarFundo(ims[1 - ativa], ims[ativa], fundoAnim.lista[fundoAnim.i]);
    }, 20000);
  }
  function mostrarFundo(nova, velha, id) {
    var pronto = function () {
      nova.onload = null;
      nova.classList.remove('ativa', 'kb2'); void nova.offsetWidth;   /* recomeça o zoom lento */
      if (fundoAnim.i % 2) nova.classList.add('kb2');
      nova.classList.add('ativa'); velha.classList.remove('ativa');
    };
    var src = 'img/fundos/' + id + '-1280.webp';
    if (nova.getAttribute('src') === src && nova.complete) { pronto(); return; }
    nova.onload = pronto; nova.setAttribute('src', src);
  }
  if (MQ_CALMO.addEventListener) MQ_CALMO.addEventListener('change', function () { fundoDaTela(); });
  if (MQ_LARGO.addEventListener) MQ_LARGO.addEventListener('change', function () { fundoDaTela(); });
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
  var FOTOS_DESTINO = { gramado: ['gramado-igreja-noite', 'gramado-natal-arcos', 'gramado-natal-rua', 'gramado-noite', 'gramado-lago', 'canela-caracol', 'gramado-hortensia'],
    'sao paulo': ['masp'], 'rio de janeiro': ['cristo', 'guanabara'], 'foz do iguacu': ['iguacu'], 'noronha': ['noronha'], 'lencois': ['lencois'],
    'veadeiros': ['veadeiros'], 'paris': ['eiffel'], 'roma': ['coliseu'], 'santorini': ['oia'], 'agra': ['taj'], 'cusco': ['machu'], 'machu picchu': ['machu'],
    'sydney': ['sydney'], 'pequim': ['muralha'], 'beijing': ['muralha'] };
  FOTOS_DESTINO.canela = FOTOS_DESTINO.gramado; FOTOS_DESTINO.rio = FOTOS_DESTINO['rio de janeiro']; FOTOS_DESTINO.iguacu = FOTOS_DESTINO['foz do iguacu'];
  /* viagem pelo Brasil sem fotos próprias: cartões-postais do Brasil; fora do Brasil: os do mundo */
  var FOTOS_BRASIL = ['cristo', 'guanabara', 'iguacu', 'masp', 'noronha', 'lencois', 'veadeiros', 'comida-doce'];
  var UFS = /\b(ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to|brasil|brazil)\b/;
  function fotosDaViagem(v) {
    var txt = normalizar([v && v.destino, v && v.destinoTexto, v && v.nome].join(' '));
    for (var k in FOTOS_DESTINO) if (txt.indexOf(k) > -1) {
      var proprias = FOTOS_DESTINO[k];
      /* poucas fotos do lugar: completa com as do país (o fundo do computador precisa de mais de uma para passar) */
      return proprias.length >= 3 ? proprias : proprias.concat((FOTOS_BRASIL.indexOf(proprias[0]) > -1 ? FOTOS_BRASIL : FOTOS_MUNDO).filter(function (f) { return proprias.indexOf(f) < 0; }));
    }
    var noBrasil = (v && v.pais === 'BR') || UFS.test(txt) || !!(estado.pacote && estado.pacote.pais === 'BR');
    return noBrasil ? FOTOS_BRASIL : FOTOS_MUNDO;
  }
  var fotosTimer = null, creditosFotos = null;
  /* nome da marca: Guia + X (negrito, outra cor: "o X marca o local") + pert */
  function comMarca(el) {
    if (!el) return el;
    [].slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType !== 3 || n.nodeValue.indexOf('GuiaXpert') < 0) return;
      var partes = n.nodeValue.split('GuiaXpert'), frag = d.createDocumentFragment();
      partes.forEach(function (t, i) {
        if (t) frag.appendChild(d.createTextNode(t));
        if (i < partes.length - 1) frag.appendChild(h('span', { class: 'marca-nome', 'aria-label': 'GuiaXpert' }, ['Guia', h('span', { class: 'marca-x', texto: 'X' }), 'pert']));
      });
      n.parentNode.replaceChild(frag, n);
    });
    return el;
  }
  function marcaHtml(t) { return String(t).split('GuiaXpert').join('Guia<span class="marca-x">X</span>pert'); }
  function faixaFotos(titulo, sub, op) {
    op = op || {};
    var dia = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    var FOTOS = op.destino ? op.destino.slice() : FOTOS_MUNDO;   /* na viagem: só fotos de lá */
    var n = FOTOS.length, inicio = (op.indice != null ? op.indice : op.destino ? 0 : dia) % n;
    var img = function (id, ativa) { return h('img', { class: 'hero-foto' + (ativa ? ' ativa' : ''), alt: '', decoding: 'async', loading: 'eager', sizes: '100vw',
      src: 'img/fundos/' + id + '-640.webp', srcset: 'img/fundos/' + id + '-640.webp 640w, img/fundos/' + id + '-1280.webp 1280w' }); };
    var a = img(FOTOS[inicio], true), b = img(FOTOS[(inicio + 1) % n], false);
    var cred = h('button', { class: 'hero-cred', type: 'button', texto: '📷', 'aria-label': T('creditosFotos'), onclick: janelaCreditosFotos });
    var caixa = h('div', { class: 'hero' + (op.compacta ? ' compacta' : ''), 'aria-hidden': 'true' }, [a, b, h('div', { class: 'hero-veu' }),
      h('div', { class: 'hero-texto' }, [titulo ? comMarca(h('p', { class: 'hero-titulo', texto: titulo })) : null, sub ? h('p', { class: 'hero-sub', texto: sub }) : null]), cred]);
    cred.removeAttribute('aria-hidden');
    var i = inicio, atual = a, prox = b, ocupado = false;
    var reduz = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function fonte(el, id) { el.src = 'img/fundos/' + id + '-640.webp'; el.srcset = 'img/fundos/' + id + '-640.webp 640w, img/fundos/' + id + '-1280.webp 1280w'; }
    /* troca para a próxima (dir = 1) ou a anterior (dir = -1): esmaece; a nova começa a se mexer devagar */
    var vezes = 0;
    function passar(dir) {
      if (ocupado || n < 2) return; ocupado = true;
      i = (i + dir + n) % n;
      fonte(prox, FOTOS[i]);
      var mostrar = function () {
        vezes++; prox.classList.toggle('par', vezes % 2 === 1);
        prox.classList.add('ativa'); atual.classList.remove('ativa');
        var velho = atual; atual = prox; prox = velho;
        setTimeout(function () { velho.classList.remove('par'); ocupado = false; }, reduz ? 0 : 1700);
      };
      if (prox.complete && prox.naturalWidth) mostrar(); else { prox.onload = function () { prox.onload = null; mostrar(); }; setTimeout(function () { if (prox.onload) { prox.onload = null; mostrar(); } }, 2500); }
    }
    clearInterval(fotosTimer); fotosTimer = null;
    if (!reduz && n > 1) {
      fotosTimer = setInterval(function () {
        if (!caixa.isConnected) { clearInterval(fotosTimer); fotosTimer = null; return; }
        if (d.hidden) return;
        passar(1);
      }, 8000);
    }
    /* arrastar com o dedo também passa as fotos */
    var x0 = null;
    caixa.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    caixa.addEventListener('pointerup', function (e) { if (x0 == null) return; var dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) passar(dx < 0 ? 1 : -1); });
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
    var c = centroViagem(), cx = h('div', { class: 'cartao cartao-clima' }, [h('h3', { texto: T('climaTitulo') }), h('p', { class: 'sub', texto: T('carregando') })]);
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
    if (estado.viagem && ds.length) cx.appendChild(h('button', { class: 'bt sec', type: 'button', style: 'align-self:flex-start', texto: '🧳 ' + T('malasBotao'), onclick: function () { janelaMalas(estado.viagem, ds); } }));
    var v = estado.viagem, onde = (v && v.destinoTexto) || (estado.pacote && Pacotes.nome(estado.pacote, idioma())) || '';
    cx.appendChild(h('p', { class: 'pequeno' }, [
      (p.antiga ? T('climaAntigo') + ' ' : '') + T('climaFonte', { fonte: p.fonte || 'Open-Meteo' }) + ' ',
      h('a', { href: Clima.linkCompleto(onde), target: '_blank', rel: 'noopener', texto: T('climaCompleto') })
    ]));
  }

  /* E17 "O que levar": lista por regras a partir da previsão (frio, calor, chuva, vento, nº de dias); marca o que já foi pra mala */
  function janelaMalas(v, ds) {
    var n = diasDaViagem(v).length, min = Math.min.apply(null, ds.map(function (x) { return x.min; })), max = Math.max.apply(null, ds.map(function (x) { return x.max; }));
    var chuva = ds.filter(function (x) { return x.chuva != null && x.chuva >= 50; }).length, vento = ds.some(function (x) { return x.vento != null && x.vento >= 40; });
    var itens = [T('malaRoupas', { n: n, m: n + 1 }), T('malaSapato')];
    if (min <= 12) itens.push(T('malaFrioForte', { t: min })); else if (min <= 17) itens.push(T('malaFrio', { t: min }));
    if (max >= 27) itens.push(T('malaCalor', { t: max }));
    if (chuva) { itens.push(T('malaChuva', { n: chuva })); itens.push(T('malaChuva2')); }
    if (vento) itens.push(T('malaVento'));
    itens.push(T('malaCriancas'), T('malaRemedios'), T('malaCarregador'), T('malaDocs'));
    var chave = 'malas:' + v.id, lista = h('ul', { class: 'checagem' });
    Banco.meta(chave, {}).then(function (feitos) {
      itens.forEach(function (t, i) {
        var id = 'gx-mala-' + i, c = h('input', { type: 'checkbox', id: id }); c.checked = !!feitos[t];
        c.addEventListener('change', function () { feitos[t] = c.checked; Banco.definirMeta(chave, feitos); });
        lista.appendChild(h('li', { class: 'linha', style: 'flex-wrap:nowrap;align-items:flex-start;gap:.5rem' }, [c, h('label', { for: id, texto: t })]));
      });
    });
    janela('🧳 ' + T('malasBotao'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { class: 'sub', texto: T('malasDica', { min: min, max: max }) }), lista, h('p', { class: 'pequeno', texto: T('malasRodape') })]));
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
    /* a opção escolhida fica sempre à vista (com muitas opções, os chips rolam de lado) */
    setTimeout(function () { var sel = ops.querySelector('[aria-selected="true"]'); if (sel && ops.scrollWidth > ops.clientWidth) ops.scrollLeft = Math.max(0, sel.offsetLeft - ops.clientWidth / 2 + sel.offsetWidth / 2); }, 0);
    var o = estado.opcao;
    var barra = h('div', { class: 'linha' }, [
      h('button', { class: 'fav', type: 'button', 'aria-pressed': o.favorito ? 'true' : 'false', 'aria-label': T('favoritarRoteiro'), texto: o.favorito ? '★' : '☆',
        onclick: function () { o.favorito = !o.favorito; Banco.gravar('roteiros', o).then(function () { return recarregar(); }); } }),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaNovaOpcao(); } }, '＋ ' + T('outraOpcao')),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaEstaOpcao(o); } }, '✎ ' + T('estaOpcao'))
    ]);
    barra.appendChild(h('button', { class: 'bt leve', type: 'button', texto: '📤 ' + T('cmp_botao'), onclick: function () { janelaCompartilharRoteiro(v); } }));
    barra.appendChild(h('button', { class: 'bt leve', type: 'button', texto: '📅 ' + T('calBotao'), title: T('calDica'), onclick: function () { exportarCalendario(v, o); } }));
    tela.appendChild(barra);
    if (o.origem === 'ia') tela.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T('iaConfira') }), T('iaConfiraTexto')]));

    var dias = diasDaViagem(v);
    var tabs = h('div', { class: 'dias', role: 'tablist', 'aria-label': T('diasDaViagem') });
    dias.forEach(function (dt, i) {
      tabs.appendChild(h('button', { class: 'dia', role: 'tab', type: 'button', 'aria-selected': i === estado.dia ? 'true' : 'false', onclick: function () { estado.dia = i; estado.manterDias = true; mostrar('roteiro'); } },
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
    /* compromissos fixos 🔒: reservas com dia e hora (ingressos comprados, voo, hotel); o dia se monta em volta deles */
    var fixos = h('div', { class: 'fixos' });
    Banco.listar('reservas', function (r) { return r.viagem_id === v.id && r.agenda && r.agenda.quando && r.agenda.quando.slice(0, 10) === data; }).then(function (rs) {
      /* mesmo critério da tela Reservas: ingressos do mesmo evento juntos; logística (voo, hotel, carro) da mesma etapa e horário junta
         (ex.: o hotel da família e o da avó, no mesmo check-in, viram uma linha só com "2 reservas") */
      var grupos = {};
      rs.forEach(function (r) {
        var c = { tipo: r.tipo, titulo: r.agenda.titulo, quando: r.agenda.quando };
        var k = r.agenda.grupo || (LOGISTICA[r.tipo] ? 'L|' + etapaDe(c, v) + '|' + r.agenda.quando : r.agenda.titulo + '|' + r.agenda.quando);
        (grupos[k] = grupos[k] || []).push(r);
      });
      var gs = Object.keys(grupos).map(function (k) { return grupos[k]; });
      var objs = gs.map(function (g) { return { tipo: g[0].tipo, titulo: g[0].agenda.titulo, quando: g[0].agenda.quando }; });
      var chv = chavesComoNaVida(objs);
      gs.forEach(function (g, i) { g._k = chv[i]; g._cedo = objs[i]._chegaCedo; g._fim = !!objs[i]._fimDoDia; });
      if (gs.length) cab.appendChild(h('span', { class: 'pequeno', style: 'flex-basis:100%', texto: '🔒 ' + T('fixoLegenda') }));
      esconderRepetidos(bloco, gs);
      avisoDiaCheio(cab, dmod, gs);
      gs.sort(function (a, b) { return a._k < b._k ? -1 : a._k > b._k ? 1 : 0; }).forEach(function (g) {
        /* o título mais curto do grupo é o "geral" (sem o "· Leia" do fim) */
        var base = g.slice().sort(function (x, y) { return x.agenda.titulo.length - y.agenda.titulo.length; })[0];
        var a = base.agenda, tipo = base.tipo, hora = a.quando.slice(11, 16), pos = g._k.slice(11, 16), pr = papelReserva({ tipo: tipo, titulo: a.titulo });
        var horaTxt = g._fim ? '—' : (hora || '—');
        var dica = hora && (pr === 'entra' && tipo === 'hotel' || pr === 'sai') ? T(pr === 'sai' ? 'ateAs' : 'aPartirDe', { h: hora }) : '';
        var etq = tipo === 'ingresso' && g.length > 1 ? T('nIngressos', { n: g.length }) : g.length > 1 ? T('nReservas', { n: g.length }) : null;
        var el = h('div', { class: 'item fixo' }, [h('span', { class: 'h', texto: horaTxt }),
          h('div', { class: 'x' }, [h('div', { class: 'linha' }, [h('span', { 'aria-hidden': 'true', title: T('fixoNaoMuda'), texto: '🔒' }), h('b', { texto: a.titulo }),
            h('span', { class: 'etq' }, rotuloRes(tipo || 'outro')), etq ? h('span', { class: 'etq', texto: etq }) : null]),
            dica ? h('span', { class: 'nota', texto: dica.charAt(0).toUpperCase() + dica.slice(1) }) : null,
            g._cedo ? h('span', { class: 'nota', texto: 'ℹ️ ' + T('chegaCedo', { h: g._cedo }) }) : null,
            tipo === 'voo' && hora && data === v.fim ? notaSairParaVoo(hora, rs) : null,
            a.local ? h('span', { class: 'nota', texto: a.local }) : null,
            (tipo === 'ingresso' && g.length > 1 && g.length < pessoasDaViagem(v).length) ? h('span', { class: 'nota', texto: 'ℹ️ ' + T('ingressosMenos', { n: g.length, p: pessoasDaViagem(v).length }) }) : null,
            h('button', { class: 'bt leve bt-reserva', type: 'button', onclick: function () { irParaReserva(g.map(function (r) { return r.id; }), data); } },
              [iconeRes(tipo), T('verRes_' + (({ ingresso: g.length > 1 ? 'ingressos' : 'ingresso', voo: 'voo', hotel: 'hotel', carro: 'carro' })[tipo] || 'outro')) + ' ›'])])]);
        /* entra na ordem do horário, no meio dos outros itens do dia */
        var depois = [].filter.call(bloco.children, function (it) {
          if (!(it.classList.contains('item') && !it.classList.contains('fixo')) && !it.classList.contains('alternativas')) return false;
          var t = it.getAttribute('data-h') || it.getAttribute('data-hora') || (it.querySelector('.h') || {}).textContent || ''; return /^\d\d:\d\d$/.test(t) && t > (pos || hora); })[0];
        if (depois) depois.parentNode.insertBefore(el, depois); else fixos.appendChild(el);
      });
    }).catch(function () {});
    var hj = data === hojeIso(), agoraMin = new Date().getHours() * 60 + new Date().getMinutes(), marcouAgora = false;
    var gruposAlt = {};
    (dmod.itens || []).forEach(function (it, idx) {
      var l = it.lugarId ? lugarPorId(it.lugarId) : null;
      var agora = !it.alt && hj && !marcouAgora && it.hora && minutos(it.hora) >= agoraMin - 30;
      if (agora) marcouAgora = true;
      var x = h('div', { class: 'x' }, [
        h('div', { class: 'linha' }, [l ? placa(l.categoria) : null,
          h('button', { class: 'lk', type: 'button', style: 'text-decoration:none', onclick: function () { janelaEditarItem(o, dmod, idx); } }, it.titulo),
          it.tipo === 'gratis' ? h('span', { class: 'etq gratis', texto: T('gratis') }) : null,
          it.tipo === 'ingresso' ? h('span', { class: 'etq', texto: T('ingresso') }) : null]),
        it.nota ? h('span', { class: 'nota' }, comLinks(it.nota)) : null
      ]);
      var conf = it.estado === 'confirmado';
      var btConf = it.alt ? h('button', { class: 'bt leve escolher', type: 'button', texto: '✓ ' + T('escolherEsta'), onclick: function () { escolherAlternativa(o, dmod, idx); } })
        : h('button', { class: 'conf', type: 'button', 'aria-pressed': conf ? 'true' : 'false', 'aria-label': T(conf ? 'confirmado' : 'confirmar'), texto: '✓', onclick: function () {
        mudarItem(o, dmod, idx, function (item) { item.estado = item.estado === 'confirmado' ? null : 'confirmado'; }).then(recarregarTela); } });
      var rm = o.origem !== 'pacote' ? h('button', { class: 'fav tirar', type: 'button', 'aria-label': T('tirarItem') + ': ' + it.titulo, texto: '✕', onclick: function () {
        tirarComDesfazer(o, o.dias.indexOf(dmod), idx); } }) : null;
      var el = h('div', { class: 'item' + (agora ? ' agora' : '') + (conf ? ' confirmado' : '') + (it.alt ? ' alt' : ''), 'data-tit': normalizar(it.titulo || ''), 'data-lugar': it.lugarId || '', 'data-hora': it.hora || '', 'data-idx': String(idx) },
        [h('span', { class: 'h' }, it.alt ? '' : [it.hora || '—', it.fim ? h('small', { class: 'ate', texto: '–' + it.fim }) : null]), x, h('span', { class: 'linha', style: 'flex-wrap:' + (it.alt ? 'wrap' : 'nowrap') + ';gap:0;justify-content:flex-end' }, [btConf, rm])]);
      if (!it.alt) { bloco.appendChild(el); return; }
      /* alternativas (ainda não decidido) no mesmo horário: uma caixa só, "escolha uma" */
      var k = it.hora || Clima.periodoDaHora(it.hora) || 'sem';
      var g = gruposAlt[k];
      if (!g) {
        g = gruposAlt[k] = { caixa: null, corpo: h('div', { class: 'alt-corpo' }), idxs: [] };
        var comparar = h('button', { class: 'bt leve', type: 'button', texto: '⚖ ' + T('compararAlt') });
        var lembrar = h('button', { class: 'bt leve', type: 'button', texto: '📅 ' + T('lembreteDecidir') });
        g.caixa = h('div', { class: 'alternativas', 'data-h': it.hora || '' }, [
          h('div', { class: 'alt-cab' }, [h('span', { class: 'h', texto: it.hora || '—' }), h('div', {}, [h('b', { texto: '🔀 ' + T('altTitulo') }), h('span', { class: 'pequeno', style: 'display:block', texto: T('altDica') })])]),
          g.corpo, h('div', { class: 'linha alt-acoes' }, [comparar, lembrar])]);
        comparar.addEventListener('click', function () { janelaComparar(dmod, g.idxs, data); });
        lembrar.addEventListener('click', function () { lembreteDecidir(dmod, g.idxs, data); });
        bloco.appendChild(g.caixa);
      }
      g.idxs.push(idx); g.corpo.appendChild(el);
    });
    /* tempo por passeio (neblina × vista, chuva × ao ar livre), avisos de deslocamento e de dia cheio */
    if (c) avisosDoDia(bloco, cab, dmod, data, dias, c);
    bloco.appendChild(fixos);
    if (!(dmod.itens || []).length) bloco.appendChild(h('p', { class: 'sub', style: 'padding:1rem', texto: T('diaVazio') }));
    tela.appendChild(bloco);
    if (o.origem === 'pacote') tela.appendChild(h('p', { class: 'pequeno', texto: T('pacoteEditar') }));
    if (podeEditar()) tela.appendChild(h('div', { class: 'linha' }, [h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaItem(o, dmod); } }, '＋ ' + T('addItem')),
      h('button', { class: 'bt leve', type: 'button', onclick: function () { Nav.ir('salvos'); } }, '⭐ ' + T('ideiasGuardadas', { n: ideiasDaViagem().length }))]));
    else tela.appendChild(h('p', { class: 'pequeno', texto: T('soVe') }));
  };
  function recarregar() { return carregarViagem(estado.viagem && estado.viagem.id).then(function () { mostrar(estado.rota); }); }
  function recarregarTela() { return recarregar(); }
  /* o roteiro pronto do guia diz "Chegada no aeroporto", "Pegar o carro", "Check-in", "Grande Desfile"…
     se a pessoa já tem a reserva (🔒), o item do roteiro repete: some da lista e fica só o compromisso fixo */
  function esconderRepetidos(bloco, gs) {
    var tem = {}, titulos = [];
    gs.forEach(function (g) { tem[g[0].tipo] = 1; if (g[0].tipo === 'ingresso' || g[0].tipo === 'passeio') titulos.push(normalizar(g[0].agenda.titulo).replace(/^(o|a|os|as) /, '')); });
    [].forEach.call(bloco.querySelectorAll('.item:not(.fixo)[data-tit]'), function (el) {
      var t = el.getAttribute('data-tit');
      var rep = (tem.voo && /\bvoo\b|aeroporto|embarque/.test(t)) || (tem.carro && /\bcarro\b|locadora|localiza/.test(t)) ||
        (tem.hotel && /check.?in|check.?out|\bhotel\b/.test(t)) ||
        titulos.some(function (x) { var y = t.replace(/^(o|a|os|as) /, ''); return x && (x.indexOf(y) > -1 || y.indexOf(x) > -1); });
      if (rep) { el.hidden = true; el.classList.add('repetido'); }
    });
  }
  /* tempo de carro: na cidade ~30 km/h; na estrada ~65 km/h (com 30% de curvas) */
  function minCarro(km) { return km == null ? null : km < 15 ? Geo.minutosCarro(km) : Math.round(km * 1.3 / 65 * 60); }
  function hhmm(min) { min = ((min % 1440) + 1440) % 1440; var hh = Math.floor(min / 60), mm = min % 60; return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm; }
  /* voo de volta: a que horas sair do hotel (chegar 1h30 antes do voo doméstico, estrada até o aeroporto, devolver o carro) */
  function notaSairParaVoo(hora, rs) {
    var hp = pontoHotel(), aero = todosLugares().filter(function (l) { return /aeroporto/i.test(l.nome) && l.lat != null; })[0];
    if (!hp || !aero) return null;
    var estrada = minCarro(Geo.distancia(hp, aero)), carro = rs.some(function (r) { return r.tipo === 'carro'; }) ? 30 : 0;
    var sair = minutos(hora) - 90 - carro - Math.round(estrada * 1.15);
    return h('span', { class: 'nota aviso-tempo forte', texto: '🧭 ' + T('sairParaVoo', { h: hhmm(sair), est: Math.round(estrada / 60 * 10) / 10, aero: aero.nome }) + (carro ? ' ' + T('sairComCarro') : '') });
  }
  /* "9h às 17h", "9h30–18h", "11h30 às 15h": abre e fecha (primeiro intervalo do texto) */
  function horarioAberto(txt) {
    var m = /(\d{1,2})h(\d{2})?\s*(?:às|as|a|–|-|até)\s*(\d{1,2})h(\d{2})?/i.exec(String(txt || ''));
    if (!m) return null;
    return { abre: (+m[1]) * 60 + (+m[2] || 0), fecha: (+m[3]) * 60 + (+m[4] || 0) };
  }
  /* ---------- tempo por passeio, alternativas e avisos do dia (sem IA: regras + previsão aberta) ---------- */
  /* que tipo de passeio é para o tempo: 'vista' (bondinho, mirante, cascata: neblina some com tudo), 'aberto' (chuva atrapalha), 'coberto' */
  function tipoTempo(l) {
    if (!l) return null;
    if (l.tempo) return l.tempo;
    var t = normalizar([l.nome, l.descricao, l.subcategoria].join(' '));
    if (/museu|coberto|shopping|cinema|teatro|vinicola|igreja|indoor|cervejaria/.test(t)) return 'coberto';
    if (/mirante|cascata|bondinho|teleferico|tirolesa|roda.gigante|skyglass|\bvista\b/.test(t)) return 'vista';
    if (l.categoria === 'atracao' && /parque|lago|praca|trilha|jardim|zoo|fonte|rua torta|ao ar livre/.test(t)) return 'aberto';
    return null;
  }
  var NOME_PERIODO = { manha: 'perManha', tarde: 'perTarde', noite: 'perNoite' };
  /* ponto do hotel: estadia com coordenada, reserva de hospedagem com ponto, ou o endereço da reserva achado no mapa aberto (guardado) */
  function pontoHotel() { return estado.hotelPonto || null; }
  function acharPontoHotel(v) {
    if (!v) { estado.hotelPonto = null; estado.hotelDe = null; return; }
    if (estado.hotelDe === v.id && estado.hotelPonto) return;    /* já achado para esta viagem */
    if (estado.hotelDe !== v.id) estado.hotelPonto = null;
    estado.hotelDe = v.id;
    var e = (v.estadias || []).filter(function (x) { return x.lat != null; })[0];
    if (e) { estado.hotelPonto = { lat: e.lat, lng: e.lng }; return; }
    Banco.listar('reservas', function (r) { return r.viagem_id === v.id && r.tipo === 'hotel' && r.agenda; }).then(function (rs) {
      var com = rs.filter(function (r) { return r.agenda.lat != null; })[0];
      if (com) { estado.hotelPonto = { lat: com.agenda.lat, lng: com.agenda.lng }; return; }
      var loc = rs.map(function (r) { return r.agenda.local; }).filter(Boolean)[0];
      if (!loc) return;
      return Banco.meta('hotel-ponto:' + v.id, null).then(function (g) {
        if (g && g.local === loc) { estado.hotelPonto = g; return; }
        if (!navigator.onLine || !window.Descobrir) return;
        return Descobrir.buscarNome(loc, centroViagem(), idioma()).then(function (ls) {
          if (!ls[0]) return;
          estado.hotelPonto = { lat: ls[0].lat, lng: ls[0].lng, local: loc };
          Banco.definirMeta('hotel-ponto:' + v.id, estado.hotelPonto);
        });
      });
    }).catch(function () {});
  }
  function doHotelTexto(l) {
    var hp = pontoHotel(); if (!hp || !l || l.lat == null) return null;
    var km = Geo.distancia(hp, l);
    return T('doHotel', { km: Geo.formatarKm(km), min: Geo.minutosCarro(km) });
  }
  /* passeios cobertos do catálogo, para plano B com chuva ou neblina */
  function planoBCoberto(excluir) {
    return todosLugares().filter(function (l) { return l.categoria === 'atracao' && tipoTempo(l) === 'coberto' && l.id !== excluir && !/igreja|desfile|rua coberta/i.test(l.nome); })
      .slice(0, 3).map(function (l) { return l.nome; });
  }
  function avisosDoDia(bloco, cab, dmod, data, dias, c) {
    var itens = [].slice.call(bloco.querySelectorAll('.item[data-idx]'));
    /* deslocamento e mesmo horário (itens decididos, na ordem da hora) */
    var decididos = itens.filter(function (el) { return !el.classList.contains('alt') && el.getAttribute('data-hora'); });
    decididos.forEach(function (el, i) {
      if (!i) return;
      var ant = decididos[i - 1], ha = ant.getAttribute('data-hora'), hb = el.getAttribute('data-hora');
      var x = el.querySelector('.x');
      var fa = dmod.itens[+ant.getAttribute('data-idx')].fim;
      if (fa && fa > hb) { x.appendChild(h('span', { class: 'nota aviso', texto: '⚠ ' + T('sobrepoe', { t: dmod.itens[+ant.getAttribute('data-idx')].titulo, f: fa }) })); return; }
      if (ha === hb) { x.appendChild(h('span', { class: 'nota aviso', texto: '⚠ ' + T('mesmoHorario', { t: dmod.itens[+ant.getAttribute('data-idx')].titulo }) })); return; }
      var la = lugarPorId(ant.getAttribute('data-lugar')), lb = lugarPorId(el.getAttribute('data-lugar'));
      if (!la || !lb || la.lat == null || lb.lat == null) return;
      var km = Geo.distancia(la, lb); if (km < 4) return;
      var min = Geo.minutosCarro(km), folga = minutos(hb) - minutos(ha);
      x.appendChild(h('span', { class: 'nota' + (min >= folga ? ' aviso' : ''), texto: (min >= folga ? '⚠ ' : '🚗 ') + T(min >= folga ? 'deslocApertado' : 'desloc', { min: min, de: la.nome }) }));
    });
    itens.forEach(function (el) {
      var hr = el.getAttribute('data-hora'), l = lugarPorId(el.getAttribute('data-lugar')), hx = l && horarioAberto(l.horario);
      if (!hr || !hx || l.categoria === 'logistica') return;
      var m = minutos(hr);
      if (m < hx.abre - 15 || m > hx.fecha - 30) el.querySelector('.x').appendChild(h('span', { class: 'nota aviso', texto: '🕘 ' + T('foraDoHorario', { h: l.horario.slice(0, 60) }) }));
    });
    Clima.porHora(c.lat, c.lng).then(function (res) {
      var pers = ['manha', 'tarde', 'noite'].map(function (n) { return [n, Clima.periodo(res.horas, data, n)]; }).filter(function (x) { return x[1]; });
      if (pers.length) cab.appendChild(h('span', { class: 'periodos pequeno' }, pers.map(function (x) {
        var p = x[1];
        return h('span', { class: 'per' + (p.neblina || p.chuva >= 60 ? ' ruim' : ''), title: T(NOME_PERIODO[x[0]]) }, T(NOME_PERIODO[x[0]]) + ' ' + Clima.icone(p.cod) + (p.neblina ? ' ' + T('neblina') : '') + (p.chuva ? ' ☔' + p.chuva + '%' : ''));
      })));
      itens.forEach(function (el) {
        var l = lugarPorId(el.getAttribute('data-lugar')), tipo = tipoTempo(l), per = Clima.periodoDaHora(el.getAttribute('data-hora') || (el.closest('.alternativas') || el).getAttribute('data-h'));
        if (!tipo || !per) return;
        var r = Clima.risco(tipo, Clima.periodo(res.horas, data, per));
        if (!r) { if (tipo === 'vista' && Clima.periodo(res.horas, data, per)) el.querySelector('.x').appendChild(h('span', { class: 'nota bom', texto: '👀 ' + T('tempoBomVista', { per: T(NOME_PERIODO[per]).toLowerCase() }) })); return; }
        var melhor = dias.filter(function (d) { return d !== data && Clima.periodo(res.horas, d, per) && !Clima.risco(tipo, Clima.periodo(res.horas, d, per)); })[0];
        var partes = [r.icone + ' ' + T(r.chave, { per: T(NOME_PERIODO[per]).toLowerCase() })];
        if (melhor) partes.push(T('tempoMelhorDia', { dia: semana(melhor) + ' ' + fData(melhor, true), per: T(NOME_PERIODO[per]).toLowerCase() }));
        var b = r.nivel >= 2 ? planoBCoberto(l.id) : [];
        if (b.length) partes.push(T('tempoPlanoB', { lista: b.join(', ') }));
        el.querySelector('.x').appendChild(h('span', { class: 'nota aviso-tempo' + (r.nivel >= 2 ? ' forte' : '') }, partes.join(' ')));
      });
    }).catch(function () {});
  }
  /* dia cheio: muitos programas + compromisso à noite → sugere descanso (crianças pequenas e idosos sentem mais) */
  function avisoDiaCheio(cab, dmod, gs) {
    var prog = (dmod.itens || []).filter(function (it) { return !it.alt && !/descans|hotel|check|voo|aeroporto|carro|sair de|almo|jant/i.test(it.titulo || ''); }).length;
    var noite = gs.some(function (g) { return (g[0].tipo === 'ingresso' || g[0].tipo === 'passeio') && g[0].agenda.quando.slice(11, 13) >= '19'; });
    prog += gs.filter(function (g) { return g[0].tipo === 'ingresso' || g[0].tipo === 'passeio'; }).length;
    if (prog >= 6 || (noite && prog >= 4)) cab.appendChild(h('span', { class: 'alerta pequeno', style: 'flex-basis:100%;margin:.3rem 0 0' }, [h('b', { texto: '🧭 ' + T('diaCheio', { n: prog }) }), T('diaCheioDica')]));
  }
  /* escolher uma alternativa: ela fica no dia, as outras do mesmo horário saem (com Desfazer) */
  function escolherAlternativa(o, dmod, idx) {
    var di = o.dias.indexOf(dmod), antes = JSON.stringify(o.dias), tit = dmod.itens[idx].titulo;
    mudarItem(o, dmod, idx, function (item) { item.alt = false; }).then(function (alvo) {
      var dd = alvo.dias[di], esc = dd.itens[idx];
      dd.itens = dd.itens.filter(function (it, i) { return i === idx || !(it.alt && (it.hora || '') === (esc.hora || '')); });
      return Banco.gravar('roteiros', alvo).then(function () { return alvo; });
    }).then(function (alvo) {
      return recarregar().then(function () {
        avisar(T('altEscolhida', { t: tit }), T('desfazer'), function () {
          Banco.ler('roteiros', alvo.id).then(function (r) { r.dias = JSON.parse(antes); return Banco.gravar('roteiros', r); }).then(recarregar);
        }, 9000);
      });
    });
  }
  /* comparar alternativas lado a lado */
  function janelaComparar(dmod, idxs, data) {
    var its = idxs.map(function (i) { return dmod.itens[i]; }), ls = its.map(function (it) { return it.lugarId ? lugarPorId(it.lugarId) : null; });
    var linhas = [
      ['📍 ' + T('cmpOnde'), function (l) { return l ? [l.endereco || cidadeDoLugar(l)].filter(Boolean).join('') : ''; }],
      ['🚗 ' + T('cmpDoHotel'), function (l) { return doHotelTexto(l) || '—'; }],
      ['💲 ' + T('preco'), function (l) { return l && l.preco || '—'; }],
      ['👧 ' + T('criancas'), function (l) { return l && l.criancas || '—'; }],
      ['🕘 ' + T('horario'), function (l) { return l && l.horario || '—'; }],
      ['🎟 ' + T('cmpComprar'), function (l) { return l && l.reserva || '—'; }],
      ['🌦 ' + T('cmpTempo'), function (l) { var t = tipoTempo(l); return [t ? T('tempoTipo_' + t) : '', l && l.chuva || ''].filter(Boolean).join(' ') || '—'; }, 'tempo']
    ];
    var tab = h('table', { class: 'comparar' });
    tab.appendChild(h('tr', {}, [h('th', {})].concat(its.map(function (it) { return h('th', { scope: 'col', texto: it.titulo }); }))));
    var celTempo = [];
    linhas.forEach(function (ln) {
      tab.appendChild(h('tr', {}, [h('th', { scope: 'row', texto: ln[0] })].concat(ls.map(function (l, i) {
        var td = h('td', {}, comLinks(ln[1](l))); if (ln[2]) celTempo[i] = td; return td; }))));
    });
    tab.appendChild(h('tr', {}, [h('th', { scope: 'row', texto: '🔗 ' + T('site') })].concat(ls.map(function (l, i) {
      var u = l && (l.compra || l.site) || ((its[i].nota || '').match(RE_LINK) || [])[0];
      return h('td', {}, u ? h('a', { href: u, target: '_blank', rel: 'noopener', texto: T('abrirSite') + ' ↗' }) : '—'); }))));
    janela('⚖ ' + T('compararAlt'), h('div', {}, [h('div', { class: 'comparar-caixa' }, tab), h('p', { class: 'pequeno', style: 'margin-top:.6rem', texto: T('cmpRodape') })]));
    var c = centroViagem(), per = Clima.periodoDaHora(its[0].hora);
    if (c && per) Clima.porHora(c.lat, c.lng).then(function (res) {
      var p = Clima.periodo(res.horas, data, per); if (!p) return;
      ls.forEach(function (l, i) {
        var r = Clima.risco(tipoTempo(l), p);
        if (celTempo[i]) celTempo[i].appendChild(h('div', { class: r ? 'aviso' : 'bom', texto: r ? r.icone + ' ' + T(r.chave, { per: T(NOME_PERIODO[per]).toLowerCase() }) : '✓ ' + T('tempoOk') }));
      });
    }).catch(function () {});
  }
  /* calendário (.ics): abre no Google Agenda, no calendário do iPhone e no Outlook */
  function icsEsc(t) { return String(t == null ? '' : t).replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\r?\n/g, '\\n'); }
  function icsData(dataIso, hora) { return dataIso.replace(/-/g, '') + 'T' + String(hora || '09:00').replace(':', '') + '00'; }
  function montarIcs(eventos) {
    var agora = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GuiaXpert//PT', 'CALSCALE:GREGORIAN'];
    eventos.forEach(function (e, i) {
      L.push('BEGIN:VEVENT', 'UID:gx-' + Date.now() + '-' + i + '@solverone.com.br', 'DTSTAMP:' + agora, 'DTSTART:' + e.ini, 'DTEND:' + e.fim, 'SUMMARY:' + icsEsc(e.titulo));
      if (e.local) L.push('LOCATION:' + icsEsc(e.local));
      if (e.texto) L.push('DESCRIPTION:' + icsEsc(e.texto));
      if (e.alarme != null) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.titulo), 'TRIGGER:-PT' + e.alarme + 'M', 'END:VALARM');
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n');
  }
  /* o roteiro inteiro (opção aberta + compromissos fixos) no calendário, com aviso 1 h antes; sem códigos de reserva */
  function exportarCalendario(v, o) {
    var dias = diasDaViagem(v), evs = [];
    Banco.listar('reservas', function (r) { return r.viagem_id === v.id && r.agenda && r.agenda.quando && r.agenda.quando.length > 10; }).then(function (rs) {
      var vistos = {};
      rs.forEach(function (r) {
        var a = r.agenda, k = a.grupo || (r.tipo + '|' + a.quando); if (vistos[k]) return; vistos[k] = 1;
        var hm = a.quando.slice(11, 16), fimMin = minutos(hm) + 60;
        evs.push({ ini: icsData(a.quando.slice(0, 10), hm), fim: icsData(a.quando.slice(0, 10), hhmm(Math.min(fimMin, 1439))), titulo: '🔒 ' + a.titulo, local: a.local || '', alarme: 60 });
      });
      dias.forEach(function (dt, i) {
        var dm = o && o.dias[mapearDia(i, dias.length, o.dias.length)];
        ((dm && dm.itens) || []).forEach(function (it) {
          if (!it.hora || it.alt) return;
          var l = it.lugarId ? lugarPorId(it.lugarId) : null, fim = it.fim && it.fim > it.hora ? it.fim : hhmm(Math.min(minutos(it.hora) + 60, 1439));
          evs.push({ ini: icsData(dt, it.hora), fim: icsData(dt, fim), titulo: it.titulo, local: l ? (l.endereco || l.nome) : '', texto: it.nota || '', alarme: 60 });
        });
      });
      if (!evs.length) { avisar(T('calVazio')); return; }
      entregarArquivo(new Blob([montarIcs(evs)], { type: 'text/calendar' }), nomeArquivo(v.nome) + '.ics', 'text/calendar', T('calTitulo'));
    });
  }
  /* lembrete no calendário do celular: na véspera, às 19h, decidir (a previsão de 1 dia antes é a mais certa) */
  function lembreteDecidir(dmod, idxs, data) {
    var nomes = idxs.map(function (i) { return dmod.itens[i].titulo; });
    var d0 = dataDe(data); d0.setDate(d0.getDate() - 1);
    var ics = montarIcs([{ ini: icsData(iso(d0), '19:00'), fim: icsData(iso(d0), '19:15'), titulo: T('icsDecidir', { lista: nomes.join(' / ') }),
      texto: T('icsDecidirTexto', { dia: semana(data) + ' ' + fData(data, true) }), alarme: 0 }]);
    entregarArquivo(new Blob([ics], { type: 'text/calendar' }), 'decidir-' + data + '.ics', 'text/calendar', T('lembreteDecidir'));
  }
  /* tira o item na hora e oferece "Desfazer" por alguns segundos (toque errado no celular é o erro mais comum) */
  function tirarComDesfazer(o, di, idx) {
    var item = o.dias[di].itens.splice(idx, 1)[0];
    return Banco.gravar('roteiros', o).then(recarregarTela).then(function () {
      avisar(T('itemTirado', { t: item.titulo }), T('desfazer'), function () {
        Banco.ler('roteiros', o.id).then(function (r) {
          r = r || o; var dd = r.dias[di]; dd.itens = dd.itens || [];
          dd.itens.splice(Math.min(idx, dd.itens.length), 0, item);
          return Banco.gravar('roteiros', r);
        }).then(function () { avisar(T('itemVoltou')); recarregar(); });
      }, 8000);
    });
  }
  /* "✎ Esta opção": dar nome, copiar para ajustar, apagar (num lugar só, longe da estrela) */
  function janelaEstaOpcao(o) {
    var pacote = o.origem === 'pacote';
    var nome = h('input', { class: 'campo', id: 'gx-op-nome', maxlength: '60', value: o.nome || '' });
    var salvar = h('button', { class: 'bt', type: 'button', texto: T('salvarNome') });
    var j = janela(T('estaOpcao') + ': ' + o.nome, h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      pacote ? h('p', { class: 'sub', texto: T('opcaoProntaDica') }) : null,
      pacote ? null : h('label', { class: 'rot', for: 'gx-op-nome', texto: T('nomeDaOpcao') }), pacote ? null : nome, pacote ? null : salvar,
      h('button', { class: pacote ? 'bt' : 'bt leve', type: 'button', texto: '⧉ ' + T('duplicarOpcao'), onclick: function () {
        j.fechar(function () { janelaNomeOpcao(T('copiaDe', { nome: o.nome }), function (n) {
          return Banco.gravar('roteiros', { viagem_id: o.viagem_id, nome: n, origem: 'manual', base_id: null, favorito: false, ordem: (o.ordem || 0) + 0.5, dias: JSON.parse(JSON.stringify(o.dias)) });
        }); });
      } }),
      pacote ? null : h('button', { class: 'bt leve perigo-txt', type: 'button', texto: '🗑 ' + T('apagarOpcao'), onclick: function () { j.fechar(function () { apagarOpcao(o); }); } })
    ]));
    salvar.addEventListener('click', function () {
      var n = nome.value.trim(); if (!n) { nome.focus(); return; }
      o.nome = n; Banco.gravar('roteiros', o).then(function () { j.fechar(); avisar(T('salvo')); recarregar(); });
    });
    nome.addEventListener('keydown', function (e) { if (e.key === 'Enter') salvar.click(); });
  }
  /* pede o nome e cria a opção; depois abre a opção nova e mostra onde ela está */
  function janelaNomeOpcao(sugestao, criar) {
    var nome = h('input', { class: 'campo', id: 'gx-op-novo', maxlength: '60', value: sugestao });
    var ok = h('button', { class: 'bt', type: 'button', texto: T('criarOpcao') });
    var j = janela(T('nomeDaOpcao'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { class: 'sub', texto: T('nomeDaOpcaoDica') }), nome, ok]));
    setTimeout(function () { nome.select(); }, 60);
    var feito = false;
    ok.addEventListener('click', function () {
      var n = nome.value.trim(); if (!n) { nome.focus(); return; }
      if (feito) return; feito = true; ok.disabled = true;
      criar(n).then(function (r) { estado.viagem.opcao_ativa = r.id; return Banco.gravar('viagens', estado.viagem); })
        .then(function () { j.fechar(); return recarregar(); }).then(function () { avisar(T('opcaoCriada', { nome: n })); });
    });
    nome.addEventListener('keydown', function (e) { if (e.key === 'Enter') ok.click(); });
  }

  /* "fecharAntes": dentro de uma janela, fecha a janela primeiro e só depois age
     (senão a ação abriria outra janela e o fechar levaria a nova embora) */
  function botoesNovaOpcao(fecharAntes) {
    var agir = function (fn) { return function () { if (fecharAntes) fecharAntes(fn); else fn(); }; };
    var g = h('div', { class: 'grade' });
    if (estado.pacote && estado.pacote.roteiros.length) g.appendChild(h('button', { class: 'bt', type: 'button', onclick: agir(function () {
      criarOpcoesDoPacote(estado.viagem, estado.pacote).then(recarregar); }) }, T('usarDoPacote', { n: estado.pacote.roteiros.length })));
    g.appendChild(h('button', { class: 'bt sec', type: 'button', onclick: agir(gerarComIA) }, '✨ ' + T('gerarIA')));
    g.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: agir(function () { janelaNomeOpcao(T('meuRoteiro') + ' ' + (estado.roteiros.length + 1), criarOpcaoEmBranco); }) }, T('emBranco')));
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
  function criarOpcaoEmBranco(nome) {
    var v = estado.viagem, n = diasDaViagem(v).length;
    var dias = []; for (var i = 0; i < n; i++) dias.push({ ordem: i + 1, titulo: '', itens: [] });
    var maior = estado.roteiros.reduce(function (m, r) { return Math.max(m, r.ordem || 0); }, 99);
    return Banco.gravar('roteiros', { viagem_id: v.id, nome: nome || (T('meuRoteiro') + ' ' + (estado.roteiros.length + 1)), origem: 'manual', favorito: false, ordem: maior + 1, dias: dias });
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
          lista.appendChild(h('p', { class: 'sub', texto: T('nadaPertoDaViagem') }));
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
  /* "é uma alternativa?": várias opções no mesmo horário, ainda sem decidir */
  function campoAlternativa(id, marcado) {
    var c = h('input', { type: 'checkbox', id: id }); c.checked = !!marcado;
    return { el: h('div', { class: 'linha campo-alt', style: 'flex-wrap:nowrap;align-items:flex-start;gap:.5rem' }, [c, h('label', { for: id }, [h('b', { texto: '🔀 ' + T('ehAlternativa') }), h('span', { class: 'pequeno', style: 'display:block', texto: T('ehAlternativaDica') })])]), chk: c };
  }
  function janelaItem(o, dmod) {
    var hora = campoHora('gx-item-hora'), fim = campoHora('gx-item-fim');
    var alt = campoAlternativa('gx-item-alt');
    var tit = h('input', { class: 'campo', type: 'text', id: 'gx-item-tit', maxlength: '100', placeholder: T('exItem') });
    var sel = h('select', { class: 'campo', id: 'gx-item-lugar' }, [h('option', { value: '' }, T('semLugar'))].concat(
      todosLugares().slice().sort(function (a, b) { return a.nome < b.nome ? -1 : 1; }).map(function (l) { return h('option', { value: l.id }, l.nome); })));
    var ok = h('button', { class: 'bt', type: 'button' }, T('adicionar'));
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('div', { class: 'dois' }, [h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.3rem' }, [h('label', { class: 'rot', for: 'gx-item-hora', texto: T('hora') }), hora]),
        h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.3rem' }, [h('label', { class: 'rot', for: 'gx-item-fim', texto: T('ateHora') }), fim])]),
      h('label', { class: 'rot', for: 'gx-item-tit', texto: T('oQue') }), tit,
      h('label', { class: 'rot', for: 'gx-item-lugar', texto: T('lugarOpcional') }), campoLugarComBusca(sel, function (n) { if (!tit.value) tit.value = n.nome; }), alt.el, ok]);
    var j = janela(T('addItem'), corpo);
    sel.addEventListener('change', function () { if (sel.value && !tit.value) tit.value = lugarPorId(sel.value).nome; });
    ok.addEventListener('click', function () {
      if (!tit.value.trim()) { tit.focus(); avisar(T('faltaOque')); return; }
      if (lerHora(hora) == null || lerHora(fim) == null) return;
      addItemNaOpcao(o, dmod, { fim: fim.value || undefined, hora: hora.value, titulo: tit.value.trim(), nota: null, tipo: null, lugarId: sel.value || null, alt: alt.chk.checked || undefined }).then(function () { j.fechar(); recarregar(); });
    });
  }
  /* editar um item do dia: hora, o que, nota, lugar; ver no mapa; tirar */
  function janelaEditarItem(o, dmod, idx) {
    var it = dmod.itens[idx], l = it.lugarId ? lugarPorId(it.lugarId) : null;
    var hora = campoHora('gx-ed-hora', it.hora || ''), fim = campoHora('gx-ed-fim', it.fim || '');
    var alt = campoAlternativa('gx-ed-alt', it.alt);
    var diasV = diasDaViagem(estado.viagem), diAtual = o.dias.indexOf(dmod);
    var selDia = h('select', { class: 'campo', id: 'gx-ed-dia' }, diasV.map(function (dt, i) {
      return h('option', { value: String(i), selected: i === estado.dia }, semana(dt) + ', ' + fData(dt)); }));
    var tit = h('input', { class: 'campo', type: 'text', id: 'gx-ed-tit', maxlength: '100', value: it.titulo || '' });
    var nota = h('input', { class: 'campo', type: 'text', id: 'gx-ed-nota', maxlength: '200', value: it.nota || '', placeholder: T('exNotaItem') });
    var sel = h('select', { class: 'campo', id: 'gx-ed-lugar' }, [h('option', { value: '' }, T('semLugar'))].concat(
      todosLugares().slice().sort(function (a, b) { return a.nome < b.nome ? -1 : 1; }).map(function (x) { return h('option', { value: x.id, selected: x.id === it.lugarId }, x.nome); })));
    var ok = h('button', { class: 'bt', type: 'button' }, T('salvar'));
    var tirar = h('button', { class: 'bt perigo', type: 'button' }, T('tirarItem'));
    /* comprou o ingresso: guarda em Reservas já com dia, hora e lugar; vira compromisso fixo 🔒 no roteiro */
    var comprei = h('button', { class: 'bt sec', type: 'button', texto: '🎟 ' + T('jaComprei'), onclick: function () {
      var dt = diasDaViagem(estado.viagem)[estado.dia] || estado.viagem.inicio;
      j.fechar(function () { janelaReserva({ c: { tipo: 'ingresso', titulo: it.titulo, quando: dt + 'T' + (normHora(hora.value) || it.hora || '09:00'), local: l ? (l.endereco || l.nome) : '' } }); });
    } });
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('div', { class: 'dois' }, [h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.3rem' }, [h('label', { class: 'rot', for: 'gx-ed-dia', texto: T('dia') }), selDia]),
        h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.3rem' }, [h('label', { class: 'rot', for: 'gx-ed-hora', texto: T('hora') }), hora])]),
      h('label', { class: 'rot', for: 'gx-ed-fim', texto: T('ateHora') }), fim,
      h('label', { class: 'rot', for: 'gx-ed-tit', texto: T('oQue') }), tit,
      h('label', { class: 'rot', for: 'gx-ed-nota', texto: T('nota') }), nota,
      h('label', { class: 'rot', for: 'gx-ed-lugar', texto: T('lugarOpcional') }), campoLugarComBusca(sel, function (n) { if (!tit.value.trim()) tit.value = n.nome; }), alt.el,
      l ? h('div', { class: 'linha' }, [h('button', { class: 'bt sec', type: 'button', texto: '🗺 ' + T('verNoMapa'), onclick: function () { estado.abrirLugar = l.id; estado.filtro = 'todos'; j.fechar(function () { Nav.ir('mapa'); }); } }),
        h('a', { class: 'bt leve', href: Geo.linkRota(l, estado.pos), target: '_blank', rel: 'noopener' }, T('rota'))]) : null,
      h('p', { class: 'pequeno', texto: T('jaCompreiDica') }), comprei,
      h('div', { class: 'acoes' }, [tirar, ok])]);
    var j = janela(T('editarItem'), corpo);
    if (!podeEditar()) { ok.disabled = true; tirar.disabled = true; }
    ok.addEventListener('click', function () {
      if (!tit.value.trim()) { tit.focus(); avisar(T('faltaOque')); return; }
      if (lerHora(hora) == null || lerHora(fim) == null) return;
      var novoDia = +selDia.value, destino = mapearDia(novoDia, diasV.length, o.dias.length), mudouDia = destino !== diAtual;
      mudarItem(o, dmod, idx, function (item) { item.hora = hora.value; item.titulo = tit.value.trim(); item.nota = nota.value.trim() || null; item.lugarId = sel.value || null; item.alt = alt.chk.checked || undefined; item.fim = fim.value || undefined; })
        .then(function (alvo) {
          if (mudouDia) {   /* mudar de dia: sai de um, entra no outro, na ordem da hora */
            var item = alvo.dias[diAtual].itens.splice(idx, 1)[0];
            while (alvo.dias.length <= destino) alvo.dias.push({ ordem: alvo.dias.length + 1, titulo: '', itens: [] });
            (alvo.dias[destino].itens = alvo.dias[destino].itens || []).push(item);
          }
          alvo.dias.forEach(function (dd) { (dd.itens || []).sort(function (a, b) { return (a.hora || '99') < (b.hora || '99') ? -1 : 1; }); });
          return Banco.gravar('roteiros', alvo);
        })
        .then(function () { j.fechar(); avisar(mudouDia ? T('itemMudouDia', { dia: semana(diasV[novoDia]) + ' ' + fData(diasV[novoDia], true) }) : T('salvo')); recarregar(); });
    });
    tirar.addEventListener('click', function () {
      mudarItem(o, dmod, idx, function () {}).then(function (alvo) { j.fechar(function () { tirarComDesfazer(alvo, diAtual, idx); }); });
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
  /* IA de verdade para ESTA pessoa? (1) chave própria no aparelho, ou (2) chave guardada no servidor (Vault) e a pessoa
     é da equipe ou foi convidada para uma viagem dela ("da família"). Sem isso, o botão ✦ IA nem aparece. */
  function temChavePropria() {
    try { var c = JSON.parse(localStorage.getItem('dgo:global:chaves-ia') || '{}') || {}; return Object.keys(c).some(function (k) { return !!c[k]; }); } catch (e) { return false; }
  }
  function iaParaMim() {
    if (temChavePropria()) return true;
    var x = null; try { x = JSON.parse(localStorage.getItem('guiaxpert.iaServidor') || 'null'); } catch (e) {}
    var uid = (function () { try { return JSON.parse(atob(String((Conta.sessao() || {}).access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch (e) { return null; } })();
    return !!(x && x.ok && uid && x.uid === uid);
  }
  function conferirIA() {
    if (!window.Conta || !Conta.sessao() || !navigator.onLine) return Promise.resolve(iaParaMim());
    var uid = null; try { uid = JSON.parse(atob(String(Conta.sessao().access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch (e) {}
    return Conta.rpc('ia_disponivel', {}).then(function (r) {
      var x = Array.isArray(r) ? r[0] : r;
      try { localStorage.setItem('guiaxpert.iaServidor', JSON.stringify({ uid: uid, ok: !!(x && x.disponivel), em: Date.now() })); } catch (e) {}
      botaoAssistente();
      return iaParaMim();
    }).catch(function () { return iaParaMim(); });
  }
  /* no celular, o botão ✦ IA some enquanto a pessoa rola (para não cobrir ✓ e ✕) e volta quando ela para */
  var relogioRolar = null;
  window.addEventListener('scroll', function () {
    d.body.classList.add('rolando'); clearTimeout(relogioRolar);
    relogioRolar = setTimeout(function () { d.body.classList.remove('rolando'); }, 900);
  }, { passive: true });
  function botaoAssistente() {
    var antigo = $('bt-assistente');
    if (!iaParaMim()) { if (antigo) antigo.remove(); return; }
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
        /* alternativas ainda não decididas não entram no trajeto numerado do dia */
        return (dmod && dmod.itens || []).filter(function (it) { return it.lugarId && !it.alt; });
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
  /* Salvos: fora de viagem, os lugares guardados sem viagem. Dentro da viagem vira "Ideias da viagem":
     tudo o que a pessoa marcou com ⭐ ou guardou (da internet ou à mão), num lugar só, sem dia ainda.
     Filtros que se combinam: tipo (comer, passeio…) e cidade (Gramado, Canela…). Cada ideia tem "Pôr no dia". */
  var filtroIdeias = { tipo: 'todos', cidade: 'todas' };
  /* cidade de um lugar: o campo cidade, ou uma cidade conhecida do destino (do catálogo e do nome do pacote) no nome/endereço */
  function cidadeDoLugar(l) {
    if (l.cidade) return l.cidade;
    var conhecidas = {};
    todosLugares().forEach(function (x) { if (x.cidade) conhecidas[x.cidade] = 1; });
    if (estado.pacote) String(Pacotes.nome(estado.pacote, 'pt') || '').split(/\s+e\s+|,\s*/).forEach(function (c) { if (c.trim()) conhecidas[c.trim()] = 1; });
    var txt = normalizar((l.nome || '') + ' | ' + (l.endereco || '')), achou = '', pos = -1;
    Object.keys(conhecidas).forEach(function (c) { var i = txt.lastIndexOf(normalizar(c)); if (i > pos) { pos = i; achou = c; } });
    return achou;
  }
  function ideiasDaViagem() {
    var v = estado.viagem, vistos = {}, out = [];
    Object.keys(estado.favoritos).forEach(function (k) {
      var f = estado.favoritos[k]; if (f.tipo !== 'lugar') return;
      if (f.viagem_id && v && f.viagem_id !== v.id) return;
      var l = lugarPorId(f.ref); if (l && !vistos[l.id]) { vistos[l.id] = 1; out.push(l); }
    });
    estado.lugaresProprios.forEach(function (l) { if (v && l.viagem_id === v.id && !vistos[l.id]) { vistos[l.id] = 1; out.push(l); } });
    return out;
  }
  /* palavras úteis de um link: ".../serra-gaucha/parque-do-caracol" → "serra gaucha parque do caracol" */
  function palavrasDoLink(u) {
    try { var x = new URL(u); } catch (e) { return ''; }
    if (/instagram|facebook|tiktok|youtu|wa\.me|whatsapp/i.test(x.hostname)) return '';
    return decodeURIComponent(x.pathname).split(/[\/\-_.+]+/).filter(function (w) { return w.length > 2 && !/^(html?|php|aspx?|www|reel|p|pt|br|en|index|produto|produtos|ingresso|ingressos|tour|passeio|passeios)$/i.test(w) && !/^\d+$/.test(w); }).join(' ');
  }
  /* a ideia já está no roteiro aberto? "Sex 20/Nov 09:30 (alternativa)" */
  function ondeNoRoteiro(lugarId) {
    var o = estado.opcao, v = estado.viagem; if (!o || !v) return null;
    var dias = diasDaViagem(v);
    for (var i = 0; i < dias.length; i++) {
      var dm = o.dias[mapearDia(i, dias.length, o.dias.length)], it = (dm && dm.itens || []).filter(function (x) { return x.lugarId === lugarId; })[0];
      if (it) return T('noRoteiro', { dia: semana(dias[i]) + ' ' + fData(dias[i], true) + (it.hora ? ' ' + it.hora : '') }) + (it.alt ? ' (' + T('altCurto') + ')' : '');
    }
    return null;
  }
  /* "＋ Ideia por link": a pessoa cola o link (Instagram, site de ingresso, blog); o app procura o lugar no catálogo
     pelo próprio link ou pelo nome que ela digitar, guarda como ⭐ ideia e deixa o link junto (abre com um toque) */
  function janelaIdeiaPorLink() {
    var link = h('input', { class: 'campo', id: 'gx-il-link', type: 'url', placeholder: 'https://…', autocomplete: 'off' });
    var nome = h('input', { class: 'campo', id: 'gx-il-nome', placeholder: T('ilNomeEx'), autocomplete: 'off' });
    var bt = h('button', { class: 'bt', type: 'button', texto: '🔎 ' + T('ilProcurar') });
    var res = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.5rem' });
    var j = janela('🔗 ' + T('ilTitulo'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { class: 'sub', texto: T('ilDica') }), h('label', { class: 'rot', for: 'gx-il-link', texto: T('ilLink') }), link,
      h('label', { class: 'rot', for: 'gx-il-nome', texto: T('ilNome') }), nome, bt, res]));
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { if (/^https?:\/\//.test((t || '').trim()) && !link.value) link.value = t.trim(); }).catch(function () {});
    function guardar(l) {
      var u = link.value.trim();
      var id = 'lugar:' + l.id, ja = estado.favoritos[id];
      var reg = Object.assign({}, ja || { id: id, tipo: 'lugar', ref: l.id, nome: l.nome, viagem_id: estado.viagem ? estado.viagem.id : null }, u ? { link: u } : {});
      return Banco.gravar('favoritos', reg).then(function (r) { estado.favoritos[id] = r; j.fechar(); avisar(T('ilGuardada', { nome: l.nome })); mostrar('salvos'); });
    }
    bt.addEventListener('click', function () {
      var pal = palavrasDoLink(link.value.trim()), nm = nome.value.trim(), q = [nm, pal].filter(Boolean).join(' ');
      res.textContent = '';
      if (!q) { res.appendChild(h('p', { class: 'alerta', texto: T('ilPrecisaNome') })); nome.focus(); return; }
      /* tenta: o nome digitado; o último pedaço do link (".../parque-do-caracol"); pedaços de 2 e 3 palavras do link */
      var ws = pal.split(' ').filter(Boolean), tentativas = [nm, ws.slice(-3).join(' '), ws.slice(-2).join(' ')];
      for (var i = 0; i + 1 < ws.length; i++) { tentativas.push(ws.slice(i, i + 2).join(' ')); if (i + 2 < ws.length) tentativas.push(ws.slice(i, i + 3).join(' ')); }
      tentativas = tentativas.filter(function (t, i, a) { return t && a.indexOf(t) === i; });
      var achados = todosLugares().map(function (l) { return { l: l, n: tentativas.reduce(function (m, t) { return Math.max(m, notaBusca(l, t)); }, 0) }; })
        .filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 3);
      if (achados.length) res.appendChild(h('p', { class: 'sub', texto: T('eEsse') + '?' }));
      achados.forEach(function (x) {
        res.appendChild(h('button', { class: 'bt-grande', type: 'button', onclick: function () { guardar(x.l); } }, [h('span', { class: 'ic-grande', 'aria-hidden': 'true', texto: '⭐' }),
          h('span', { class: 'tx' }, [h('b', { texto: x.l.nome }), h('small', { texto: [cidadeDoLugar(x.l), x.l.descricao].filter(Boolean).join(' · ').slice(0, 90) })])]));
      });
      res.appendChild(h('button', { class: 'bt leve', type: 'button', texto: '🤝 ' + T(achados.length ? 'naoEnenhum' : 'acharJuntos'), onclick: function () {
        var u = link.value.trim(), nm = nome.value.trim() || q;
        j.fechar(function () { janelaAcharJuntos(nm, function (n) {
          if (u) { n.descricao = [n.descricao, u].filter(Boolean).join(' · '); Banco.gravar('lugares', n); }
          mostrar('salvos');
        }); });
      } }));
    });
    nome.addEventListener('keydown', function (e) { if (e.key === 'Enter') bt.click(); });
  }
  TELAS.salvos = function (tela) {
    var restr = restricoesDoGrupo();
    if (!emViagem() || !estado.viagem) {
      tela.appendChild(h('h1', { texto: T('rota_salvos') }));
      tela.appendChild(h('p', { class: 'sub', texto: T('salvosTexto') }));
      var ls0 = estado.lugaresProprios.filter(function (l) { return !l.viagem_id; });
      if (!ls0.length) tela.appendChild(h('p', { class: 'sub', texto: T('semSalvos') }));
      ls0.forEach(function (l) { tela.appendChild(cartaoLugar(l, restr)); });
      return;
    }
    tela.appendChild(h('h1', { texto: '⭐ ' + T('rota_ideias') }));
    tela.appendChild(h('p', { class: 'sub' }, [h('b', { texto: (estado.viagem.tipo === 'passeio' ? '🚶 ' : '🧳 ') + estado.viagem.nome }), ' · ' + T('ideiasTexto')]));
    tela.appendChild(h('div', { class: 'linha' }, [h('button', { class: 'bt sec', type: 'button', texto: '🔗 ' + T('ilTitulo'), onclick: janelaIdeiaPorLink })]));
    var todas = ideiasDaViagem();
    if (!todas.length) {
      tela.appendChild(h('div', { class: 'cartao' }, [h('b', { texto: T('ideiasVazio') }), h('p', { class: 'sub', texto: T('ideiasVazioDica') }),
        h('button', { class: 'bt', type: 'button', texto: '🗺 ' + T('irAoMapa'), onclick: function () { Nav.ir('mapa'); } })]));
      return;
    }
    var GRUPO = { comer: 'comer', doces: 'comer', bebidas: 'comer', atracao: 'passeio', logistica: 'outro' };
    var tipos = ['todos'].concat(['comer', 'passeio', 'outro'].filter(function (t) { return todas.some(function (l) { return (GRUPO[l.categoria] || 'outro') === t; }); }));
    var cidades = []; todas.forEach(function (l) { var c = cidadeDoLugar(l); if (c && cidades.indexOf(c) < 0) cidades.push(c); });
    var lista = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.6rem' });
    var linhaTipos = h('div', { class: 'chips rolar', role: 'group', 'aria-label': T('tipo') });
    var linhaCidades = h('div', { class: 'chips rolar', role: 'group', 'aria-label': T('cidade') });
    function chip(grupo, valor, rotulo, linha) {
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': filtroIdeias[grupo] === valor ? 'true' : 'false', onclick: function () { filtroIdeias[grupo] = valor; desenhar(); } }, rotulo);
    }
    function desenhar() {
      linhaTipos.textContent = ''; linhaCidades.textContent = '';
      tipos.forEach(function (t) { linhaTipos.appendChild(chip('tipo', t, t === 'todos' ? T('f_todos') : T('ideia_' + t))); });
      if (cidades.length > 1) ['todas'].concat(cidades).forEach(function (c) { linhaCidades.appendChild(chip('cidade', c, c === 'todas' ? T('todasCidades') : '📍 ' + c)); });
      lista.textContent = '';
      var ls = todas.filter(function (l) {
        return (filtroIdeias.tipo === 'todos' || (GRUPO[l.categoria] || 'outro') === filtroIdeias.tipo) &&
          (filtroIdeias.cidade === 'todas' || cidadeDoLugar(l) === filtroIdeias.cidade);
      });
      lista.appendChild(h('p', { class: 'pequeno', texto: ls.length === 1 ? T('umaIdeia') : T('nIdeias', { n: ls.length }) }));
      ls.forEach(function (l) {
        var card = cartaoLugar(l, restr), f = estado.favoritos['lugar:' + l.id];
        var noDia = ondeNoRoteiro(l.id);
        if (noDia) card.querySelector('summary').appendChild(h('span', { class: 'etq no-roteiro', style: 'grid-column:1/-1;justify-self:start', texto: '📅 ' + noDia }));
        if (f && f.link) {
          var a = h('a', { href: f.link, target: '_blank', rel: 'noopener', texto: '🔗 ' + f.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 42) + (f.link.length > 50 ? '…' : '') });
          card.querySelector('summary').appendChild(h('span', { class: 'pequeno', style: 'grid-column:1/-1' }, a));
        }
        lista.appendChild(card);
      });
    }
    if (filtroIdeias.cidade !== 'todas' && cidades.indexOf(filtroIdeias.cidade) < 0) filtroIdeias.cidade = 'todas';
    tela.appendChild(linhaTipos); tela.appendChild(linhaCidades); tela.appendChild(lista);
    desenhar();
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
    if (l.descricao) corpo.appendChild(h('p', { class: 'sub' }, comLinks(l.descricao)));
    [['endereco', l.endereco], ['horario', l.horario], ['reserva', l.reserva], ['preco', l.preco], ['criancas', l.criancas], ['comChuva', l.chuva], ['telefone', l.telefone]].forEach(function (kv) {
      if (kv[1]) corpo.appendChild(h('div', { class: 'kv' }, [h('span', { texto: T(kv[0]) }), h('span', { texto: kv[1] })]));
    });
    if (l.categoria === 'comer' && restr.length) corpo.appendChild(h('div', { class: 'alerta' }, [h('b', { texto: T('restricoesGrupo') }), restr.join(', ') + '. ' + T('pergunteAntes')]));
    if (l.dieta) { var dd = Object.keys(l.dieta).filter(function (k) { return l.dieta[k]; }); if (dd.length) corpo.appendChild(h('p', { class: 'pequeno', texto: T('osmDieta') + ': ' + dd.map(function (k) { return T('r_' + k); }).join(', ') })); }
    corpo.appendChild(linksLugar(l));
    if (estado.viagem && estado.opcao && podeEditar()) corpo.appendChild(h('button', { class: 'bt', type: 'button', onclick: function () { janelaAddAoRoteiro(l); } }, '＋ ' + T('porNoDia')));
    if (!estado.viagem && window.Explorar) Explorar.acoes(l, corpo);
    else if ((l.confianca === 'osm' || l.confianca === 'foursquare' || l.confianca === 'tripadvisor') && !estado.lugaresProprios.some(function (x) { return x.id === l.id; })) corpo.appendChild(h('button', { class: 'bt leve', type: 'button', onclick: function () {
      Banco.gravar('lugares', Object.assign({}, l, { viagem_id: estado.viagem.id })).then(function () { avisar(T('salvo')); recarregar(); }); } }, T('salvarLugar')));
    if (estado.lugaresProprios.some(function (x) { return x.id === l.id; })) corpo.appendChild(h('div', { class: 'linha' }, [
      h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaNovoLugar(l); } }, '✎ ' + T('editarLugar')),
      h('button', { class: 'bt perigo', type: 'button', onclick: function () { Banco.apagar('lugares', l.id).then(recarregar); } }, T('tirarDaLista'))]));
    corpo.appendChild(h('p', { class: 'pequeno', texto: T('conf_' + (l.confianca || 'baixa')) }));
    det.appendChild(corpo);
    return det;
  }
  function linksLugar(l) {
    var lk = function (href, txt, cls) { return h('a', { class: 'bt ' + (cls || 'leve'), href: href, target: '_blank', rel: 'noopener' }, txt); };
    var g = h('div', { class: 'linha' }, [
      lk(Geo.linkRota(l, estado.pos), T('rota'), ''), lk(Geo.linkWaze(l), 'Waze'), lk(Geo.linkMapa(l), T('verMapa')),
      l.compra && /^https?:\/\//.test(l.compra) ? lk(l.compra, '🎟 ' + T('comprarIngresso'), 'sec') : null,
      l.site && /^https?:\/\//.test(l.site) ? lk(l.site, T('siteOficial')) : null,
      l.telefone ? h('span', { class: 'pequeno', texto: '☎ ' + l.telefone }) : null
    ]);
    var dh = doHotelTexto(l);
    if (dh) g.appendChild(h('span', { class: 'pequeno', texto: dh }));
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
    var hx = /(\d{1,2})h(\d{2})?/.exec(l.horario || '');
    var hora = campoHora('gx-add-hora', !horarioAberto(l.horario) && hx ? normHora(hx[1] + ':' + (hx[2] || '00')) : '');
    var alt = campoAlternativa('gx-add-alt');
    var ok = h('button', { class: 'bt', type: 'button' }, T('adicionar'));
    var j = janela(T('addAoRoteiro') + ': ' + l.nome, h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { class: 'sub', texto: T('naOpcao', { nome: estado.opcao.nome }) }),
      h('label', { class: 'rot', for: 'gx-add-dia', texto: T('dia') }), sel, h('label', { class: 'rot', for: 'gx-add-hora', texto: T('hora') }), hora, alt.el, ok]));
    ok.addEventListener('click', function () {
      if (lerHora(hora) == null) return;
      var i = +sel.value, o = estado.opcao, dmod = o.dias[mapearDia(i, dias.length, o.dias.length)];
      addItemNaOpcao(o, dmod, { hora: hora.value, titulo: l.nome, nota: null, tipo: l.gratis ? 'gratis' : null, lugarId: l.id, alt: alt.chk.checked || undefined }).then(function () { j.fechar(); avisar(T('adicionado')); recarregar(); });
    });
  }
  /* lugar novo à mão, ou editar um lugar meu (ex: endereço que estava errado, site, onde comprar) */
  function janelaNovoLugar(ex) {
    ex = ex && ex.id ? ex : null;
    var nome = h('input', { class: 'campo', id: 'gx-nl-nome', maxlength: '80', placeholder: T('exLugar'), value: ex ? ex.nome : '' });
    var cat = h('select', { class: 'campo', id: 'gx-nl-cat' }, ['comer', 'atracao', 'bebidas', 'doces', 'logistica'].map(function (c) { return h('option', { value: c, selected: ex && ex.categoria === c }, T('cat_' + c)); }));
    var end = h('input', { class: 'campo', id: 'gx-nl-end', maxlength: '160', placeholder: T('exEndereco'), value: ex && ex.endereco || '' });
    var site = h('input', { class: 'campo', id: 'gx-nl-site', type: 'url', maxlength: '300', placeholder: 'https://…', value: ex && ex.site || '' });
    var nota = h('input', { class: 'campo', id: 'gx-nl-nota', maxlength: '300', placeholder: T('exNota'), value: ex && ex.descricao || '' });
    var aqui = h('button', { class: 'bt leve', type: 'button' }, '📍 ' + T('usarOndeEstou'));
    var achar = h('button', { class: 'bt leve', type: 'button' }, '🔎 ' + T('acharNoMapa'));
    var marcar = h('button', { class: 'bt leve', type: 'button' }, '🗺 ' + T('marcarNoMapa'));
    var ok = h('button', { class: 'bt', type: 'button' }, T('salvar'));
    var pos = ex && ex.lat != null ? { lat: ex.lat, lng: ex.lng, precisao: 1 } : null;
    var j = janela(T(ex ? 'editarLugar' : 'novoLugar'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      ex ? null : h('p', { class: 'sub', texto: T('novoLugarDica') }),
      h('label', { class: 'rot', for: 'gx-nl-nome', texto: T('nome') }), nome, h('label', { class: 'rot', for: 'gx-nl-cat', texto: T('tipoLugar') }), cat,
      h('label', { class: 'rot', for: 'gx-nl-end', texto: T('endereco') }), end, h('div', { class: 'linha' }, [achar, marcar, aqui]),
      h('label', { class: 'rot', for: 'gx-nl-site', texto: T('siteOndeComprar') }), site,
      h('label', { class: 'rot', for: 'gx-nl-nota', texto: T('nota') }), nota, ok]));
    if (pos) achar.textContent = '✓ ' + T('pontoMarcado');
    marcar.addEventListener('click', function () {
      Mapa.escolherPonto({ centro: pos || estado.pos || centroViagem(), zoom: pos ? 16 : 14, cidade: estado.viagem && estado.viagem.destino, titulo: T('marcarNoMapa') })
        .then(function (p) { if (p) { pos = { lat: p.lat, lng: p.lng, precisao: 1 }; achar.textContent = '✓ ' + T('pontoMarcado'); } });
    });
    aqui.addEventListener('click', function () { pegarPosicao().then(function (p) { pos = p; aqui.textContent = '📍 ✓ ±' + p.precisao + ' m'; }); });
    /* o tipo que a pessoa escolheu não muda sozinho; mudou nome ou endereço, o ponto achado antes deixa de valer */
    var catMexido = false; cat.addEventListener('change', function () { catMexido = true; });
    function esquecerPonto() { if (pos && pos.precisao === 0) { pos = null; achar.textContent = '🔎 ' + T('acharNoMapa'); } }
    nome.addEventListener('input', esquecerPonto); end.addEventListener('input', esquecerPonto);
    achar.addEventListener('click', function () {
      var n = nome.value.trim(), e = end.value.trim();
      if (!n && !e) { nome.focus(); return; }
      achar.disabled = true; achar.textContent = T('carregando');
      var c = estado.pos || centroViagem(), uf = estado.pacote && estado.pacote.uf;
      /* tenta nome + endereço; depois só o endereço; depois o endereço com o estado (RS). Só vale o que fica perto da viagem */
      var tentativas = [[n, e].filter(Boolean).join(', '), e, e && uf ? e + ', ' + uf + ', Brasil' : ''].filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      tentativas.reduce(function (pr, q) { return pr.then(function (achou) { return achou || Descobrir.buscarNome(q, c, idioma()).then(function (ls) { return ls[0] || null; }); }); }, Promise.resolve(null)).then(function (l) {
        achar.disabled = false;
        if (!l) { achar.textContent = '🔎 ' + T('nadaPertoDaViagem'); avisar(T('marqueNoMapaDica')); return; }
        pos = { lat: l.lat, lng: l.lng, precisao: 0 };
        if (!end.value.trim() && l.endereco) end.value = l.endereco;
        if (l.categoria && !catMexido) cat.value = l.categoria;
        achar.textContent = '✓ ' + (l.endereco || l.nome).slice(0, 40);
      }).catch(function () { achar.disabled = false; achar.textContent = '🔎 ' + T(navigator.onLine ? 'osmErro' : 'semInternet'); });
    });
    ok.addEventListener('click', function () {
      if (!nome.value.trim()) { nome.focus(); return; }
      var sv = site.value.trim(); if (sv && !/^https?:\/\//i.test(sv)) sv = 'https://' + sv;
      Banco.gravar('lugares', Object.assign({}, ex || {}, { nome: nome.value.trim(), categoria: cat.value, subcategoria: ex ? ex.subcategoria : null, descricao: nota.value.trim() || null, endereco: end.value.trim() || null,
        site: sv || null, lat: pos ? +pos.lat.toFixed(5) : null, lng: pos ? +pos.lng.toFixed(5) : null, confianca: 'meu', gratis: ex ? !!ex.gratis : false,
        viagem_id: ex ? ex.viagem_id : (estado.viagem ? estado.viagem.id : null) }))
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
  var TIPOS_RES = ['voo', 'hotel', 'carro', 'transfer', 'onibus', 'ingresso', 'passeio', 'restaurante', 'outro'];
  /* logística (chegar, dormir, ir embora): vira "etapa" recolhida, uma linha só, que abre com o chevron */
  var LOGISTICA = { voo: 1, hotel: 1, carro: 1, transfer: 1, onibus: 1 };
  var etapasAbertas = {}, diasAbertos = {};
  /* ＋ ao lado do dia: reserva nova nesse dia, ou atividade no roteiro desse dia (onde se edita o dia) */
  function janelaAddNoDia(v, dia) {
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' });
    var j = janela(T('addNesteDia') + ' · ' + semana(dia) + ' ' + fData(dia, true), corpo);
    corpo.appendChild(h('button', { class: 'bt', type: 'button', onclick: function () { j.fechar(function () { janelaReserva({ c: { quando: dia + 'T12:00' } }); }); } }, '🎟 ' + T('addReservaDia')));
    corpo.appendChild(h('button', { class: 'bt sec', type: 'button', onclick: function () {
      j.fechar(function () {
        var dias = diasDaViagem(v), i = dias.indexOf(dia); if (i >= 0) estado.dia = i;
        Nav.ir('roteiro');
        var o = estado.opcao;
        if (o && podeEditar() && i >= 0) setTimeout(function () { janelaItem(o, o.dias[mapearDia(i, dias.length, o.dias.length)]); }, 350);
      });
    } }, '📅 ' + T('addAtividadeDia')));
    corpo.appendChild(h('p', { class: 'pequeno', texto: T('addNoDiaDica') }));
  }
  /* do roteiro (ou de qualquer lugar) direto para a reserva: abre o dia e a etapa, rola até ela e destaca */
  var focoReserva = null;
  function irParaReserva(ids, dia) { focoReserva = { ids: ids, dia: dia }; Nav.ir('reservas'); }
  function cartaoDe(g) {
    var el = g.length > 1 ? cartaoGrupo(g) : cartaoReserva(g[0]);
    el.setAttribute('data-res', g.map(function (x) { return x.reg.id; }).join(' '));
    return el;
  }
  function etapaDe(c, v) {
    var p = papelReserva(c), d = (c.quando || '').slice(0, 10);
    if (c.tipo === 'voo') return v && d && d === v.inicio ? 'vooIda' : v && d && d === v.fim ? 'vooVolta' : 'voo';
    if (c.tipo === 'hotel') return p === 'sai' ? 'checkout' : 'checkin';
    if (c.tipo === 'carro') return p === 'sai' ? 'devolucao' : p === 'entra' ? 'retirada' : 'carro';
    return c.tipo;
  }
  var ICONE_ETAPA = { vooIda: 'voo', vooVolta: 'voo', voo: 'voo', checkin: 'hotel', checkout: 'hotel', retirada: 'carro', devolucao: 'carro', carro: 'carro', transfer: 'transfer', onibus: 'onibus' };
  function blocoEtapa(chave, etapa, grupos) {
    var c0 = grupos[0][0].c, hh = c0.quando && c0.quando.length > 10 ? c0.quando.slice(11, 16) : '';
    var n = grupos.reduce(function (s, g) { return s + g.length; }, 0);
    var hora = !hh ? '' : etapa === 'checkin' ? T('aPartirDe', { h: hh }) : (etapa === 'checkout' || etapa === 'devolucao') ? T('ateAs', { h: hh }) : hh;
    var aberto = !!etapasAbertas[chave];
    var corpo = h('div', { class: 'etapa-corpo', hidden: !aberto });
    var bt = h('button', { class: 'etapa', type: 'button', 'aria-expanded': aberto ? 'true' : 'false' }, [
      h('span', { class: 'etapa-l1' }, [h('span', { class: 'chev', 'aria-hidden': 'true', texto: '›' }),
        h('b', {}, [iconeRes(ICONE_ETAPA[etapa]), T('et_' + etapa)]), h('span', { class: 'etapa-hora', texto: hora })]),
      h('span', { class: 'etapa-l2' }, [h('span', { class: 'etapa-tit', texto: c0.titulo.replace(/\s*·\s*(entrada|saída|retirada|devolução)\b.*$/i, '') }),
        n > 1 ? h('span', { class: 'etq', texto: T('nReservas', { n: n }) }) : null])]);
    function encher() { if (!corpo.childNodes.length) grupos.forEach(function (g) { corpo.appendChild(cartaoDe(g)); }); }
    if (aberto) encher();
    bt.addEventListener('click', function () {
      aberto = !aberto; etapasAbertas[chave] = aberto;
      bt.setAttribute('aria-expanded', aberto ? 'true' : 'false'); if (aberto) encher(); corpo.hidden = !aberto;
    });
    return h('div', { class: 'etapa-bloco' }, [bt, corpo]);
  }
  TELAS.reservas = function (tela) {
    tela.appendChild(h('h1', { texto: T('rota_reservas') }));
    if (!estado.viagem) return semViagem(tela);
    /* de qual viagem são estas reservas (com nomes parecidos, "Gram…" não basta) */
    var v = estado.viagem;
    tela.appendChild(h('button', { class: 'cartao viagem-atual', type: 'button', onclick: janelaContexto }, [
      h('span', { class: 'pequeno', texto: T(v.tipo === 'passeio' ? 'res_doPasseio' : 'res_daViagem') }),
      h('b', { texto: (v.tipo === 'passeio' ? '🚶 ' : '🧳 ') + v.nome }),
      h('span', { class: 'sub', texto: (v.inicio === v.fim ? semana(v.inicio) + ', ' + fData(v.inicio) : fData(v.inicio) + ' – ' + fData(v.fim)) + ' · ' + T('res_trocarViagem') })]));
    var trancadas = 0;
    abrirReservas(v).then(function () {
      return Banco.listar('reservas', function (r) { return r.viagem_id === v.id; });
    }).then(function (lista) {
        return Promise.all(lista.map(function (r) {
          return Cofre.decifrarReserva(r.conteudo).then(function (c) { return { reg: r, c: c }; }, function () {
            /* ainda no formato antigo, trancada no celular de quem guardou: mostra só o compromisso */
            trancadas++;
            var a = r.agenda; return a && a.titulo ? { reg: r, c: { tipo: (r.tipo || 'outro'), titulo: a.titulo, quando: a.quando, local: a.local, lat: a.lat, lng: a.lng, nota: T('res_trancada') }, trancada: true } : null;
          });
        }));
      }).then(function (itens) {
        itens = itens.filter(Boolean);
        if (trancadas) {
          /* foram guardadas antes da chave da viagem. Neste aparelho está o cofre antigo? pede o PIN uma última vez e libera para todos */
          var av = h('div', { class: 'cartao aviso' }); tela.appendChild(av);
          Cofre.existe().then(function (aqui) {
            av.appendChild(h('b', { texto: (aqui ? '🔓 ' : '📱 ') + T(aqui ? 'res_liberarTitulo' : 'res_trancadasTitulo') }));
            av.appendChild(h('p', { class: 'sub', texto: T(aqui ? 'res_liberarTexto' : 'res_trancadasTexto') }));
            if (aqui) { var cx = h('div', {}); av.appendChild(cx); pedirCofreAntigo(cx, function () { migrarReservas(v).then(function () { avisar(T('res_liberadas')); mostrar('reservas'); }); }); }
          });
        }
        /* uma linha só, discreta: adicionar, escanear, colar e-mail */
        tela.appendChild(h('div', { class: 'acoes-res' }, [
          h('button', { class: 'bt', type: 'button', 'aria-label': T('novaReserva'), onclick: function () { janelaReserva(null); } }, '＋ ' + T('res_nova')),
          h('button', { class: 'bt sec', type: 'button', 'aria-label': T('res_escanear'), onclick: function () { escanearIngresso(); } }, '📷 ' + T('res_escanearCurto')),
          h('button', { class: 'bt leve', type: 'button', 'aria-label': T('colarEmail'), onclick: function () { janelaImportar(''); } }, '✉ ' + T('res_emailCurto'))]));
        if (!itens.length) { tela.appendChild(h('p', { class: 'sub', texto: T('semReservas') })); return; }
        /* grupos: ingressos do mesmo evento (mesmo grupo, ou mesmo título e horário) viram um cartão só */
        var grupos = {}, ordem = [];
        itens.forEach(function (x) {
          var k = (x.reg.agenda && x.reg.agenda.grupo) || (x.c.tipo === 'ingresso' && x.c.quando ? 'i|' + x.c.titulo + '|' + x.c.quando : 'r|' + x.reg.id);
          if (!grupos[k]) { grupos[k] = []; ordem.push(k); }
          grupos[k].push(x);
        });
        var cartoes = ordem.map(function (k) { return grupos[k].sort(function (a, b) { return String(a.c.assento || a.c.pessoa || '').localeCompare(String(b.c.assento || b.c.pessoa || ''), 'pt', { numeric: true }); }); });
        var chv = chavesComoNaVida(cartoes.map(function (g) { return g[0].c; }));
        cartoes.forEach(function (g, i) { g._k = chv[i]; });
        cartoes.sort(function (a, b) { return a._k < b._k ? -1 : a._k > b._k ? 1 : 0; });
        /* filtro por tipo (só os que existem) e busca */
        var tipos = TIPOS_RES.filter(function (t) { return itens.some(function (x) { return x.c.tipo === t; }); });
        var filtro = 'todos', busca = '';
        var chips = h('div', { class: 'chips rolar', role: 'tablist', 'aria-label': T('tipo') });
        var campo = h('input', { class: 'campo', type: 'search', placeholder: T('res_buscar'), 'aria-label': T('res_buscar'), autocomplete: 'off' });
        var caixa = h('div', { class: 'res-dias' });
        function chip(t) {
          return h('button', { class: 'chip', type: 'button', role: 'tab', 'aria-selected': filtro === t ? 'true' : 'false', onclick: function () { filtro = t; desenharChips(); desenhar(); } },
            t === 'todos' ? T('f_todos') + ' (' + cartoes.length + ')' : rotuloRes(t));
        }
        function desenharChips() { chips.textContent = ''; ['todos'].concat(tipos).forEach(function (t) { chips.appendChild(chip(t)); }); }
        if (tipos.length > 1) { desenharChips(); tela.appendChild(chips); }
        if (cartoes.length > 3) tela.appendChild(campo);
        tela.appendChild(caixa);
        campo.addEventListener('input', function () { busca = normalizar(campo.value).trim(); desenhar(); });
        /* qual dia já vem aberto: hoje, ou o próximo dia com reserva (os outros ficam recolhidos) */
        var hjIso = hojeIso(), diaFoco = null;
        cartoes.forEach(function (g) { var d = (g[0].c.quando || '').slice(0, 10); if (d && d >= hjIso && (!diaFoco || d < diaFoco)) diaFoco = d; });
        var diasDistintos = {}; cartoes.forEach(function (g) { diasDistintos[(g[0].c.quando || '').slice(0, 10) || 'sem'] = 1; });
        /* recolher só quando economiza espaço de verdade: um dia só (ex.: passeio) ou poucas reservas = tudo aberto, sem chevron */
        var totalReservas = cartoes.reduce(function (s2, g) { return s2 + g.length; }, 0);
        var umDiaSo = Object.keys(diasDistintos).length <= 1 || totalReservas <= 3;
        function desenhar() {
          caixa.textContent = '';
          var diaAnt = null, n = 0, bloco = null, sec = null;
          /* com filtro ou busca, dias e etapas já vêm abertos (a pessoa está procurando algo) */
          var abrirTudo = filtro !== 'todos' || !!busca || umDiaSo;
          function alvo() { return sec ? sec.corpo : caixa; }
          function fecharBloco() {
            if (!bloco) return;
            if (abrirTudo) bloco.grupos.forEach(function (g) { alvo().appendChild(cartaoDe(g)); });
            else alvo().appendChild(blocoEtapa(bloco.chave, bloco.etapa, bloco.grupos));
            sec && sec.icones.push(ICONE_ETAPA[bloco.etapa]);
            bloco = null;
          }
          function fecharDia() {
            fecharBloco();
            if (sec) {
              sec.resumo.textContent = '';
              sec.icones.filter(function (x, i, a) { return a.indexOf(x) === i; }).forEach(function (t) { sec.resumo.appendChild(iconeRes(t)); });
              sec.resumo.appendChild(d.createTextNode(String(sec.icones.length)));
              sec.resumo.setAttribute('aria-label', T('nReservas', { n: sec.icones.length }));
            }
            sec = null;
          }
          function abrirDia(dia) {
            fecharDia();
            var chave = v.id + '|' + dia, aberto = abrirTudo || umDiaSo || (diasAbertos[chave] != null ? diasAbertos[chave] : dia === diaFoco || dia === 'sem');
            var corpo = h('div', { class: 'dia-corpo', hidden: !aberto });
            var resumo = h('span', { class: 'dia-resumo' });
            var mais = dia === 'sem' ? null : h('button', { class: 'dia-mais', type: 'button', 'aria-label': T('addNesteDia'), title: T('addNesteDia'), texto: '＋', onclick: function () { janelaAddNoDia(v, dia); } });
            if (umDiaSo) {   /* um dia só (ex.: passeio): título simples, sempre aberto, sem chevron */
              caixa.appendChild(h('section', { class: 'dia-sec' }, [h('div', { class: 'dia-linha' }, [
                h('h3', { class: 'dia-titulo dia-fixo', texto: dia === 'sem' ? T('res_semData') : semana(dia) + ', ' + fData(dia) }), mais]), corpo]));
              sec = { corpo: corpo, resumo: resumo, icones: [] };
              return;
            }
            var bt = h('button', { class: 'dia-cab', type: 'button', 'aria-expanded': aberto ? 'true' : 'false' }, [
              h('span', { class: 'chev', 'aria-hidden': 'true', texto: '›' }),
              h('span', { class: 'dia-titulo', texto: dia === 'sem' ? T('res_semData') : semana(dia) + ', ' + fData(dia) }), resumo]);
            bt.addEventListener('click', function () { aberto = !aberto; diasAbertos[chave] = aberto; bt.setAttribute('aria-expanded', aberto ? 'true' : 'false'); corpo.hidden = !aberto; });
            caixa.appendChild(h('section', { class: 'dia-sec' }, [h('div', { class: 'dia-linha' }, [bt, mais]), corpo]));
            sec = { corpo: corpo, resumo: resumo, icones: [] };
          }
          /* veio do roteiro ("Ver reserva do carro"): abre o dia e a etapa dessa reserva */
          if (foco) cartoes.forEach(function (g) {
            if (!g.some(function (x) { return foco.ids.indexOf(x.reg.id) > -1; })) return;
            var c0 = g[0].c, dia = (c0.quando || '').slice(0, 10) || 'sem';
            diasAbertos[v.id + '|' + dia] = true;
            if (LOGISTICA[c0.tipo]) etapasAbertas[v.id + '|' + dia + '|' + etapaDe(c0, v) + '|' + (c0.quando || '').slice(11, 16)] = true;
          });
          cartoes.forEach(function (g) {
            var c0 = g[0].c;
            if (filtro !== 'todos' && c0.tipo !== filtro) return;
            if (busca && !g.some(function (x) { return normalizar([x.c.titulo, x.c.pessoa, x.c.codigo, x.c.local, x.c.nota, T('res_' + x.c.tipo)].join(' ')).indexOf(busca) > -1; })) return;
            n++;
            var dia = (c0.quando || '').slice(0, 10) || 'sem';
            if (dia !== diaAnt) { abrirDia(dia); diaAnt = dia; }
            if (LOGISTICA[c0.tipo] && dia !== 'sem') {
              var et = etapaDe(c0, v), chave = v.id + '|' + dia + '|' + et + '|' + (c0.quando || '').slice(11, 16);
              if (bloco && bloco.chave === chave) { bloco.grupos.push(g); return; }
              fecharBloco(); bloco = { chave: chave, etapa: et, grupos: [g] }; return;
            }
            fecharBloco();
            alvo().appendChild(cartaoDe(g));
            sec.icones.push(c0.tipo || 'outro');
          });
          fecharDia();
          if (!n) caixa.appendChild(h('p', { class: 'sub', texto: T('nadaAchado') }));
        }
        var foco = focoReserva; focoReserva = null;
        desenhar();
        if (foco) setTimeout(function () {
          var alvoEl = [].filter.call(caixa.querySelectorAll('[data-res]'), function (el) { return el.getAttribute('data-res').split(' ').some(function (id) { return foco.ids.indexOf(id) > -1; }); })[0];
          if (!alvoEl) return;
          alvoEl.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          alvoEl.classList.add('destaque'); setTimeout(function () { alvoEl.classList.remove('destaque'); }, 2600);
        }, 80);
      }).catch(function () { tela.appendChild(h('div', { class: 'alerta', texto: T('cofreErro') })); });
  };
  function linhaQuando(c) {
    if (!c.quando) return null;
    var hh = c.quando.length > 10 ? c.quando.slice(11, 16) : '', p = papelReserva(c);
    return fData(c.quando.slice(0, 10)) + (hh ? ' · ' + (p === 'entra' && c.tipo === 'hotel' ? T('aPartirDe', { h: hh }) : p === 'sai' ? T('ateAs', { h: hh }) : hh) : '');
  }
  /* a ordem da vida real: o horário do hotel é "a partir de" e o da devolução é "até".
     Num dia com voo: sair do hotel e devolver o carro vêm ANTES do voo; pegar o carro e entrar no hotel vêm DEPOIS. */
  function papelReserva(c) {
    var t = normalizar(c.titulo || '');
    if (c.tipo === 'hotel') return /saida|check.?out/.test(t) ? 'sai' : 'entra';
    if (c.tipo === 'carro') return /devolu|entrega/.test(t) ? 'sai' : (/retirada|retirar|pegar/.test(t) ? 'entra' : null);
    return null;
  }
  /* chave de ordem "como na vida": AAAA-MM-DDTHH:MM|n (n desempata: sair do hotel 1, devolver carro 2, voo e outros 5, pegar carro 7, entrar no hotel 8) */
  function chavesComoNaVida(lista) {
    /* por dia: voo mais cedo/mais tarde; carro pego mais tarde; carro devolvido mais cedo */
    var dia = {};
    function marcar(d, campo, hh, maior) { var x = dia[d] = dia[d] || {}; if (x[campo] == null || (maior ? hh > x[campo] : hh < x[campo])) x[campo] = hh; }
    lista.forEach(function (c) {
      if (!c.quando || c.quando.length <= 10) return;
      var d = c.quando.slice(0, 10), hh = c.quando.slice(11, 16), p = papelReserva(c);
      if (c.tipo === 'voo') { marcar(d, 'vooMin', hh, false); marcar(d, 'vooMax', hh, true); }
      if (c.tipo === 'carro' && p === 'entra') marcar(d, 'pegaCarro', hh, true);
      if (c.tipo === 'carro' && p === 'sai') marcar(d, 'devolve', hh, false);
    });
    function menor(a, b) { return b != null && b < a ? b : a; }
    function maior(a, b) { return b != null && b > a ? b : a; }
    return lista.map(function (c) {
      var q = c.quando || '';
      if (!q) return '9999';
      if (q.length <= 10) return q + 'T99:99|5';
      var d = q.slice(0, 10), hh = q.slice(11, 16), x = dia[d] || {}, p = papelReserva(c), n = 5, nv;
      if (p === 'sai' && c.tipo === 'carro' && x.vooMin != null) { nv = menor(hh, x.vooMin); if (nv !== hh || hh === x.vooMin) { hh = nv; n = 2; } }
      else if (p === 'sai' && c.tipo === 'hotel') { nv = menor(menor(hh, x.vooMin), x.devolve); if (nv !== hh || hh === x.vooMin || hh === x.devolve) { hh = nv; n = 1; } }
      else if (p === 'entra' && c.tipo === 'carro' && x.vooMax != null) { nv = maior(hh, x.vooMax); if (nv !== hh || hh === x.vooMax) { hh = nv; n = 7; } }
      else if (p === 'entra' && c.tipo === 'hotel') {
        var chega = maior(x.vooMax || '', x.pegaCarro);   /* último passo antes do hotel naquele dia */
        c._chegaCedo = chega && chega < hh ? hh : null;     /* chegam antes do horário de check-in: avisar */
        /* dia de chegada de voo: o check-in fecha o dia (depois do voo, do carro e da estrada), não fica no meio pela hora "a partir de" */
        if (x.vooMax != null) { hh = '99:98'; n = 8; c._fimDoDia = true; }
        else { nv = maior(hh, x.pegaCarro); if (nv !== hh || hh === x.pegaCarro) { hh = nv; n = 8; } }
      }
      return d + 'T' + hh + '|' + n + '|' + normalizar(c.titulo || '');
    });
  }
  function cartaoReserva(x) {
    var c = x.c;
    return h('div', { class: 'cartao' }, [
      h('span', { class: 'pequeno' }, rotuloRes(c.tipo)),
      h('b', { texto: c.titulo }),
      linhaQuando(c) ? h('span', { texto: linhaQuando(c) }) : null,
      c._chegaCedo ? h('span', { class: 'sub', texto: 'ℹ️ ' + T('chegaCedo', { h: c._chegaCedo }) }) : null,
      c.pessoa || c.assento ? h('span', { texto: [c.pessoa, c.assento].filter(Boolean).join(' · ') }) : null,
      c.codigo ? h('span', { class: 'linha' }, [T('codigo') + ': ', h('code', { texto: c.codigo, style: 'user-select:all' })]) : null,
      c.local ? h('span', { class: 'sub', texto: c.local }) : null,
      c.nota ? h('span', { class: 'sub', texto: c.nota }) : null,
      h('div', { class: 'linha' }, [
        c.qr || c.barra ? h('button', { class: 'bt', type: 'button', onclick: function () { mostrarQRs([c], 0); } }, '▦ ' + T('mostrarQRIngresso')) : null,
        h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaReserva(x); } }, T('editar'))])
    ]);
  }
  /* vários ingressos do mesmo evento: um cartão, todos os QR de uma vez, editar o grupo inteiro */
  function cartaoGrupo(g) {
    var c0 = g[0].c, comQR = g.filter(function (x) { return x.c.qr || x.c.barra; }).map(function (x) { return x.c; });
    var lista = h('div', { class: 'linha', hidden: true, style: 'flex-direction:column;align-items:stretch;gap:.4rem' });
    g.forEach(function (x) {
      lista.appendChild(h('div', { class: 'linha entre', style: 'border-top:1px solid var(--linha);padding-top:.4rem' }, [
        h('span', {}, [h('b', { texto: x.c.pessoa || '—' }), x.c.assento ? h('span', { class: 'sub', texto: ' · ' + x.c.assento }) : null, x.c.codigo ? h('code', { class: 'pequeno', style: 'display:block;user-select:all', texto: x.c.codigo }) : null]),
        h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaReserva(x); } }, T('editar'))]));
    });
    var verUm = h('button', { class: 'lk', type: 'button', texto: T('res_verUmPorUm'), 'aria-expanded': 'false', onclick: function () { lista.hidden = !lista.hidden; verUm.setAttribute('aria-expanded', lista.hidden ? 'false' : 'true'); } });
    return h('div', { class: 'cartao' }, [
      h('span', { class: 'pequeno' }, rotuloRes(c0.tipo, ' · ' + T('nIngressos', { n: g.length }))),
      h('b', { texto: c0.titulo }),
      linhaQuando(c0) ? h('span', { texto: linhaQuando(c0) }) : null,
      h('span', { texto: g.map(function (x) { return x.c.pessoa; }).filter(Boolean).join(', ') }),
      c0.local ? h('span', { class: 'sub', texto: c0.local }) : null,
      c0.nota ? h('span', { class: 'sub', texto: c0.nota }) : null,
      h('div', { class: 'linha' }, [
        comQR.length ? h('button', { class: 'bt', type: 'button', onclick: function () { mostrarQRs(comQR, 0); } }, '▦ ' + T('res_mostrarTodosQR', { n: comQR.length })) : null,
        h('button', { class: 'bt leve', type: 'button', onclick: function () { janelaEditarGrupo(g); } }, '✎ ' + T('res_editarGrupo'))]),
      verUm, lista]);
  }
  /* QR em tela cheia, um atrás do outro: arrastar para o lado ou ‹ › (a pessoa da fila vai mostrando) */
  function mostrarQRs(lista, inicio) {
    var i = inicio || 0;
    var titulo = h('b', {}), quem = h('span', {}), img = h('img', { alt: '', style: 'width:min(86vw,22rem);height:auto;border-radius:12px;background:#fff;image-rendering:pixelated;touch-action:pan-y' });
    var EST_QR = img.getAttribute('style'), EST_BARRA = 'width:min(92vw,30rem);height:9rem;border-radius:8px;background:#fff;padding:.6rem;touch-action:pan-y';
    var cod = h('code', { style: 'font-size:1.3rem;user-select:all' }), pos = h('span', { class: 'sub' });
    var ant = h('button', { class: 'bt leve', type: 'button', 'aria-label': T('anterior'), texto: '‹ ' + T('anterior') });
    var prox = h('button', { class: 'bt', type: 'button', 'aria-label': T('proximo'), texto: T('proximo') + ' ›' });
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:center;gap:.5rem;text-align:center' }, [titulo, quem, img, cod, pos,
      lista.length > 1 ? h('div', { class: 'acoes' }, [ant, prox]) : null, h('p', { class: 'pequeno', texto: T('qrBrilho') })]);
    var j = janela(T('qrIngresso'), corpo);
    j.caixa.classList.add('cheia');
    function mostrar() {
      var c = lista[i];
      titulo.textContent = c.titulo; quem.textContent = [c.pessoa, c.assento].filter(Boolean).join(' · ');
      cod.textContent = c.barra || c.codigo || ''; pos.textContent = lista.length > 1 ? T('nDeN', { i: i + 1, n: lista.length }) : '';
      ant.disabled = i === 0; prox.disabled = i === lista.length - 1;
      img.hidden = false;
      if (c.barra && window.Barras) {   /* voucher com código de barras (ex.: Florybal, ITF) */
        try { img.setAttribute('style', EST_BARRA); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Barras.svg(c.barra, c.barraFormato)); img.alt = T('codigoBarras') + ' ' + c.barra; }
        catch (e) { img.hidden = true; }
        return;
      }
      img.setAttribute('style', EST_QR);
      carregarQR().then(function () { var q = qrcode(0, 'M'); q.addData(String(c.qr || c.codigo)); q.make(); img.src = q.createDataURL(8, 8); img.alt = 'QR ' + (c.codigo || ''); })
        .catch(function () { img.hidden = true; });
    }
    ant.addEventListener('click', function () { if (i > 0) { i--; mostrar(); } });
    prox.addEventListener('click', function () { if (i < lista.length - 1) { i++; mostrar(); } });
    var x0 = null;
    img.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    img.addEventListener('pointerup', function (e) { if (x0 == null) return; var dx = e.clientX - x0; x0 = null; if (dx < -50) prox.click(); else if (dx > 50) ant.click(); });
    mostrar();
    if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').catch(function () {});
  }
  function mostrarQRIngresso(c) { mostrarQRs([c], 0); }
  /* muda tipo, título, data/hora e local de todos os ingressos do grupo de uma vez */
  function janelaEditarGrupo(g) {
    var c = g[0].c;
    var tipo = h('select', { class: 'campo', id: 'gx-g-tipo' }, TIPOS_RES.map(function (t) { return h('option', { value: t, selected: c.tipo === t }, T('res_' + t)); }));
    var tit = h('input', { class: 'campo', id: 'gx-g-tit', maxlength: '100', value: c.titulo || '' });
    var quando = h('input', { class: 'campo', id: 'gx-g-quando', type: 'datetime-local', value: c.quando || '' });
    var local = h('input', { class: 'campo', id: 'gx-g-local', maxlength: '160', value: c.local || '' });
    var ok = h('button', { class: 'bt', type: 'button' }, T('salvar'));
    var j = janela(T('res_editarGrupo'), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { class: 'sub', texto: T('res_editarGrupoTexto', { n: g.length }) }),
      h('label', { class: 'rot', for: 'gx-g-tipo', texto: T('tipo') }), tipo, h('label', { class: 'rot', for: 'gx-g-tit', texto: T('titulo') }), tit,
      h('label', { class: 'rot', for: 'gx-g-quando', texto: T('quando') }), quando, h('label', { class: 'rot', for: 'gx-g-local', texto: T('local') }), local, ok]));
    ok.addEventListener('click', function () {
      ok.disabled = true;
      g.reduce(function (p, x) {
        return p.then(function () {
          var dados = Object.assign({}, x.c, { tipo: tipo.value, titulo: tit.value.trim(), quando: quando.value, local: local.value.trim() });
          return cifrarReserva(x.reg.viagem_id, dados).then(function (blob) {
            var reg = x.reg; reg.conteudo = blob; reg.tipo = dados.tipo;
            reg.agenda = dados.quando ? Object.assign({}, reg.agenda || {}, { titulo: dados.titulo, quando: dados.quando, local: dados.local || null }) : null;
            return Banco.gravar('reservas', reg);
          });
        });
      }, Promise.resolve()).then(function () { j.fechar(function () { avisar(T('salvo')); mostrar('reservas'); }); })
        .catch(function () { avisar(T('cofreFechou')); j.fechar(function () { mostrar('reservas'); }); });
    });
  }
  /* câmera: lê o QR de um ingresso e já abre a reserva com o código preenchido */
  function escanearIngresso() {
    lerQR({ livre: true }).then(function (txt) { janelaReserva({ c: { tipo: 'ingresso', codigo: String(txt).slice(0, 120), qr: String(txt).slice(0, 500) } }); }).catch(function () {});
  }
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
    var apagar = x && x.reg ? h('button', { class: 'bt perigo', type: 'button' }, T('apagar')) : null;
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('label', { class: 'rot', for: 'gx-r-tipo', texto: T('tipo') }), campos.tipo, h('label', { class: 'rot', for: 'gx-r-tit', texto: T('titulo') }), campos.titulo,
      h('label', { class: 'rot', for: 'gx-r-quando', texto: T('quando') }), campos.quando, h('label', { class: 'rot', for: 'gx-r-cod', texto: T('codigo') }), campos.codigo,
      h('label', { class: 'rot', for: 'gx-r-local', texto: T('local') }), campos.local, h('label', { class: 'rot', for: 'gx-r-nota', texto: T('nota') }), campos.nota,
      h('div', { class: 'acoes' }, [apagar, ok])]);
    var j = janela(x && x.reg ? T('editar') : T('novaReserva'), corpo);
    ok.addEventListener('click', function () {
      if (!campos.titulo.value.trim()) { campos.titulo.focus(); return; }
      var dados = Object.assign({}, c, { tipo: campos.tipo.value, titulo: campos.titulo.value.trim(), quando: campos.quando.value, codigo: campos.codigo.value.trim(), local: campos.local.value.trim(), nota: campos.nota.value.trim() });
      cifrarReserva(x && x.reg ? x.reg.viagem_id : estado.viagem.id, dados).then(function (blob) {
        var reg = x && x.reg ? x.reg : { viagem_id: estado.viagem.id, marca: dados.codigo ? 'cod:' + dados.codigo : null };
        reg.conteudo = blob; reg.tipo = dados.tipo; /* o tipo fica aberto para ícone; código e notas embaralhados */
        /* título, data e local ficam abertos para o roteiro mostrar o compromisso fixo 🔒 sem pedir o PIN */
        reg.agenda = dados.quando ? Object.assign({}, reg.agenda || {}, { titulo: dados.titulo, quando: dados.quando, local: dados.local || null }) : null;
        return Banco.gravar('reservas', reg);
      }).then(function () { j.fechar(); avisar(T('salvo')); mostrar('reservas'); }).catch(function () { avisar(T('cofreFechou')); j.fechar(); mostrar('reservas'); });
    });
    if (apagar) apagar.addEventListener('click', function () { Banco.apagar('reservas', x.reg.id).then(function () { j.fechar(); mostrar('reservas'); }); });
  }

  /* ---------- reservas que chegaram prontas (link #reservas=, e no futuro roteiro@) ----------
     Formato: base64url de { v:1, destino:'gramado', itens:[{ tipo, titulo, quando:'AAAA-MM-DDTHH:MM', local, lat, lng,
     codigo, qr, pessoa, assento, nota, grupo }] }. Nada é guardado sem a pessoa conferir; o código vai para o cofre. */
  function lerLinkReservas() {
    var t = null; try { t = sessionStorage.getItem('guiaxpert.reservas-link'); } catch (e) {}
    if (!t) return null;
    try {
      var b = t.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
      var bytes = Uint8Array.from(atob(b), function (c) { return c.charCodeAt(0); });
      var j = JSON.parse(new TextDecoder().decode(bytes));
      return j && j.v === 1 && Array.isArray(j.itens) ? j : null;
    } catch (e) { return null; }
  }
  function esquecerLinkReservas() { try { sessionStorage.removeItem('guiaxpert.reservas-link'); } catch (e) {} }
  /* o link escolhe a viagem pela data: a atual, se cobre o dia; senão outra que cubra; senão cria um passeio de um dia */
  function oferecerReservasDoLink() {
    var pac = lerLinkReservas();
    if (!pac) return;
    var d = (pac.itens.filter(function (it) { return it.quando; })[0] || {}).quando;
    d = d ? d.slice(0, 10) : null;
    if (!d) { if (!estado.viagem) { avisar(T('semViagemTexto')); return; } oferecerNaViagem(pac); return; }
    var cobre = function (v) { return v && v.inicio && v.fim && v.inicio <= d && d <= v.fim; };
    if (cobre(estado.viagem)) { oferecerNaViagem(pac); return; }
    Banco.listar('viagens', function (v) { return !v.apagado && cobre(v); }).then(function (vs) {
      if (vs.length) return Contexto.definir('viagem', vs[0].id).then(recarregarContexto);
      var ps = pac.passeio || {}, base = estado.viagem;
      return criarViagem({ tipo: 'passeio', nome: ps.nome || pac.itens[0].titulo || T('tipoPasseio'), destino: null, destinoTexto: ps.cidade || '',
        centro: ps.lat != null ? { lat: ps.lat, lng: ps.lng } : null, inicio: d, fim: d,
        pessoas: base && base.pessoas ? base.pessoas : [], preferencias: {}, estadias: [] }).then(function () { avisar(T('lnk_passeioCriado', { nome: estado.viagem.nome })); });
    }).then(function () { oferecerNaViagem(pac); }).catch(function () { avisar(T('cofreErro')); });
  }
  function oferecerNaViagem(pac) {
    var itens = pac.itens.slice(0, 30);
    var lista = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.5rem' });
    itens.forEach(function (it) {
      lista.appendChild(h('div', { class: 'cartao', style: 'margin:0' }, [
        h('span', { class: 'pequeno' }, rotuloRes(it.tipo || 'outro', it.pessoa ? ' · ' + it.pessoa : '')),
        h('b', { texto: it.titulo || '' }),
        it.quando ? h('span', { texto: fData(it.quando.slice(0, 10)) + (it.quando.length > 10 ? ' · ' + it.quando.slice(11, 16) : '') }) : null,
        it.assento ? h('span', { class: 'sub', texto: it.assento }) : null,
        it.codigo ? h('span', { class: 'sub', texto: T('codigo') + ': ' + it.codigo }) : null]));
    });
    var caixa = h('div', {});
    var ok = h('button', { class: 'bt', type: 'button', texto: '🔒 ' + T('lnk_guardar', { n: itens.length }) });
    var nao = h('button', { class: 'bt leve', type: 'button', texto: T('lnk_naoAgora') });
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.6rem' }, [
      h('p', { class: 'sub', texto: T('lnk_texto', { n: itens.length, viagem: estado.viagem.nome }) }), lista, caixa, h('div', { class: 'acoes' }, [nao, ok])]);
    var j = janela(T('lnk_titulo'), corpo);
    nao.addEventListener('click', function () { esquecerLinkReservas(); j.fechar(); });
    ok.addEventListener('click', function () {
      ok.disabled = true;
      guardarReservasProntas(itens).then(function (n) { esquecerLinkReservas(); j.fechar(function () { avisar(n ? T('lnk_guardadas', { n: n }) : T('lnk_jaEstavam')); Nav.ir('reservas'); }); })
        .catch(function () { ok.disabled = false; avisar(T(navigator.onLine ? 'cofreErro' : 'semInternet')); });
    });
  }
  /* guarda cada reserva: o que é de agenda (título, data, local) fica aberto para o roteiro mostrar o compromisso;
     código, QR, pessoa, assento e nota ficam embaralhados no cofre */
  function guardarReservasProntas(itens) {
    return Banco.listar('reservas', function (r) { return r.viagem_id === estado.viagem.id; }).then(function (ja) {
      var marcas = {}; ja.forEach(function (r) { if (r.marca && !r.apagado) marcas[r.marca] = r; });
      var n = 0;
      return itens.reduce(function (p, it) {
        return p.then(function () {
          /* abrir o mesmo link duas vezes não duplica: pelo código, ou por título + horário */
          var marca = it.codigo ? 'cod:' + it.codigo : (it.titulo && it.quando ? 'ag:' + it.titulo + '|' + it.quando : null);
          /* mesmo código já guardado: pula; só completa se o guardado não tinha data e agora veio com data */
          var antiga = marca && marcas[marca];
          if (antiga && (antiga.agenda && antiga.agenda.quando || !it.quando)) return;
          var dados = { tipo: it.tipo || 'outro', titulo: it.titulo || '', quando: it.quando || '', codigo: it.codigo || '', local: it.local || '', nota: it.nota || '',
            pessoa: it.pessoa || '', assento: it.assento || '', barra: it.barra || '', barraFormato: it.barraFormato || '',
            qr: it.barra ? '' : (it.qr || (it.tipo === 'ingresso' ? it.codigo || '' : '')) };   /* QR só de ingresso (voo e hotel não entram por QR) */
          return cifrarReserva(estado.viagem.id, dados).then(function (blob) {
            n++;
            return Banco.gravar('reservas', Object.assign(antiga ? { id: antiga.id, criado_em: antiga.criado_em, versao: antiga.versao } : {}, { viagem_id: estado.viagem.id, conteudo: blob, tipo: dados.tipo, marca: marca,
              agenda: dados.quando ? { titulo: dados.titulo, quando: dados.quando, local: dados.local || null, lat: it.lat != null ? it.lat : null, lng: it.lng != null ? it.lng : null, grupo: it.grupo || null } : null }));
          });
        });
      }, Promise.resolve()).then(function () { return n; });
    });
  }
  /* antes de mostrar reservas: tenta o cofre pessoal sozinho (sem pedir nada) e, se abriu,
     passa as reservas antigas (v1, só deste cofre) para a chave da viagem — aí a família toda abre */
  /* guarda com a chave da viagem; sem ela (sem internet na primeira vez), usa o cofre pessoal aberto e passa depois */
  function cifrarReserva(vid, dados) {
    return Cofre.cifrarViagem(vid, dados).catch(function (e) { if (Cofre.aberto()) return Cofre.cifrar(dados); throw e; });
  }
  function abrirReservas(v) {
    return Cofre.abrirSozinho().then(function () { return Cofre.aberto() ? migrarReservas(v) : null; }).catch(function () { return null; });
  }
  function migrarReservas(v) {
    return Banco.listar('reservas', function (r) { return r.viagem_id === v.id && r.conteudo && r.conteudo.v !== 2; }).then(function (rs) {
      return rs.reduce(function (p, r) {
        return p.then(function () {
          return Cofre.decifrar(r.conteudo).then(function (c) { return Cofre.cifrarViagem(v.id, c); })
            .then(function (blob) { r.conteudo = blob; return Banco.gravar('reservas', r); }).catch(function () {});
        });
      }, Promise.resolve());
    });
  }
  /* pede o PIN (ou cria o cofre) e depois chama "pronto" */
  function pedirCofre(tela, pronto) {
    if (Cofre.aberto()) { pronto(); return; }
    /* logado: o cofre abre sozinho (sem PIN, sem QR). Só cai no PIN se a conta ainda não tem o embrulho. */
    Cofre.abrirSozinho().then(function (ok) { if (ok) pronto(); else pedirCofreAntigo(tela, pronto); });
  }
  function pedirCofreAntigo(tela, pronto) {
    Cofre.existe().then(function (existe) {
      if (!existe) return Cofre.temNaConta().then(function (naConta) {
        if (naConta) { caixaTrazerCofre(tela, pronto); return null; }
        /* a conta já tem reservas guardadas em outro aparelho: criar um cofre novo aqui não abriria nenhuma delas */
        return Banco.listar('reservas', function (r) { return !!r.conteudo; }).then(function (rs) {
          if (rs.length) { caixaTrazerCofre(tela, pronto, true); return null; }
          return false;
        });
      });
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
  function caixaTrazerCofre(tela, pronto, soQR) {
    var caixa = h('div', { class: 'cartao' }, [h('h3', { texto: T('trazerCofre') }), h('p', { class: 'sub', texto: T(soQR ? 'trazerCofreTextoQR' : 'trazerCofreTexto') })]);
    var pin = h('input', { class: 'campo', id: 'gx-tc-pin', type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: '6', placeholder: T('digite6') });
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
    if (soQR) bCod.hidden = true;   /* o código de recuperação ainda não subiu para a conta: só o QR do outro aparelho */
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
  function lerQR(op) {
    op = op || {};
    return new Promise(function (ok, erro) {
      var video = h('video', { playsinline: true, autoplay: true, muted: true, style: 'width:100%;border-radius:12px;background:#000;max-height:50vh' });
      var manual = h('input', { class: 'campo', placeholder: 'GXK1:…', 'aria-label': T('colarQR'), autocomplete: 'off' });
      var msg = h('p', { class: 'pequeno', role: 'status' });
      if (op.livre) manual.placeholder = T('res_digitarCodigo');
      var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [h('p', { class: 'sub', texto: T(op.livre ? 'res_escanearTexto' : 'lerQRTexto') }), video, manual, msg]);
      var fluxo = null, parar = function () { if (fluxo) fluxo.getTracks().forEach(function (t) { t.stop(); }); fluxo = null; };
      var j = janela(T('lerQR'), corpo, function () { parar(); erro(new Error('cancelado')); });
      var achou = function (txt) {
        if (op.livre) { var t = String(txt || '').trim(); if (!t) return; parar(); j.fechar(function () { ok(t); }); return; }
        var m = /^GXK1:([A-Za-z0-9+\/=]{40,48})$/.exec(String(txt || '').trim()); if (!m) { msg.textContent = T('qrInvalido'); return; } parar(); j.fechar(function () { ok(m[1]); }); };
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
          h('span', { class: 'pequeno' }, rotuloRes(c.tipo, c.fonte === 'ia' ? ' · ✨' : '')), h('b', { texto: c.titulo }),
          c.quando ? h('span', { texto: fData(c.quando.slice(0, 10)) + (c.quando.length > 10 ? ' · ' + c.quando.slice(11, 16) : '') }) : null,
          c.codigo ? h('span', { class: 'linha' }, [T('codigo') + ': ', h('code', { texto: c.codigo })]) : null,
          c.local ? h('span', { class: 'sub', texto: c.local }) : null, c.nota ? h('span', { class: 'sub', texto: c.nota }) : null]);
        var add = h('button', { class: 'bt', type: 'button', texto: '＋ ' + T('adicionarReserva') });
        add.addEventListener('click', function () {
          add.disabled = true;
          var gravar = function () {
            return cifrarReserva(estado.viagem.id, { tipo: c.tipo, titulo: c.titulo, quando: c.quando || '', codigo: c.codigo || '', local: c.local || '', nota: c.nota || '' })
              .then(function (blob) { return Banco.gravar('reservas', { viagem_id: estado.viagem.id, tipo: c.tipo, conteudo: blob }); })
              .then(function () { add.textContent = '✓ ' + T('adicionado2'); });
          };
          gravar().catch(function () { add.disabled = false; avisar(T(navigator.onLine ? 'cofreErro' : 'semInternet')); });
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
      h('button', { class: 'bt leve', type: 'button', texto: '📄 ' + T('cmp_roteiroCasa'), onclick: function () { janelaCompartilharRoteiro(v); } }),
      h('button', { class: 'bt leve', type: 'button', texto: '✈ ' + T('compartilharVoos'), onclick: function () { compartilharCartao(v, 'voo'); } })
    ]));
    return c;
  }
  function convidar(v, papel) {
    var email = h('input', { class: 'campo', id: 'gx-cv-email', type: 'email', autocomplete: 'off', inputmode: 'email', placeholder: 'nome@email.com' });
    var msg = h('p', { class: 'pequeno', role: 'status', 'aria-live': 'polite' });
    var ok = h('button', { class: 'bt', type: 'button', texto: T('conviteGerar') });
    var aberto = h('button', { class: 'lk', type: 'button', texto: T('conviteSemEmail') });
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
      h('p', { class: 'sub', texto: T('conviteEmailTexto') }),
      h('label', { class: 'rot', for: 'gx-cv-email', texto: T('conviteEmailRot') }), email, ok, msg, aberto]);
    var j = janela(T(papel === 'edita' ? 'convidarEdita' : 'convidarVe'), corpo);
    setTimeout(function () { email.focus(); }, 60);
    var eu = (Conta.sessao() || {}), quem = String(eu.nome || '').split(' ')[0] || String(eu.email || '').split('@')[0];
    var pode = T(papel === 'edita' ? 'convitePodeEditar' : 'convitePodeVer');
    function mostrarPronto(texto) {
      corpo.textContent = '';
      corpo.appendChild(h('p', { class: 'sub', texto: T('conviteProntoTexto') }));
      corpo.appendChild(h('pre', { class: 'cartao-texto', texto: texto }));
      corpo.appendChild(h('button', { class: 'bt', type: 'button', texto: '📤 ' + T('enviar'), onclick: function () { enviarTexto(T('convite'), texto); } }));
      corpo.appendChild(h('button', { class: 'bt leve', type: 'button', texto: '📋 ' + T('copiar'), onclick: function () { navigator.clipboard.writeText(texto).then(function () { avisar(T('copiadoCole')); }).catch(function () { prompt(T('copieManual'), texto); }); } }));
    }
    function gerar() {
      var e = email.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { msg.textContent = T('digiteEmail'); email.focus(); return; }
      ok.disabled = true; msg.textContent = T('carregando');
      Nuvem.criarConviteEmail(v.id, papel, e).then(function (r) {
        var link = location.origin + location.pathname + '#convite=' + r.token;
        mostrarPronto(T('conviteMensagem2', { quem: quem, nome: v.nome, pode: pode }) + '\n' + link + '\n\n' + T('conviteMensagemCodigo', { email: e, codigo: r.codigo }));
      }).catch(function () { ok.disabled = false; msg.textContent = navigator.onLine ? T('erroRede') : T('semInternet'); });
    }
    ok.addEventListener('click', gerar);
    email.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') gerar(); });
    aberto.addEventListener('click', function () {
      msg.textContent = T('carregando');
      Nuvem.criarConvite(v.id, papel, 14).then(function (tok) {
        mostrarPronto(T('conviteMensagem2', { quem: quem, nome: v.nome, pode: pode }) + '\n' + location.origin + location.pathname + '#convite=' + tok + '\n\n' + T('conviteComoEntrar'));
      }).catch(function () { msg.textContent = navigator.onLine ? T('erroRede') : T('semInternet'); });
    });
  }
  /* ---------- Compartilhar com quem não tem o app: página navegável (.html) ou PDF (E21) ----------
     Tudo montado aqui, por regras, sem IA. Padrão sem dados sensíveis: localizadores, PINs, notas das reservas e QR só com "Incluir códigos". */
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function janelaCompartilharRoteiro(v) {
    var forma = 'html';
    var op = { pessoas: true, roteiro: true, mapas: true, hotel: true, codigos: false };
    var corpo = h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch;gap:.7rem' });
    var j = janela('📤 ' + T('cmp_tituloCurto'), corpo);
    function marca(chave, rotulo, dica) {
      var cb = h('input', { type: 'checkbox', id: 'gx-cmp-' + chave, checked: op[chave] });
      cb.addEventListener('change', function () { op[chave] = cb.checked; aviso.hidden = !op.codigos; });
      return h('label', { class: 'cmp-opcao', for: 'gx-cmp-' + chave }, [cb, h('span', {}, [h('b', { texto: rotulo }), dica ? h('span', { class: 'pequeno', texto: ' ' + dica }) : null])]);
    }
    var aviso = h('p', { class: 'alerta', hidden: true, texto: T('cmp_avisoCodigos') });
    var formas = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': T('cmp_forma') });
    function desenharFormas() {
      formas.textContent = '';
      [['html', '🌐 ' + T('cmp_html')], ['pdf', '📄 PDF']].forEach(function (f) {
        formas.appendChild(h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': forma === f[0] ? 'true' : 'false', 'aria-pressed': forma === f[0] ? 'true' : 'false', texto: f[1], onclick: function () { forma = f[0]; desenharFormas(); dicaForma.textContent = T(forma === 'html' ? 'cmp_htmlDica' : 'cmp_pdfDica'); } }));
      });
    }
    var dicaForma = h('p', { class: 'pequeno', texto: T('cmp_htmlDica') });
    desenharFormas();
    var msg = h('p', { class: 'pequeno', role: 'status', 'aria-live': 'polite' });
    var ok = h('button', { class: 'bt', type: 'button', texto: T('cmp_gerar') });
    [h('p', { class: 'sub', texto: T('cmp_texto') }), h('b', { texto: T('cmp_forma') }), formas, dicaForma, h('b', { texto: T('cmp_oQue') }),
      marca('pessoas', T('cmp_pessoas'), T('cmp_pessoasDica')), marca('roteiro', T('cmp_roteiro'), T('cmp_roteiroDica')), marca('mapas', T('cmp_mapas')), marca('hotel', T('cmp_hotel'), T('cmp_hotelDica')),
      marca('codigos', T('cmp_codigos'), T('cmp_codigosDica')), aviso, ok, msg].forEach(function (el) { corpo.appendChild(el); });
    ok.addEventListener('click', function () {
      ok.disabled = true; msg.textContent = T('carregando');
      op.pdf = forma === 'pdf';
      montarDocumentoViagem(v, op).then(function (doc) {
        ok.disabled = false; msg.textContent = '';
        if (forma === 'pdf') {
          ok.disabled = true; msg.textContent = T('cmp_gerandoPdf');
          gerarPdf(doc).then(function (blob) {
            ok.disabled = false; msg.textContent = '';
            entregarArquivo(blob, nomeArquivo(v.nome) + '.pdf', 'application/pdf', v.nome);
          }).catch(function () { ok.disabled = false; msg.textContent = T('cmp_pdfErro'); });
          return;
        }
        entregarHtml(doc.html, nomeArquivo(v.nome) + '.html', v.nome);
      }).catch(function () { ok.disabled = false; msg.textContent = T('erroRede'); });
    });
  }
  function nomeArquivo(t) { return 'Roteiro - ' + String(t || 'viagem').replace(/[\\/:*?"<>|]+/g, ' ').trim(); }
  function entregarHtml(html, nome, titulo) { entregarArquivo(new Blob([html], { type: 'text/html' }), nome, 'text/html', titulo); }
  /* arquivo pronto: no celular abre a tela de compartilhar (WhatsApp, Drive, "Abrir com" Acrobat…); no computador, baixa */
  function entregarArquivo(blob, nome, tipo, titulo) {
    var arq = null; try { arq = new File([blob], nome, { type: tipo }); } catch (e) {}
    if (arq && navigator.canShare && navigator.canShare({ files: [arq] })) {
      navigator.share({ files: [arq], title: titulo }).catch(function () {});
      return;
    }
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: nome }); d.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    avisar(T('cmp_baixado'));
  }
  /* PDF de verdade, gerado aqui (sem impressora): cada bloco (capa, dias, rodapé) vira imagem nítida e é arrumado em páginas A4,
     quebrando só entre itens do dia, nunca no meio de um; os links "ver no mapa" continuam clicáveis */
  var pdfLibs = null;
  function carregarPdf() {
    if (window.jspdf && window.html2canvas) return Promise.resolve();
    if (pdfLibs) return pdfLibs;
    pdfLibs = ['vendor/pdf/html2canvas.min.js', 'vendor/pdf/jspdf.umd.min.js'].reduce(function (p, src) {
      return p.then(function () { return new Promise(function (ok, erro) { var s = h('script', { src: src }); s.onload = ok; s.onerror = function () { pdfLibs = null; erro(new Error('pdf')); }; d.head.appendChild(s); }); });
    }, Promise.resolve());
    return pdfLibs;
  }
  function gerarPdf(doc) {
    /* moldura isolada: só o estilo do documento (sem o do app, que tem classes com o mesmo nome) */
    var moldura = h('iframe', { id: 'gx-pdf', 'aria-hidden': 'true', tabindex: '-1' }), caixa;
    var limpar = function () { moldura.remove(); };
    return carregarPdf().then(function () {
      return new Promise(function (ok) {
        moldura.onload = function () { ok(); };
        moldura.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><style>' + doc.estilo + 'body{margin:0;background:#fff}.doc{width:720px;padding:0;margin:0}.capa,.dia{margin:0}</style></head><body>' + doc.corpo + '</body></html>';
        d.body.appendChild(moldura);
      });
    }).then(function () {
      caixa = moldura.contentDocument.body;
      var imgs = [].slice.call(caixa.querySelectorAll('img'));
      return Promise.all(imgs.map(function (im) { return im.complete ? null : new Promise(function (ok) { im.onload = im.onerror = ok; }); }));
    }).then(function () {
      /* códigos de barras são SVG: o montador do PDF não desenha SVG, então viram PNG nítido antes */
      var svgs = [].slice.call(caixa.querySelectorAll('img')).filter(function (im) { return /^data:image\/svg/.test(im.getAttribute('src') || ''); });
      return Promise.all(svgs.map(function (im) {
        return new Promise(function (ok) {
          var fonte = new Image();
          fonte.onload = function () {
            var cv = h('canvas'); cv.width = 1200; cv.height = 260;
            var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
            g.drawImage(fonte, 0, 0, cv.width, cv.height);
            im.onload = im.onerror = function () { ok(); }; im.src = cv.toDataURL('image/png');
          };
          fonte.onerror = function () { ok(); };
          fonte.src = im.getAttribute('src');
        });
      }));
    }).then(function () {
      var pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      var M = 10, LARG = 190, ALT = 297 - 2 * M, y = M, GAP = 4;
      var blocos = [].slice.call(caixa.querySelectorAll('.doc > header, .doc > section, .doc > footer'));
      return blocos.reduce(function (p, el) {
        return p.then(function () {
          return window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true }).then(function (cv) {
            var base = el.getBoundingClientRect(), pxmm = LARG / base.width;   /* mm por px de tela */
            /* onde dá para cortar: entre um item e outro do dia */
            var cortes = [].slice.call(el.querySelectorAll('li')).slice(1).concat([].slice.call(el.querySelectorAll('.cod'))).map(function (x) { return x.getBoundingClientRect().top - base.top - 4; })
              .filter(function (t) { return t > 40; }).sort(function (a, b) { return a - b; });
            var links = [].slice.call(el.querySelectorAll('a[href]')).map(function (a) { var r = a.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, url: a.href }; });
            var textos = [].slice.call(el.querySelectorAll('code.copiavel')).map(function (c) { var r = c.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, t: c.textContent }; });
            var escala = cv.width / base.width, ini = 0, total = base.height;
            while (ini < total - 1) {
              var cabe = (M + ALT - y) / pxmm;                       /* px que ainda cabem nesta página */
              if (cabe < 40 && y > M) { pdf.addPage(); y = M; continue; }
              var fim = total;
              if (total - ini > cabe) {
                var cand = cortes.filter(function (c) { return c > ini + 20 && c - ini <= cabe; });
                if (cand.length) fim = cand[cand.length - 1];
                else if (y > M) { pdf.addPage(); y = M; continue; }   /* nem um item cabe: começa em página nova */
                else fim = ini + cabe;                                 /* item maior que a página: corta mesmo */
              }
              var fatia = h('canvas'); fatia.width = cv.width; fatia.height = Math.ceil((fim - ini) * escala);
              fatia.getContext('2d').drawImage(cv, 0, Math.floor(ini * escala), cv.width, fatia.height, 0, 0, cv.width, fatia.height);
              var hmm = (fim - ini) * pxmm;
              pdf.addImage(fatia.toDataURL('image/jpeg', 0.9), 'JPEG', M, y, LARG, hmm);
              links.forEach(function (l) { if (l.y >= ini && l.y + l.h <= fim) pdf.link(M + l.x * pxmm, y + (l.y - ini) * pxmm, l.w * pxmm, l.h * pxmm, { url: l.url }); });
              textos.forEach(function (c) {
                if (c.y < ini || c.y + c.h > fim) return;
                var alt = c.h * pxmm, tam = alt / 0.3528 * 0.8;   /* mm → pontos */
                pdf.setFont('courier', 'normal'); pdf.setFontSize(tam);
                var largTxt = pdf.getTextWidth(c.t), escalaH = largTxt ? (c.w * pxmm) / largTxt : 1;
                pdf.text(c.t, M + c.x * pxmm, y + (c.y - ini) * pxmm + alt * 0.8, { renderingMode: 'invisible', horizontalScale: escalaH });
              });
              y += hmm + GAP; ini = fim;
            }
          });
        });
      }, Promise.resolve()).then(function () { var b = pdf.output('blob'); limpar(); return b; });
    }).catch(function (e) { limpar(); throw e; });
  }
  /* PDF: imprime só o documento (o sistema oferece "Salvar como PDF"; no iPhone, Compartilhar → Salvar em Arquivos) */
  function imprimirDocumento(corpo, estilo) {
    var caixa = $('gx-impressao'); if (caixa) caixa.remove();
    caixa = h('div', { id: 'gx-impressao' });
    caixa.innerHTML = '<style>' + estilo + '</style>' + corpo;   /* conteúdo montado aqui mesmo, tudo escapado por esc() */
    d.body.appendChild(caixa); d.body.classList.add('imprimindo');
    var limpar = function () { d.body.classList.remove('imprimindo'); var c2 = $('gx-impressao'); if (c2) c2.remove(); window.removeEventListener('afterprint', limpar); };
    window.addEventListener('afterprint', limpar);
    setTimeout(function () { window.print(); setTimeout(limpar, 60000); }, 300);
  }
  function montarDocumentoViagem(v, op) {
    var dias = diasDaViagem(v), o = estado.opcao;
    var pr = op.codigos ? abrirReservas(v).then(function () { return carregarQR().catch(function () {}); }) : Promise.resolve();
    return pr.then(function () {
      return Banco.listar('reservas', function (r) { return r.viagem_id === v.id && !r.apagado; });
    }).then(function (rs) {
      return Promise.all(rs.map(function (r) {
        if (!op.codigos) return { reg: r, c: null };
        return Cofre.decifrarReserva(r.conteudo).then(function (c) { return { reg: r, c: c }; }, function () { return { reg: r, c: null }; });
      }));
    }).then(function (rs) {
      function mapa(lat, lng, q) {
        if (!op.mapas) return '';
        var alvo = lat != null && lng != null ? lat + ',' + lng : q; if (!alvo) return '';
        return ' <a class="mapa" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(alvo) + '">' + esc(T('cmp_verMapa')) + '</a>';
      }
      /* códigos juntos numa área de expandir (no PDF já aberta): um cartãozinho por pessoa; a observação aparece uma vez só */
      function codigosDe(lista) {
        if (!op.codigos) return '';
        var cards = '', notas = [], n = 0, todasNotas = [];
        lista.forEach(function (x) { if (x.c && x.c.nota && todasNotas.indexOf(x.c.nota) < 0) todasNotas.push(x.c.nota); });
        var notaPorCartao = todasNotas.length > 1;   /* observações diferentes por pessoa (ex.: voucher e senha): ficam dentro do cartão */
        lista.slice().sort(function (a, b) { return String((a.c || {}).pessoa || '').localeCompare(String((b.c || {}).pessoa || ''), 'pt'); }).forEach(function (x) {
          var c = x.c; if (!c || !(c.codigo || c.qr || c.barra)) return;
          n++;
          var img = '', larga = false;
          try {
            if (c.barra && window.Barras) { larga = true; img = '<img class="cod-img cod-barras" alt="" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Barras.svg(c.barra, c.barraFormato)) + '">'; }
            else if (c.qr && window.qrcode) { var q = qrcode(0, 'M'); q.addData(String(c.qr)); q.make(); img = '<img class="cod-img" alt="" src="' + q.createDataURL(4, 4) + '">'; }
          } catch (e) {}
          var loc = !img;   /* sem QR nem barras: é localizador (voo, hotel, carro) — número grande, azul */
          cards += '<div class="cod' + (larga ? ' larga' : '') + (loc ? ' loc' : '') + '">' + (c.pessoa ? '<b>' + esc(c.pessoa) + '</b>' : '') + (c.assento ? '<small>' + esc(c.assento) + '</small>' : '') +
            img + (c.codigo ? '<code class="copiavel">' + esc(c.codigo) + '</code>' + (op.pdf ? '' : '<button type="button" class="copiar" data-c="' + esc(c.codigo) + '">📋 ' + esc(T('copiar')) + '</button>') : '') + (c.barra && c.barra !== c.codigo ? '<code class="num">' + esc(c.barra) + '</code>' : '') +
            (notaPorCartao && c.nota ? '<details class="mais"' + (op.pdf ? ' open' : '') + '><summary>' + esc(T('cmp_mais')) + '</summary><small>' + esc(c.nota) + '</small></details>' : '') + '</div>';
          if (!notaPorCartao && c.nota && notas.indexOf(c.nota) < 0) notas.push(c.nota);
        });
        if (!n) return '';
        var rotulo = lista[0] && lista[0].reg && (lista[0].reg.tipo === 'ingresso') ? T('cmp_mostrarCodigos', { n: n }) : T('cmp_mostrarLocalizador', { n: n });
        return '<details class="codigos"' + (op.pdf ? ' open' : '') + '><summary>' + esc(rotulo) + '</summary><div class="cods">' + cards + '</div>' +
          notas.map(function (t) { return '<p class="nota-res">' + esc(t) + '</p>'; }).join('') + '</details>';
      }
      var hoje = new Date();
      var html = '<header class="capa"><p class="selo">' + marcaHtml('GuiaXpert') + '</p><h1>' + esc(v.nome) + '</h1><p class="datas">' +
        esc(v.inicio === v.fim ? semana(v.inicio) + ', ' + fData(v.inicio) : fData(v.inicio) + ' – ' + fData(v.fim)) + (v.destinoTexto ? ' · ' + esc(v.destinoTexto) : '') + '</p>';
      if (op.hotel) {
        var e = (v.estadias || [])[0];
        if (e && (e.nome || e.endereco)) html += '<p class="hotel">🏨 ' + esc(e.nome || '') + (e.endereco ? ' — ' + esc(e.endereco) : '') + mapa(e.lat, e.lng, e.endereco || e.nome) + '</p>';
      }
      html += '</header>';
      /* participantes (recolhido; no PDF, aberto) e contatos, quando houver */
      if (op.pessoas) {
        var ORD = { eu: 0, conjuge: 1, filho: 2, neto: 3, pai: 4, sogro: 5, avo: 6, irmao: 7, amigo: 8, outro: 9 };
        var ps = estado.pessoas.filter(function (p2) { return (v.pessoas || []).indexOf(p2.id) > -1; })
          .sort(function (a, b) { return ((ORD[a.parentesco] != null ? ORD[a.parentesco] : 9) - (ORD[b.parentesco] != null ? ORD[b.parentesco] : 9)) || ((+b.idade || 0) - (+a.idade || 0)); });
        var contatos = [];
        (v.estadias || []).forEach(function (e) { if (e.nome && e.telefone) contatos.push('🏨 ' + e.nome + ': ' + e.telefone); });
        rs.forEach(function (x) { var a = x.reg.agenda; if (x.reg.tipo === 'hotel' && a && a.local) { var m = String(a.local).match(/\(\d{2}\)\s?\d{4,5}-?\d{4}/); if (m && !contatos.some(function (c) { return c.indexOf(m[0]) > -1; })) contatos.push('🏨 ' + String(a.titulo).split('·')[0].trim() + ': ' + m[0]); } });
        if (ps.length || contatos.length) {
          html += '<section class="bloco-pessoas"><details' + (op.pdf ? ' open' : '') + '><summary>' + (ps.length ? '👨‍👩‍👧 ' + esc(T('cmp_participantes', { n: ps.length })) : '☎ ' + esc(T('cmp_contatos'))) + '</summary><ul class="pessoas">' +
            ps.map(function (p2) { var nome = p2.apelido || T('par_' + p2.parentesco); var extra = [p2.apelido ? T('par_' + p2.parentesco) : null, p2.idade !== '' && p2.idade != null ? T('anos', { n: p2.idade }) : null].filter(Boolean).join(' · ');
              return '<li><b>' + esc(nome) + '</b>' + (extra ? ' <small>' + esc(extra) + '</small>' : '') + (p2.telefone ? ' · <a href="tel:' + esc(String(p2.telefone).replace(/[^\d+]/g, '')) + '">' + esc(p2.telefone) + '</a>' : '') + '</li>'; }).join('') + '</ul>' +
            (contatos.length ? '<p class="contatos">' + (ps.length ? '<b>' + esc(T('cmp_contatos')) + '</b><br>' : '') + contatos.map(function (c) { var tel = (c.match(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/) || [''])[0]; return tel ? esc(c.replace(tel, '')) + '<a href="tel:+55' + tel.replace(/\D/g, '') + '">' + esc(tel) + '</a>' : esc(c); }).join('<br>') + '</p>' : '') +
            '</details></section>';
        }
      }
      dias.forEach(function (dia, i) {
        var linhas = [];
        /* compromissos fixos (reservas com dia e hora), agrupados como no app */
        var grupos = {}, ordem = [];
        rs.forEach(function (x) {
          var a = x.reg.agenda; if (!a || !a.quando || a.quando.slice(0, 10) !== dia) return;
          if (!op.hotel && (x.reg.tipo === 'hotel' || x.reg.tipo === 'voo' || x.reg.tipo === 'carro')) return;
          var k = a.grupo || (a.titulo + '|' + a.quando); if (!grupos[k]) { grupos[k] = []; ordem.push(k); } grupos[k].push(x);
        });
        var objs = ordem.map(function (k) { var a = grupos[k][0].reg.agenda; return { tipo: grupos[k][0].reg.tipo, titulo: a.titulo, quando: a.quando }; });
        var chv = chavesComoNaVida(objs);
        ordem.forEach(function (k, n) {
          var g = grupos[k], a = g[0].reg.agenda, hh = a.quando.slice(11, 16), pr2 = papelReserva(objs[n]);
          var quando = !hh ? '' : (pr2 === 'entra' && g[0].reg.tipo === 'hotel') ? T('aPartirDe', { h: hh }) : pr2 === 'sai' ? T('ateAs', { h: hh }) : hh;
          linhas.push({ k: chv[n].slice(11), html: '<li class="fixo"><span class="h">' + esc(objs[n]._fimDoDia ? '' : (hh || '—')) + '</span><div><b>🔒 ' + esc(a.titulo) + '</b>' +
            (g.length > 1 ? ' <span class="etq">' + esc(T('nIngressos', { n: g.length })) + '</span>' : '') + (quando && quando !== hh ? '<br><small>' + esc(quando) + '</small>' : '') +
            (a.local ? '<br><small>' + esc(a.local) + '</small>' + mapa(a.lat, a.lng, a.local) : '') + codigosDe(g) + '</div></li>' });
        });
        /* atividades do roteiro escolhido */
        if (op.roteiro && o && o.dias && o.dias.length) {
          var dm = o.dias[mapearDia(i, dias.length, o.dias.length)] || { itens: [] };
          (dm.itens || []).forEach(function (it) {
            var l = it.lugarId ? lugarPorId(it.lugarId) : null;
            linhas.push({ k: (it.hora || '99:99') + '|6', html: '<li><span class="h">' + esc(it.hora || '') + (it.fim ? '<br><small>–' + esc(it.fim) + '</small>' : '') + '</span><div><b>' + (it.alt ? '🔀 ' : '') + esc(it.titulo || (l && l.nome) || '') + '</b>' + (it.alt ? ' <small>(' + esc(T('altCurto')) + ')</small>' : '') +
              (it.nota ? '<br><small>' + escLinks(it.nota) + '</small>' : '') + (l && l.endereco ? '<br><small>' + esc(l.endereco) + '</small>' : '') +
              (l ? mapa(l.lat, l.lng, l.endereco || l.nome) : '') + '</div></li>' });
          });
        }
        linhas.sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; });
        html += '<section class="dia"><h2>📅 ' + esc(semana(dia) + ', ' + fData(dia)) + '</h2>' +
          (linhas.length ? '<ul>' + linhas.map(function (x) { return x.html; }).join('') + '</ul>' : '<p class="livre">' + esc(T('cmp_diaLivre')) + '</p>') + '</section>';
      });
      html += '<footer>' + marcaHtml(esc(T('cmp_rodape', { data: fData(iso(hoje)) }))) + '<br>' + esc(T('cmp_semCodigos' + (op.codigos ? 'Com' : ''))) + '</footer>';
      var estilo = 'body{margin:0;font-family:-apple-system,system-ui,"Segoe UI",Roboto,sans-serif;color:#172024;background:#f3f5f4}' +
        '.doc{max-width:760px;margin:0 auto;padding:16px}' +
        '.capa{background:#0e5a43;color:#fff;border-radius:18px;padding:20px 18px;margin-bottom:14px}.capa h1{margin:.1em 0;font-size:1.6rem}.selo{margin:0;font-size:1rem;font-weight:700;letter-spacing:.01em}.marca-x{font-weight:900;color:#ff7a1a}.capa .marca-x{color:#ffb070}' +
        '.bloco-pessoas{background:#fff;border-radius:16px;padding:10px 16px;margin:12px 0}.bloco-pessoas summary{font-weight:700;color:#0e5a43;padding:4px 0}.pessoas{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 14px}.contatos{margin:8px 0 2px;font-size:.9em}.contatos a,.pessoas a{color:#1a5fb4}.datas,.hotel{margin:.3em 0}.capa a{color:#fcf1cc}' +
        '.doc{font-size:17px;line-height:1.4}' +
        '.dia{background:#fff;border-radius:16px;padding:14px 16px;margin:12px 0}.dia h2{margin:0 0 .4em;font-size:1.3rem;color:#a16207;text-align:left;letter-spacing:.01em}' +
        '.dia ul{list-style:none;margin:0;padding:0}.dia li{display:flex;gap:12px;padding:9px 0;border-top:1px solid #e3e9e6}.dia li:first-child{border-top:0}' +
        '.dia li>div{flex:1;min-width:0;overflow-wrap:anywhere}' +
        '.h{flex:none;width:4.2em;font-weight:700;color:#0e5a43;white-space:nowrap}.h:empty{display:none}.h:not(:empty)::before{content:"🕒 ";font-size:.85em}.fixo b{color:#6a3a1c}small{color:#55636a;font-size:.88em}.etq{font-size:.8em;background:#fcf1cc;border-radius:8px;padding:1px 6px;white-space:nowrap}' +
        '.mapa{font-size:.85em;color:#0e5a43;white-space:nowrap}.livre{color:#55636a;margin:0}' +
        '.codigos{margin-top:8px}summary{display:block;list-style:none;cursor:pointer}summary::-webkit-details-marker{display:none}.codigos>summary{color:#0e5a43;font-weight:700;padding:6px 0}.codigos>summary::before{content:"▸ "}.codigos[open]>summary::before{content:"▾ "}' +
        '.cods{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:8px;margin-top:6px}' +
        '.cod{border:1px solid #e3e9e6;border-radius:12px;padding:8px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:3px;break-inside:avoid;page-break-inside:avoid}' +
        '.cod.larga{grid-column:1/-1}.cod-img{width:118px;height:118px;image-rendering:pixelated;background:#fff;margin:2px 0}.cod-img.cod-barras{width:100%;max-width:300px;height:58px}' +
        '.mais{align-self:stretch;text-align:left}.mais summary{cursor:pointer;color:#0e5a43;font-size:.85em;text-align:center}.mais small{display:block;margin-top:4px}' +
        'code{font-size:.95em;letter-spacing:.02em}.num{color:#55636a;font-size:.8em}.nota-res{color:#55636a;font-size:.85em;margin:6px 0 0}' +
        '.copiavel{-webkit-user-select:all;user-select:all}.cod code.copiavel{font-size:1.08em;font-weight:800;color:#1a5fb4;letter-spacing:.02em;white-space:nowrap;overflow-wrap:normal}' +
        '.cod.loc{grid-column:1/-1}.cod.loc code.copiavel{font-size:1.5em;letter-spacing:.06em;white-space:nowrap;overflow-wrap:normal}' +
        '@media (min-width:521px){.cod.larga{grid-column:span 2}}' +
        '.copiar{margin-top:4px;border:1px solid #c9d6e8;background:#eef4fc;color:#1a5fb4;border-radius:999px;padding:5px 12px;font:inherit;font-size:.85em;font-weight:700;cursor:pointer}' +
        '@media print{.copiar{display:none}}' +
        '@media (max-width:520px){.dia li{flex-direction:column;gap:2px}.h{width:auto;font-size:.85em;color:#0e5a43}.dia{padding:12px 14px}}' +
        'footer{color:#55636a;font-size:.8rem;text-align:center;margin:18px 0 8px}' +
        '@media print{body{background:#fff}.doc{padding:0}.capa{-webkit-print-color-adjust:exact;print-color-adjust:exact}.dia{border:1px solid #d3dbd8}}';
      var corpo = '<div class="doc">' + html + '</div>';
      var docHtml = '<!doctype html><html lang="' + (idioma() === 'en' ? 'en' : 'pt-BR') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>' + esc(nomeArquivo(v.nome)) + '</title><style>' + estilo + '</style></head><body>' + corpo +
        (op.codigos ? '<script>document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".copiar");if(!b)return;var t=b.getAttribute("data-c"),ok=function(){var o=b.textContent;b.textContent="✓ ' + esc(T('cmp_copiado')) + '";setTimeout(function(){b.textContent=o},1600)};' +
          'if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).then(ok,velho)}else velho();function velho(){var a=document.createElement("textarea");a.value=t;a.style.position="fixed";a.style.opacity="0";document.body.appendChild(a);a.select();try{document.execCommand("copy");ok()}catch(x){}a.remove()}});</script>' : '') +
        '</body></html>';
      return { html: docHtml, corpo: corpo, estilo: estilo };
    });
  }
  /* cartão de texto (hotel ou voos) para mandar pelo WhatsApp: pede o cofre, monta só o essencial */
  function compartilharCartao(v, tipo) {
    var corpo = h('div', {}), j = janela(T(tipo === 'hotel' ? 'compartilharHotel' : 'compartilharVoos'), corpo);
    abrirReservas(v).then(function () {
      Banco.listar('reservas', function (r) { return r.viagem_id === v.id && r.tipo === tipo; }).then(function (rs) {
        return Promise.all(rs.map(function (r) { return Cofre.decifrarReserva(r.conteudo).catch(function () { return null; }); }));
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
  function convitePendente() { try { return localStorage.getItem('guiaxpert.convite'); } catch (e) { return null; } }
  /* fase 1: aceita no servidor. Pode rodar antes de o app estar liberado: ser da viagem já libera o app */
  /* o convite foi para outro e-mail (ex.: entrou pelo Google do trabalho): pede só o código, sem drama */
  function pedirCodigoConvite(nome, msgErro) {
    return new Promise(function (ok) {
      var eu = (Conta.sessao() || {}).email || '';
      var cod = h('input', { class: 'campo', id: 'gx-pc-cod', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: T('digite6') });
      var msg = h('p', { class: 'pequeno', role: 'status', 'aria-live': 'polite', texto: msgErro || '' });
      var bt = h('button', { class: 'bt', type: 'button', texto: T('conviteEntrar') });
      var feito = false;
      var j = janela('✉️ ' + (nome ? T('conviteParaViagem', { viagem: nome }) : T('convite')), h('div', { class: 'linha', style: 'flex-direction:column;align-items:stretch' }, [
        h('p', { class: 'sub', texto: T('conviteOutroEmail', { email: eu }) }),
        h('label', { class: 'rot', for: 'gx-pc-cod', texto: T('conviteCodigoRot') }), cod, bt, msg]), function () { if (!feito) ok(null); });
      function ir() { if (!/^\d{6}$/.test(cod.value.trim())) { msg.textContent = T('conviteCodigoFormato'); cod.focus(); return; } feito = true; j.fechar(function () { ok(cod.value.trim()); }); }
      bt.addEventListener('click', ir); cod.addEventListener('keydown', function (e) { if (e.key === 'Enter') ir(); });
      setTimeout(function () { cod.focus(); }, 60);
    });
  }
  function aceitarConviteNoServidor() {
    var tok = convitePendente();
    if (!tok || !Conta.sessao() || !window.Nuvem) return Promise.resolve(false);
    try { localStorage.removeItem('guiaxpert.convite'); } catch (e) {}
    avisar(T('aceitandoConvite'));
    function tentar(codigo) {
      return Nuvem.aceitarConvite(tok, codigo).then(function (r) {
        if (r && r.erro === 'codigo-necessario' || r && r.erro === 'codigo-errado') {
          return pedirCodigoConvite(r.nome, r.erro === 'codigo-errado' ? T('conviteCodigoErrado') : '').then(function (c) {
            if (!c) { try { localStorage.setItem('guiaxpert.convite', tok); } catch (e) {} return false; }   /* desistiu: o convite continua guardado */
            return tentar(c);
          });
        }
        if (r && r.erro === 'travado') { avisar(T('conviteTravado')); return false; }
        if (!r || !r.viagem_id) return false;
        try { localStorage.setItem('guiaxpert.conviteRecente', JSON.stringify({ viagem_id: r.viagem_id, nome: r.nome || '', jaEra: !!r.ja_era })); } catch (e) {}
        return true;
      });
    }
    return tentar(null).catch(function (e) {
      /* já era da viagem (ex.: abriu o convite de novo): segue normal */
      avisar(e && /dono/i.test(e.message) ? T('conviteSeu') : e && /inválido|vencido/i.test(e.message) ? T('conviteInvalido') : T('erroRede'));
      return false;
    });
  }
  /* fase 2: com o app liberado, traz a viagem e abre nela */
  function aceitarConvitePendente() {
    return aceitarConviteNoServidor().then(function () {
      var rec = null; try { rec = JSON.parse(localStorage.getItem('guiaxpert.conviteRecente') || 'null'); localStorage.removeItem('guiaxpert.conviteRecente'); } catch (e) {}
      if (!rec || !rec.viagem_id) return false;
      return Nuvem.sincronizar().then(function () { return Contexto.definir('viagem', rec.viagem_id); }).then(recarregarContexto).then(function () {
        avisar(T(rec.jaEra ? 'conviteJaEra' : 'conviteAceito', { nome: rec.nome || '' })); Nav.ir('inicio', { substituir: true }); return true;
      });
    }).catch(function () { return false; });
  }
  /* chegou por convite com e-mail: digita o código e cria a senha; a conta nasce pronta e já entra na viagem */
  function formConviteCodigo(caixa, tok, x) {
    var cod = h('input', { class: 'campo', id: 'gx-cc-cod', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: T('digite6') });
    var senha = h('input', { class: 'campo', id: 'gx-cc-senha', type: 'password', autocomplete: 'new-password', placeholder: T('senha8') });
    var ver = h('button', { class: 'bt leve', type: 'button', 'aria-label': T('mostrarSenha'), texto: '👁', onclick: function () { senha.type = senha.type === 'password' ? 'text' : 'password'; } });
    var msg = h('p', { class: 'pequeno', role: 'status', 'aria-live': 'polite' });
    var bt = h('button', { class: 'bt cheio', type: 'button', texto: T('conviteEntrar') });
    [h('span', { class: 'rot', texto: T('email') }), h('b', { class: 'campo-fixo', texto: x.email }),
      h('label', { class: 'rot', for: 'gx-cc-cod', texto: T('conviteCodigoRot') }), cod,
      h('label', { class: 'rot', for: 'gx-cc-senha', texto: T('conviteSenhaRot') }), h('div', { class: 'linha', style: 'flex-wrap:nowrap' }, [senha, ver]),
      bt, msg].forEach(function (el) { caixa.appendChild(el); });
    function ir() {
      if (!/^\d{6}$/.test(cod.value.trim())) { msg.textContent = T('conviteCodigoFormato'); cod.focus(); return; }
      if (senha.value.length < 8) { msg.textContent = T('senha8'); senha.focus(); return; }
      bt.disabled = true; msg.textContent = T('carregando');
      Conta.contaPeloConvite(tok, cod.value.trim(), senha.value).then(function (j) {
        if (j && j.ok) { msg.textContent = T('conviteContaPronta'); iniciarAcesso(); return; }
        bt.disabled = false;
        if (j && j.existe) {
          msg.textContent = T('conviteJaTemConta');
          var em = $('gx-email'); if (em) { em.value = j.email; var sn = $('gx-senha'); if (sn) sn.focus(); }
          return;
        }
        msg.textContent = T({ codigo: 'conviteCodigoErrado', travado: 'conviteTravado', senha: 'senha8' }[j && j.erro] || 'conviteInvalido');
      }).catch(function () { bt.disabled = false; msg.textContent = navigator.onLine ? T('erroRede') : T('semInternet'); });
    }
    bt.addEventListener('click', ir);
    senha.addEventListener('keydown', function (e) { if (e.key === 'Enter') ir(); });
    var em = $('gx-email'); if (em && !em.value) em.value = x.email;
    setTimeout(function () { cod.focus(); }, 80);
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
      if (!vs.length) tela.appendChild(h('p', { class: 'sub', texto: T('semViagemTexto') }));
      var futuras = vs.filter(function (v) { return !ehPassada(v); }).sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
      var passadas = vs.filter(ehPassada).sort(function (a, b) { return a.inicio > b.inicio ? -1 : 1; });
      var alvo = tela;
      if (futuras.length) tela.appendChild(h('h2', { class: 'secao', texto: T('proximasViagens') }));
      futuras.concat(passadas).forEach(function (v, i) {
        if (i === futuras.length) {
          var det = h('details', { class: 'arquivo-viagens' }, [h('summary', { texto: '🗂 ' + T('arquivoViagens', { n: passadas.length }) }),
            h('p', { class: 'pequeno', texto: T('arquivoTexto') })]);
          tela.appendChild(det); alvo = det;
        }
        var atual = estado.viagem && estado.viagem.id === v.id;
        alvo.appendChild(h('div', { class: 'cartao' + (ehPassada(v) ? ' passada' : ''), style: atual ? 'border-color:var(--serra)' : null }, [
          h('div', { class: 'linha entre' }, [h('b', { texto: iconeViagem(v) + ' ' + v.nome }), atual ? h('span', { class: 'etq gratis', texto: T('emUso') }) : null]),
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
  function ehIphoneIcone() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && (navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)); }
  TELAS.entrar = function (tela) {
    var a = estado.acesso || {}, s = Conta.sessao();
    setTimeout(function () {
      if (!s && ehIphoneIcone()) tela.appendChild(h('div', { class: 'cartao' }, [h('b', { texto: '📱 ' + T('iphoneDicaTitulo') }), h('p', { class: 'sub', texto: T('iphoneDica') })]));
      tela.appendChild(rodapeVersao());
    }, 0);
    var faixa = faixaFotos(T('entrarTitulo'), T('entrarTexto'));
    tela.appendChild(faixa);
    var tokConvite = convitePendente();
    if (tokConvite) {
      var aviso = h('div', { class: 'cartao convite-chegou', role: 'status' });
      Conta.rpcPublico('guiaxpert_ver_convite', { p_token: tokConvite }).then(function (r) {
        var x = Array.isArray(r) ? r[0] : r; if (!x || !x.viagem) return;
        aviso.appendChild(h('b', { texto: '✉️ ' + T('conviteDe', { quem: x.quem || '', viagem: x.viagem }) }));
        faixa.parentNode && faixa.parentNode.insertBefore(aviso, faixa.nextSibling);
        if (s) { aviso.appendChild(h('p', { class: 'sub', texto: T('conviteEntrouTexto') })); return; }
        aviso.appendChild(h('p', { class: 'sub', texto: T('conviteComoPrefere') }));
        aviso.appendChild(h('button', { class: 'bt-google', type: 'button', onclick: function () { Conta.google(); } }, [h('span', { svg: '<svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>' }), h('span', { texto: T('conviteGoogle') })]));
        if (x.email && x.pede_codigo) { aviso.appendChild(h('p', { class: 'pequeno', texto: T('conviteOuEmail', { email: x.email }) })); formConviteCodigo(aviso, tokConvite, x); return; }
        aviso.appendChild(h('p', { class: 'pequeno', texto: T('conviteOuSenha') }));
      }).catch(function () {});
    }
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
      /* login social primeiro, em destaque (quem veio por convite já tem o botão no cartão do convite) */
      if (!convitePendente()) {
        var ult = Conta.ultimoJeito && Conta.ultimoJeito();
        tela.appendChild(h('div', { class: 'cartao' }, [
          ult && ult.modo === 'google' ? h('p', { class: 'pequeno', texto: '⭐ ' + T('ultimaVezGoogle') }) : null,
          h('button', { class: 'bt-google', type: 'button', onclick: function () { Conta.google(); } }, [h('span', { svg: '<svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>' }), h('span', { texto: T('conviteGoogle') })]),
          h('p', { class: 'pequeno ou', texto: T('ouComEmail') })]));
      }
      tela.appendChild(h('div', { class: 'cartao' }, [
        h('label', { class: 'rot', for: 'gx-email', texto: T('email') }), email,
        h('label', { class: 'rot', for: 'gx-senha', texto: T('senha') }), h('div', { class: 'linha', style: 'flex-wrap:nowrap' }, [senha, ver]), bt, msg,
        h('div', { class: 'linha' }, [
          h('button', { class: 'lk', type: 'button', onclick: function () { if (!email.value) { msg.textContent = T('digiteEmail'); email.focus(); return; } Conta.esqueci(email.value).then(function () { msg.textContent = T('emailEnviado'); }).catch(function () { msg.textContent = T('erroRede'); }); } }, T('esqueciSenha')),
          h('button', { class: 'lk', type: 'button', onclick: function () { if (!email.value || senha.value.length < 8) { msg.textContent = T('criarContaDica'); return; } Conta.criarConta(email.value, senha.value).then(function (j) { msg.textContent = j && j.access_token ? T('contaCriada') : T('confirmeEmail'); if (j && j.access_token) iniciarAcesso(); }).catch(function (e) { msg.textContent = e.message || T('erroRede'); }); } }, T('criarConta'))
        ])
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
    tela.appendChild(cartaoProntoSemInternet());
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
    tela.appendChild(h('p', { class: 'pequeno' }, [comMarca(h('button', { class: 'lk', type: 'button', texto: 'GuiaXpert ' + VERSAO_APP + ' · ' + T('verNovidades'), onclick: function () { verNovidades(null); } })), ' · ' + T('umaSolucao')]));
    tela.appendChild(h('button', { class: 'bt leve', type: 'button', texto: '🔄 ' + T('procurarAtualizacao'), onclick: function () { procurarAtualizacao(true); } }));
  };
  /* "Pronto para usar sem internet": confere o que já está guardado neste aparelho e oferece o que falta */
  function cartaoProntoSemInternet() {
    var v = estado.viagem, lista = h('ul', { class: 'checagem' });
    var c = h('div', { class: 'cartao' }, [h('h3', { texto: T('sem_titulo') }), h('p', { class: 'sub', texto: T('sem_texto') }), lista]);
    function linha(ok, txt, bt) { lista.appendChild(h('li', { class: ok ? 'ok' : 'falta' }, [h('span', { class: 'marca', 'aria-hidden': 'true', texto: ok ? '✓' : '!' }), h('span', { texto: txt }), bt || null])); }
    var arquivos = ['index.html', 'js/app.js', 'js/cofre.js', 'js/banco.js', 'js/textos.js', 'styles.css'];
    var pApp = window.caches ? Promise.all(arquivos.map(function (f) { return caches.match(new URL(f, location.href).href); })).then(function (rs) { return rs.every(Boolean); }).catch(function () { return false; }) : Promise.resolve(false);
    var pRes = v ? Banco.listar('reservas', function (r) { return r.viagem_id === v.id && !r.apagado; }).then(function (rs) {
      var precisa = rs.some(function (r) { return r.conteudo && r.conteudo.v === 2; });
      return (precisa ? Banco.meta('viagem-chave:' + v.id, null) : Promise.resolve(true)).then(function (k) { return { n: rs.length, ok: !precisa || !!(k && k.seg) }; });
    }) : Promise.resolve(null);
    var pMapa = v && v.destino && window.Offline ? Offline.estado(v.destino).catch(function () { return null; }) : Promise.resolve(null);
    Promise.all([pApp, pRes, pMapa]).then(function (r) {
      linha(r[0], T(r[0] ? 'sem_appOk' : 'sem_appFalta'));
      if (r[1] && r[1].n) linha(r[1].ok, r[1].ok ? T('sem_resOk', { n: r[1].n }) : T('sem_resFalta'),
        r[1].ok ? null : h('button', { class: 'bt leve', type: 'button', texto: T('rota_reservas'), onclick: function () { Nav.ir('reservas'); } }));
      if (r[2] && r[2].temMapa) {
        var mb = (r[2].bytes / 1048576).toFixed(1).replace('.', ',');
        var bt = r[2].guardado ? null : h('button', { class: 'bt sec', type: 'button', texto: '⬇ ' + T('guardarSemInternet', { mb: mb }), onclick: function () {
          bt.disabled = true; bt.textContent = T('carregando');
          Offline.guardarViagem(v.destino, function () {}).then(function () { avisar(T('guardadoSemInternet')); mostrar('config'); })
            .catch(function () { bt.disabled = false; bt.textContent = '⬇ ' + T('guardarSemInternet', { mb: mb }); avisar(navigator.onLine ? T('erroRede') : T('semInternet')); });
        } });
        linha(r[2].guardado, T(r[2].guardado ? 'sem_mapaOk' : 'sem_mapaFalta'), bt);
      }
      if (v) linha(true, T('sem_dados'));
      linha(jaInstalado(), T(jaInstalado() ? 'sem_instalado' : 'sem_naoInstalado'));
    });
    return c;
  }
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
      if (!a.liberado) {
        /* entrou pela primeira vez por um convite: aceita primeiro (ser da viagem libera o app) e confere de novo */
        if (Conta.sessao() && convitePendente() && a.motivo !== 'sem-internet') return aceitarConviteNoServidor().then(function (ok) { if (ok) return iniciarAcesso(); mostrar('entrar'); });
        mostrar('entrar'); return;
      }
      return recarregarContexto().then(function () {
        /* recarregou a página em #/roteiro? volta para o Roteiro (não para Hoje) */
        var pedida = estado.rotaPedida; estado.rotaPedida = null;
        mostrar(estado.rota === 'entrar' ? (pedida && pedida !== 'entrar' ? pedida : (emViagem() ? 'inicio' : 'explorar')) : estado.rota);
        oferecerBio();
        setTimeout(oferecerInstalar, 2500);
        aceitarConvitePendente().then(function (aceito) { if (!aceito) sincronizarNuvem(); });
        retomarPendente();
        setTimeout(oferecerReservasDoLink, 900);
        setTimeout(avisarAtualizacao, 1600);
        conferirIA();
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
    /* link "#reservas=..." (reservas prontas para guardar): fica na aba até a pessoa entrar e conferir */
    var mRes = hashChegada.match(/^#reservas=([A-Za-z0-9_-]+)$/);
    if (mRes) { try { sessionStorage.setItem('guiaxpert.reservas-link', mRes[1]); } catch (e) {} hashChegada = ''; }
    try { estado.idioma = localStorage.getItem('dgo:guiaxpert:idioma') || ((navigator.language || 'pt').indexOf('pt') === 0 ? 'pt' : 'en'); } catch (e) {}
    try { aplicarTema(localStorage.getItem('dgo:guiaxpert:tema') || 'auto'); } catch (e) {}
    traduzirMoldura();
    lerConvite();
    /* atualização proativa, mesmo no ícone (que pode ficar dias "aberto" em segundo plano):
       ao abrir, quando a internet volta, quando o app volta para a frente (15 min depois da última conferida) e a cada 30 min */
    var ultimaConferida = 0;
    function conferirSePreciso(forcar) {
      if (!forcar && Date.now() - ultimaConferida < 15 * 60000) return;
      ultimaConferida = Date.now();
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update().catch(function () {}); }).catch(function () {});
      procurarAtualizacao(false);
    }
    setTimeout(function () { conferirSePreciso(true); }, 3000);
    window.addEventListener('online', function () { conferirSePreciso(true); });
    d.addEventListener('visibilitychange', function () { if (!d.hidden) conferirSePreciso(false); });
    setInterval(function () { if (!d.hidden) conferirSePreciso(false); }, 30 * 60000);
    var rota = Nav.iniciar();
    estado.rota = rota; estado.rotaPedida = rota;
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
    normalizar: normalizar, notaBusca: notaBusca, ICONES: ICONES, placa: placa, nomeSub: nomeSub, cartaoLugar: cartaoLugar, pegarPosicao: pegarPosicao, restricoesDoGrupo: restricoesDoGrupo,
    somaGostos: function () { return somaGostos; }, recarregarContexto: recarregarContexto, recarregar: recarregar, lugarPorId: lugarPorId, todosLugares: todosLugares, acharJuntos: janelaAcharJuntos, centroViagem: centroViagem, emViagem: emViagem };
})();
/* erro em promessa sem tratamento aparece no console (ajuda o suporte), sem derrubar a tela */
window.addEventListener('unhandledrejection', function (e) { console.error('GuiaXpert: promessa sem tratamento', e.reason && (e.reason.message || e.reason)); });
