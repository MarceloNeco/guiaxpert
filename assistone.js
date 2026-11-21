/* =====================================================================
   assistone.js — o AssistONE, assistente de todos os apps da SolverONE
   Versão 1.0.0 (10/Out/2026)
   ---------------------------------------------------------------------
   POR QUE ESTE ARQUIVO EXISTE
   Decisão do dono (10/Out/2026): o AssistONE sai de dentro do módulo comum
   e vira um arquivo só dele, IGUAL em todos os apps (o master fica no
   repositório rootify-one, como o recursos.js). O módulo comum novo
   (diretrizes.js 1.9.0) não tem mais o AssistONE; sem este arquivo, o app
   que trocar o módulo antigo (1.1.x, que tinha DGO.assistente) pelo novo
   perderia o assistente. Com este arquivo, nada muda para quem usa o app:
   mesma aparência, mesmo jeito, e as escolhas da pessoa ("ligado/desligado",
   "já me apresentei", dicas já vistas) continuam valendo, porque as chaves
   guardadas no aparelho são as mesmas do módulo 1.1.4:
       dgo:<app>:pref:aone:ligado   (true/false)
       dgo:<app>:pref:aone:ola      (já mostrou o "Olá! Eu sou o AssistONE")
       dgo:<app>:pref:aone:dicas    ({ tela: 1 } das dicas já mostradas)
       dgo:<app>:pref:aone:tour     (já fez o tour até o fim)

   ORDEM DOS ARQUIVOS NA PÁGINA (o config precisa vir antes deste arquivo):
     <script src="diretrizes.js"></script>
     <script src="diretrizes-config.js"></script>
     <script src="assistone.js"></script>
   O recursos.js (interruptores, para app sem o módulo) pode vir antes ou
   depois, do jeito que o app já faz hoje.

   App SEM o módulo comum: carrega só este arquivo e diz o que o assistente
   sabe do app:
     <script src="assistone.js" data-app="meu-app"></script>
     <script>AssistONE.configurar({ app: 'meu-app', nome: 'Meu App', assistente: { telas: {…}, tour: […] } });</script>

   O QUE O APP DECLARA (cfg.assistente no diretrizes-config.js — o mesmo
   formato do módulo 1.1.4, então o config dos apps não muda):
       ativo:  true                                // false = este app não tem assistente
       imagem: 'ajuda-botao.png'                   // a arte do personagem (sem ela, um "?")
       tela:   function () { return 'inicio'; }    // padrão: <body data-pagina="...">
       telas:  { inicio: { titulo:{pt,en}, frase:{pt,en}, montar: function () { return elemento },
                           atalhos:[ { rotulo:{pt,en}, acao: function|'#id'|url, principal:true } ] } }
       tour:   [ { seletor:'#busca', titulo:{pt,en}, texto:{pt,en} } ]
       dicas:  { inicio: {pt,en} }                  // uma por tela, uma vez só
       busca:  [ { termo:{pt,en}, sinonimos:['...'], destino: url|'#id'|function, icone:'🎸', descricao:{pt,en} } ]
       wizard: 'inicio'                             // id de um DGO.wizard.definir(...) do app
       esconderCom: ['body.modo-palco']             // com isto visível, o personagem some
       chamado: function (info) { … }               // 1.2.0: "🎫 Abrir um chamado" (regra do dono, 12/Nov/2026). O app
                                                    // recebe { app, tela, titulo, versao, ultimoClique } e abre o chamado
                                                    // do jeito dele. Também vale window.AONE_CHAMADO = function (info) {…}
                                                    // (app que não usa configurar, como o RADAR JUDICIAL). Recurso 'chamado'.
       exemploBusca: {pt,en}                        // opcional: o exemplo dentro do campo de busca

   COMO ELE SE ENCAIXA NO MÓDULO COMUM (sem mexer no diretrizes.js, que tem
   que ser igual em todos os apps):
     - lê o config em DGO.cfg (o DGO.iniciar({...}) do diretrizes-config.js
       junta tudo ali) e começa quando o módulo avisa "dgo:pronto";
     - usa o idioma do módulo (DGO.idioma() e o evento "dgo:idioma"), as
       janelas do módulo (.dgo-modal) para saber quando sumir, o DGO.wizard,
       o DGO.feedback (💬) e os interruptores (DGO.recursos);
     - registra DGO.assistente com os mesmos nomes do 1.1.4 (abrir, fechar,
       ligado, ligar, tour, procurar, dica, recomecar, atualizar), para o
       código dos apps que já chama DGO.assistente.* continuar funcionando;
     - ⚙ Configurações: o 1.9.0 não tem um "gancho" para acrescentar seção.
       Por isso este arquivo fica olhando quando a janela de Configurações do
       módulo abre (ela é colocada no <body>) e põe o cartão "💡 AssistONE"
       logo depois da seção Idioma (o mesmo lugar do 1.1.4). Quem monta as
       Configurações dentro da própria página com DGO.montarConfiguracoes()
       também recebe o cartão. Se o app passar { secoes: [...] } sem
       'assistente', o cartão não entra (igual ao 1.1.4).
   Se a página tiver o módulo ANTIGO (que já tem o AssistONE dentro), este
   arquivo não faz nada, para não aparecer dois personagens.

   INTERRUPTORES do RootifyONE (Controle dos apps):
     - recurso "assistone" desligado → o personagem não aparece nem abre, e o
       cartão das Configurações diz "Desligado pela administração da SolverONE.";
     - comportamento "assistone.dicas" = false → nenhuma dica por tela.
     Lê de DGO.recursos (módulo ≥ 1.6.0) ou de SolverRecursos (recursos.js) e
     redesenha quando chega arquivo novo (aoMudar). O personagem também é
     marcado com data-recurso="assistone" (some sozinho pelo CSS dos dois).

   O balão NÃO entra no histórico do navegador (o Voltar do celular continua
   levando às telas). Ele some quando há janela, menu ou tela cheia aberta.
   Sem nenhum segredo neste arquivo: ele só mostra ajuda.
   ===================================================================== */
(function (raiz) {
  'use strict';
  if (raiz.AssistONE) return;          /* carregado duas vezes: fica o primeiro */

  var VERSAO = '1.2.0';
  var d = document;
  var eu = d.currentScript;
  var proprio = null;                   /* config dado por AssistONE.configurar (app sem o módulo) */

  /* ------------------------------------------------------------------
     Peças do módulo comum, quando ele está na página
     ------------------------------------------------------------------ */
  function dgo() { return raiz.DGO && raiz.DGO.__carregado ? raiz.DGO : null; }
  /* módulo antigo (1.1.x) já tem o AssistONE dentro: não pode haver dois */
  function moduloTemOProprio() { var D = dgo(); return !!(D && D.assistente && !D.assistente.__assistone); }
  function cfgModulo() { var D = dgo(); return (D && D.cfg) || {}; }
  function cfgApp() { return proprio || cfgModulo(); }
  function conf() {
    var a = (proprio && proprio.assistente) || cfgModulo().assistente;
    return a || {};
  }
  function idApp() {
    return (proprio && proprio.app) || (dgo() && cfgModulo().app) || (eu && eu.getAttribute('data-app')) || 'app';
  }

  /* ------------------------------------------------------------------
     Idioma (PT/EN): o do módulo; sem ele, o <html lang> ou o guardado
     ------------------------------------------------------------------ */
  function idioma() {
    var D = dgo();
    if (D && typeof D.idioma === 'function') { try { return D.idioma() === 'en' ? 'en' : 'pt'; } catch (e) {} }
    var l = (d.documentElement.getAttribute('lang') || '').toLowerCase();
    if (l) return l.indexOf('en') === 0 ? 'en' : 'pt';
    try { var g = JSON.parse(raiz.localStorage.getItem('dgo:global:idioma') || 'null'); if (g === 'en' || g === 'pt') return g; } catch (e) {}
    return (navigator.language || 'pt').toLowerCase().indexOf('en') === 0 ? 'en' : 'pt';
  }
  /* os mesmos textos do módulo 1.1.4 (chaves aone*), mais os novos do 💬 e do interruptor */
  var UI = {
    fechar: ['Fechar', 'Close'],
    aoneRotulo: ['AssistONE: ajuda, tour e busca', 'AssistONE: help, tour and search'],
    aoneOla: ['Olá! Eu sou o AssistONE 👋', 'Hi! I am AssistONE 👋'],
    aoneComoAjudo: ['Em que posso ajudar?', 'How can I help?'],
    aoneApresenta: ['Estou aqui para ajudar você a usar o {app}. Veja o que dá para fazer nesta tela, ou escolha outra ajuda.',
                    'I am here to help you use {app}. See what you can do on this screen, or pick another kind of help.'],
    aoneVejaTela: ['Veja o que dá para fazer nesta tela, ou escolha outra ajuda.', 'See what you can do on this screen, or pick another kind of help.'],
    aoneVoceEsta: ['Você está em', 'You are on'],
    aoneComecar: ['Começar: deixar o app do seu jeito', 'Start: set the app up your way'],
    aoneRever: ['Rever o passo a passo', 'Review the walkthrough'],
    aonePoucosMinutos: ['Passo a passo, em poucos minutos', 'Step by step, in a few minutes'],
    aoneTour: ['Tour rápido pela tela', 'Quick tour of the screen'],
    aoneTourSub: ['Mostro onde fica cada coisa', 'I show you where things are'],
    aoneProcurar: ['Procurar algo', 'Find something'],
    aoneProcurarSub: ['Funções, telas e seções do app', 'Features, screens and sections of the app'],
    aoneExemploBusca: ['Ex.: tom, afinador, importar', 'e.g. key, tuner, import'],
    aoneOndeProcuro: ['Procuro nas funções, telas e seções deste app.', 'I search this app’s features, screens and sections.'],
    aoneOQueProcura: ['O que você procura?', 'What are you looking for?'],
    aoneNadaAchado: ['Não encontrei', 'I could not find'],
    aoneQuisDizer: ['Você quis dizer:', 'Did you mean:'],
    aoneTenteOutra: ['Tente outra palavra.', 'Try another word.'],
    aoneFeedback: ['Dar uma opinião', 'Give feedback'],
    aoneFeedbackSub: ['Ou avisar um problema desta tela', 'Or report a problem on this screen'],
    aoneChamado: ['Abrir um chamado', 'Open a support ticket'],
    aoneChamadoSub: ['Fale com o suporte da SolverONE sobre esta tela', 'Contact SolverONE support about this screen'],
    aoneAgoraNao: ['Agora não', 'Not now'],
    aoneDesligar: ['Desligar o AssistONE', 'Turn AssistONE off'],
    aoneLigado: ['AssistONE ligado.', 'AssistONE on.'],
    aoneDesligado: ['AssistONE desligado. Para religar: ⚙ → AssistONE.', 'AssistONE off. To turn it back on: ⚙ → AssistONE.'],
    aoneAdmin: ['Desligado pela administração da SolverONE.', 'Turned off by the SolverONE administration.'],
    aoneAtivado: ['ATIVADO', 'ON'],
    aoneDesativado: ['DESATIVADO', 'OFF'],
    aoneAbrir: ['Abrir o AssistONE', 'Open AssistONE'],
    aoneRecomecar: ['Recomeçar o passo a passo e as dicas', 'Restart the walkthrough and tips'],
    aoneRecomecou: ['Pronto: o passo a passo e as dicas vão aparecer de novo.', 'Done: the walkthrough and tips will show again.'],
    aoneExplica: ['O assistente no canto da tela: ajuda de cada tela, tour, busca e passo a passo.',
                  'The assistant in the corner of the screen: help for each screen, tour, search and walkthrough.'],
    aoneProximo: ['Próximo', 'Next'],
    aoneConcluir: ['Concluir', 'Finish'],
    aoneSair: ['Sair', 'Exit'],
    aoneFimTour: ['Fim do tour. Toque no AssistONE quando quiser.', 'Tour done. Tap AssistONE anytime.'],
    aoneSouEu: ['Sou eu! Toque quando precisar de ajuda, de um tour ou para procurar algo.', 'That is me! Tap me for help, a tour or to find something.'],
    aoneEntendi: ['Entendi', 'Got it'],
    aoneMaisAjuda: ['Mais ajuda', 'More help']
  };
  function t(chave) { var v = UI[chave]; if (!v) return chave; return idioma() === 'en' ? v[1] : v[0]; }
  function nomeApp() {
    var n = cfgApp().nome;
    if (n && typeof n === 'object') return n[idioma()] || n.pt || 'App';
    return n || 'App';
  }

  /* ------------------------------------------------------------------
     Utilidades pequenas (as mesmas do módulo, para funcionar sem ele)
     ------------------------------------------------------------------ */
  function el(tag, props, filhos) {
    var n = d.createElement(tag);
    if (props) for (var k in props) {
      if (k === 'style' && typeof props[k] === 'object') { for (var s in props[k]) n.style[s] = props[k][s]; }
      else if (k === 'texto') { n.textContent = props[k]; }
      else if (k.slice(0, 2) === 'on' && typeof props[k] === 'function') { n.addEventListener(k.slice(2), props[k]); }
      else if (props[k] !== null && props[k] !== undefined) { n.setAttribute(k, props[k]); }
    }
    if (filhos) (Array.isArray(filhos) ? filhos : [filhos]).forEach(function (f) {
      if (f) n.appendChild(typeof f === 'string' ? d.createTextNode(f) : f);
    });
    return n;
  }
  function $(sel, ctx) { return (ctx || d).querySelector(sel); }

  /* preferências da pessoa: mesmas chaves do módulo 1.1.4 (dgo:<app>:pref:<chave>), sempre no localStorage */
  function prefLer(chave, padrao) {
    try { var v = raiz.localStorage.getItem('dgo:' + idApp() + ':pref:' + chave); return v === null ? padrao : JSON.parse(v); }
    catch (e) { return padrao; }
  }
  function prefGravar(chave, valor) {
    try { raiz.localStorage.setItem('dgo:' + idApp() + ':pref:' + chave, JSON.stringify(valor)); } catch (e) {}
  }

  /* aviso curto que aparece embaixo e some sozinho (o 1.9.0 não expõe o dele) */
  var avisoEl = null, avisoT = null;
  function avisoRapido(txt, ms) {
    if (!d.body) return;
    if (!avisoEl || !avisoEl.parentNode) {
      avisoEl = el('div', { class: 'dgo-aone-aviso', 'data-dgo-ui': '1', role: 'status', 'aria-live': 'polite' });
      d.body.appendChild(avisoEl);
    }
    avisoEl.textContent = txt;
    avisoEl.classList.add('dgo-on');
    clearTimeout(avisoT);
    avisoT = setTimeout(function () { avisoEl.classList.remove('dgo-on'); }, ms || 4000);
  }
  /* janela do módulo aberta (Configurações, login, wizard, feedback…) */
  function modalAberto() { return !!d.querySelector('.dgo-modal'); }
  function fecharModal() { var D = dgo(); if (D && D.modal && typeof D.modal.fechar === 'function') { try { D.modal.fechar(); } catch (e) {} } }
  function ehCelular() {
    var D = dgo();
    if (D && D.plataforma && typeof D.plataforma.ehCelular === 'function') { try { return D.plataforma.ehCelular(); } catch (e) {} }
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  }

  /* interruptores do RootifyONE: DGO.recursos (módulo ≥ 1.6.0) ou SolverRecursos (recursos.js) */
  function interruptores() {
    var D = dgo();
    if (D && D.recursos && typeof D.recursos.ligado === 'function') return D.recursos;
    if (raiz.SolverRecursos && typeof raiz.SolverRecursos.ligado === 'function') return raiz.SolverRecursos;
    return null;
  }
  function adminLigou() { var r = interruptores(); try { return r ? r.ligado('assistone', true) !== false : true; } catch (e) { return true; } }
  function dicasLigadas() { var r = interruptores(); try { return r && r.valor ? r.valor('assistone.dicas', true) !== false : true; } catch (e) { return true; } }

  /* distância de letras entre duas palavras (para o "você quis dizer") */
  function distancia(a, b) {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    var p = [], i, j; for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) {
      var c = [i];
      for (j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      p = c;
    }
    return p[b.length];
  }

  /* ------------------------------------------------------------------
     Aparência: a mesma do 1.1.4 (o 1.9.0 não tem mais esse CSS)
     ------------------------------------------------------------------ */
  var COR = 'var(--dgo-cor,#0ea5e9)';
  function injetarEstilo() {
    if (d.getElementById('dgo-aone-estilo')) return;
    var css = [
      '.dgo-oculto{display:none !important;}',
      '#dgo-aone{position:fixed;right:16px;bottom:calc(16px + var(--dgo-aone-sobe,0px) + env(safe-area-inset-bottom,0px));',
      'z-index:2147483200;display:flex;flex-direction:column;align-items:flex-end;gap:8px;',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}',
      '@media (min-width:821px){#dgo-aone{right:16px;bottom:calc(16px + var(--dgo-aone-sobe-pc,0px));}}',
      '#dgo-aone.dgo-falando{z-index:2147483250;}',
      '.dgo-aone-bt{width:58px;height:58px;border-radius:50%;border:1px solid rgba(201,162,74,.55);padding:0;cursor:pointer;',
      'background:radial-gradient(circle at 50% 38%,#232838,#11141c 72%);display:flex;align-items:center;justify-content:center;',
      'box-shadow:0 6px 18px rgba(0,0,0,.28),0 0 0 3px rgba(201,162,74,.16);animation:dgo-aone-flutua 3.2s ease-in-out infinite;',
      'transition:width .25s cubic-bezier(.2,.8,.2,1),height .25s cubic-bezier(.2,.8,.2,1);}',
      '.dgo-aone-bt img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;pointer-events:none;}',
      '.dgo-aone-glifo{font:800 26px/1 system-ui,sans-serif;color:#e6c168;}',
      '.dgo-aone-bt:focus-visible{outline:3px solid ' + COR + ';outline-offset:3px;}',
      '#dgo-aone.dgo-falando .dgo-aone-bt{width:116px;height:116px;animation:none;}',
      '@keyframes dgo-aone-flutua{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}',
      '@keyframes dgo-aone-pop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion:reduce){.dgo-aone-bt{animation:none;transition:none}.dgo-aone-bolha{animation:none}' +
        '.dgo-aone-foco,.dgo-aone-tour,#dgo-aone.dgo-aone-sai{transition:none !important}}',
      '.dgo-aone-bolha{width:min(340px,calc(100vw - 24px));max-height:min(70vh,560px);overflow:auto;position:relative;',
      'background:#111a2e;color:#e8eef8;border:1px solid rgba(255,255,255,.14);border-radius:18px 18px 6px 18px;',
      'box-shadow:0 14px 40px rgba(0,0,0,.35);padding:14px 14px 12px;font-size:14px;line-height:1.45;animation:dgo-aone-pop .2s ease;}',
      '.dgo-aone-bolha h4,.dgo-aone-tour h4{margin:0 0 4px;font-size:15px;display:flex;align-items:center;gap:8px;padding-right:28px;}',
      '.dgo-aone-bolha h4 img,.dgo-aone-tour h4 img{width:26px;height:26px;object-fit:contain;}',
      '.dgo-aone-bolha p,.dgo-aone-tour p{margin:4px 0 8px;}',
      '.dgo-aone-x{position:absolute;top:6px;right:8px;background:none;border:0;color:#94a3b8;font-size:17px;cursor:pointer;',
      'padding:4px 8px;border-radius:8px;min-width:32px;min-height:32px;}',
      '.dgo-aone-aqui{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);border-radius:14px;padding:10px 12px;margin:6px 0 8px;}',
      '.dgo-aone-aqui .dgo-aone-t{font-weight:800;font-size:13.5px;margin-bottom:2px;}',
      '.dgo-aone-aqui p{margin:0 0 8px;font-size:13px;color:#c7d0dd;}',
      '.dgo-aone-atalhos{display:flex;flex-wrap:wrap;gap:6px;}',
      '.dgo-aone-atalhos button{font:inherit;font-size:12.5px;font-weight:700;border:1px solid ' + COR + ';background:transparent;',
      'color:#e8eef8;border-radius:999px;padding:7px 12px;cursor:pointer;min-height:36px;}',
      '.dgo-aone-atalhos button.dgo-on{background:' + COR + ';color:#04121f;}',
      '.dgo-aone-ops{display:flex;flex-direction:column;gap:6px;margin-top:6px;}',
      '.dgo-aone-ops button{display:flex;align-items:center;gap:10px;text-align:left;font:inherit;font-size:14px;font-weight:600;',
      'border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#e8eef8;border-radius:12px;padding:10px 12px;',
      'cursor:pointer;min-height:44px;width:100%;}',
      '.dgo-aone-ops button:hover{border-color:' + COR + ';}',
      '.dgo-aone-ops button.dgo-on{background:' + COR + ';color:#04121f;border-color:' + COR + ';}',
      '.dgo-aone-ops small{display:block;font-weight:400;font-size:12px;opacity:.75;}',
      '.dgo-aone-linha{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;align-items:center;}',
      '.dgo-aone-link{font:inherit;font-size:12px;background:none;border:0;color:#94a3b8;text-decoration:underline;cursor:pointer;padding:4px 0;}',
      '.dgo-aone-bolha input[type=search]{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:10px 12px;border-radius:12px;',
      'border:1px solid rgba(255,255,255,.18);background:#0b1220;color:#e8eef8;}',
      '.dgo-aone-res{margin-top:8px;}',
      '.dgo-aone-sug{display:flex;flex-wrap:wrap;gap:6px;}',
      '.dgo-aone-sug button{font:inherit;font-size:12.5px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:transparent;',
      'color:#e8eef8;padding:6px 10px;cursor:pointer;}',
      '.dgo-aone-achado{outline:3px solid ' + COR + ' !important;outline-offset:3px;border-radius:8px;}',
      '.dgo-aone-foco{position:fixed;z-index:2147483260;border-radius:12px;pointer-events:none;',
      'box-shadow:0 0 0 9999px rgba(2,6,23,.6),0 0 0 3px ' + COR + ';}',
      '.dgo-aone-tour{position:fixed;z-index:2147483270;width:min(320px,calc(100vw - 24px));background:#111a2e;color:#e8eef8;',
      'border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.35);padding:12px 14px;font-size:14px;',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}',
      '.dgo-aone-tour .dgo-aone-linha{justify-content:space-between;margin-top:0;flex-wrap:nowrap;}',
      /* 1.1.0: "Próximo ›" nunca quebra em duas linhas (o contador encolhe antes) */
      '.dgo-aone-tour .dgo-b{width:auto;padding:8px 14px;min-height:36px;font-size:13px;white-space:nowrap;flex:0 0 auto;}',
      '.dgo-aone-tour .dgo-aone-bts{display:flex;gap:6px;flex:0 0 auto;}',
      '.dgo-aone-tour .dgo-mini{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      /* 1.1.0: o balão e o destaque "voam" de um passo ao outro (só a posição muda; nada é recriado) */
      '.dgo-aone-foco{transition:left .25s ease,top .25s ease,width .25s ease,height .25s ease;}',
      '.dgo-aone-tour{transition:left .25s ease,top .25s ease;}',
      '.dgo-aone-foco.dgo-aone-ja,.dgo-aone-tour.dgo-aone-ja{transition:none;}',
      /* no tour o personagem fica à vista, por cima do escurecido (abaixo do balão), parado para o destaque acertar;
         só sai (sem perder o lugar) no passo em que cobriria o que está destacado */
      '#dgo-aone.dgo-aone-no-tour{z-index:2147483265;}',
      '#dgo-aone.dgo-aone-no-tour .dgo-aone-bt{animation:none;}',
      '#dgo-aone.dgo-aone-sai{opacity:0;pointer-events:none;transition:opacity .15s;}',
      '.dgo-aone-toggle{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:14px;cursor:pointer;',
      'border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#e8eef8;font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.04em;}',
      '.dgo-aone-toggle img{width:34px;height:34px;object-fit:contain;}',
      '.dgo-aone-toggle .dgo-aone-sw{margin-left:auto;width:44px;height:26px;border-radius:999px;background:rgba(255,255,255,.18);position:relative;flex:0 0 auto;}',
      '.dgo-aone-toggle .dgo-aone-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s;}',
      '.dgo-aone-toggle.dgo-on .dgo-aone-sw{background:#c9a24a;}.dgo-aone-toggle.dgo-on .dgo-aone-sw::after{left:21px;}',
      /* novo: desligado pelo RootifyONE (a pessoa vê o motivo e não consegue religar aqui) */
      '.dgo-aone-toggle[aria-disabled=true]{opacity:.55;cursor:not-allowed;}',
      '.dgo-aone-adm{margin:8px 0 0;font-size:12.5px;line-height:1.45;padding:8px 10px;border-radius:10px;background:rgba(148,163,184,.14);color:#cbd5e1;}',
      /* aviso rápido (o mesmo visual do .dgo-toast do 1.1.4) */
      '.dgo-aone-aviso{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));transform:translate(-50%,12px);',
      'z-index:2147483400;max-width:min(92vw,520px);background:#111a2e;color:#e8eef8;border:1px solid rgba(255,255,255,.16);',
      'border-radius:14px;padding:10px 14px;font:600 13.5px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;',
      'box-shadow:0 10px 30px rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;}',
      '.dgo-aone-aviso.dgo-on{opacity:1;transform:translate(-50%,0);}'
    ];
    /* sem o módulo comum, os botões .dgo-b/.dgo-mini/.dgo-linha não têm estilo: cópia só para o AssistONE */
    if (!dgo()) css = css.concat([
      '.dgo-aone-solo .dgo-b{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;padding:12px 14px;',
      'border-radius:11px;border:0;background:' + COR + ';color:#04121f;font-size:14.5px;font-weight:700;cursor:pointer;margin-top:6px;font-family:inherit;}',
      '.dgo-aone-solo .dgo-b.dgo-b2{background:transparent;border:1px solid rgba(255,255,255,.2);color:#e2e8f0;}',
      '.dgo-aone-solo .dgo-linha{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
      '.dgo-aone-solo .dgo-linha>*{flex:1;min-width:120px;}',
      '.dgo-aone-solo .dgo-mini{font-size:11.5px;color:#64748b;}',
      '.dgo-aone-solo.dgo-aone-cartao{background:#111a2e;color:#e8eef8;border-radius:14px;padding:12px;}',
      /* 1.1.1: no tour, os botões do modo sem módulo voltam ao tamanho do tour (a regra acima, de mesma especificidade
         e escrita depois, deixava "Sair" e "Próximo ›" com 100% cada e o "Próximo" saía do balão) */
      '.dgo-aone-tour.dgo-aone-solo .dgo-b{width:auto;min-height:36px;padding:8px 14px;font-size:13px;margin-top:0;}'
    ]);
    var st = el('style', { id: 'dgo-aone-estilo' });
    st.textContent = css.join('');
    (d.head || d.documentElement).appendChild(st);
  }
  function solo() { return dgo() ? '' : ' dgo-aone-solo'; }
  /* o retângulo a (personagem) encosta no b (destaque), com folga? */
  function cobre(a, b, folga) {
    return a.width > 0 && !(a.right < b.left - folga || a.left > b.right + folga || a.bottom < b.top - folga || a.top > b.bottom + folga);
  }
  /* app sem o módulo: a cor de destaque vem do configurar({ cor }) */
  function corPropria(no) { if (!dgo() && proprio && proprio.cor) no.style.setProperty('--dgo-cor', proprio.cor); return no; }

  /* ------------------------------------------------------------------
     O assistente (mesmo comportamento do bloco 19-D do módulo 1.1.4)
     ------------------------------------------------------------------ */
  var Assistente = {
    el: null, bolha: null, botao: null, vista: null, _tour: null, _dicaT: null, _dicaX: null, _syncT: null, _res: [], _busca: '',

    /* o app pode não ter assistente (ativo:false); sem config, vale ligado (como no 1.1.4) */
    ativoNoApp: function () { return conf().ativo !== false; },
    ligado: function () { return Assistente.ativoNoApp() && adminLigou() && prefLer('aone:ligado', true) !== false; },
    ligar: function (v) {
      if (v && !adminLigou()) { avisoRapido(t('aoneAdmin'), 5000); return; }
      prefGravar('aone:ligado', !!v);
      Assistente.fechar();
      if (v) { Assistente.montar(); avisoRapido('✓ ' + t('aoneLigado'), 3000); }
      else avisoRapido(t('aoneDesligado'), 5000);
      Assistente.sincronizar();
      Cartoes.repintar();
      d.dispatchEvent(new CustomEvent('dgo:assistente', { detail: { ligado: !!v } }));
    },
    tx: function (v) { if (!v) return ''; return typeof v === 'string' ? v : (v[idioma()] || v.pt || ''); },
    tela: function () {
      var c = conf();
      try { if (typeof c.tela === 'function') return c.tela() || ''; } catch (e) {}
      return (d.body && d.body.getAttribute('data-pagina')) || 'inicio';
    },
    imagem: function () { return conf().imagem || 'ajuda-botao.png'; },
    img: function (cls) {
      var i = el('img', { src: Assistente.imagem(), alt: '', class: cls || '' });
      i.onerror = function () { var s = el('span', { class: 'dgo-aone-glifo', texto: '?' }); if (i.parentNode) i.parentNode.replaceChild(s, i); };
      return i;
    },

    /* ---- monta o personagem uma vez ---- */
    montar: function () {
      if (Assistente.el || !d.body) return;
      injetarEstilo();
      Assistente.botao = el('button', { type: 'button', class: 'dgo-aone-bt', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: 'AssistONE',
        'aria-label': t('aoneRotulo'), onclick: function () { if (Assistente.vista) Assistente.fechar(); else Assistente.abrir(); } },
        [Assistente.img()]);
      Assistente.bolha = el('div', { class: 'dgo-aone-bolha dgo-oculto', role: 'dialog', 'aria-live': 'polite', 'aria-label': 'AssistONE' });
      /* data-recurso: desligado no RootifyONE, o CSS do módulo (ou do recursos.js) já esconde */
      Assistente.el = corPropria(el('div', { id: 'dgo-aone', 'data-dgo-ui': '1', 'data-recurso': 'assistone', class: 'dgo-oculto' + solo() }, [Assistente.bolha, Assistente.botao]));
      d.body.appendChild(Assistente.el);
      /* 1.2.0: o último clique fora do assistente vai junto no chamado (só o que está escrito no botão/link, sem dado digitado) */
      d.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('button, a, [role=button], [data-recurso]') : null;
        if (!a || (Assistente.el && Assistente.el.contains(a))) return;
        Assistente._ultimoClique = { quando: new Date().toISOString(), texto: String(a.textContent || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 60),
          id: a.id || a.getAttribute('data-recurso') || '' };
      }, true);
      /* tocar fora fecha o balão; Esc também (e encerra o tour) */
      d.addEventListener('pointerdown', function (e) {
        if (!Assistente.vista || Assistente.el.contains(e.target)) return;
        if (e.target.closest && e.target.closest('.dgo-aone-tour')) return;
        Assistente.fechar();
      }, true);
      d.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (Assistente._tour) { e.stopPropagation(); Assistente.tourFim(); }
        else if (Assistente.vista && !modalAberto()) Assistente.fechar();
      }, true);
      if (raiz.MutationObserver) {
        new MutationObserver(function () {
          if (Assistente._syncT) return;
          Assistente._syncT = setTimeout(function () { Assistente._syncT = null; Assistente.sincronizar(); }, 150);
        }).observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aberta', 'open', 'hidden'] });
      }
      Assistente.sincronizar();
    },
    escondido: function () {
      if (modalAberto()) return true;
      /* a lista própria do assistente; sem ela, vale a das telas cheias dos anúncios */
      var c = conf(), an = cfgApp().anuncios;
      var sels = c.esconderCom || (an && an.esconderCom) || [];
      for (var i = 0; i < sels.length; i++) {
        var nos; try { nos = d.querySelectorAll(sels[i]); } catch (e) { continue; }
        for (var j = 0; j < nos.length; j++) {
          if (nos[j].getClientRects().length && raiz.getComputedStyle(nos[j]).visibility !== 'hidden') return true;
        }
      }
      return false;
    },
    /* aparece só com o app livre: sem janela, menu ou tela cheia por cima */
    sincronizar: function () {
      if (!Assistente.el) return;
      /* 1.1.0: durante o tour o personagem fica (só sai, com .dgo-aone-sai, no passo em que cobriria o destaque) */
      if (Assistente._tour) { Assistente.el.classList.remove('dgo-oculto'); d.body.classList.add('dgo-aone-on'); return; }
      /* com o balão aberto ele não some no meio de um comando (só uma janela do módulo o esconde) */
      var mostrar = Assistente.ligado() && !Assistente._tour && (!Assistente.escondido() || (Assistente.vista && !modalAberto()));
      Assistente.el.classList.toggle('dgo-oculto', !mostrar);
      d.body.classList.toggle('dgo-aone-on', mostrar);
      if (!mostrar && Assistente.vista) Assistente.fechar();
    },
    iniciar: function () {
      if (!Assistente.ativoNoApp()) return;
      Assistente.montar();
      if (!Assistente.ligado()) return;
      if (!prefLer('aone:ola', false)) {
        setTimeout(function () {
          if (Assistente.vista || Assistente.escondido() || !Assistente.ligado()) return;
          prefGravar('aone:ola', true);
          Assistente.abrir(true);
        }, 1500);
        return;
      }
      Assistente.dica();
    },

    /* ---- balão ---- */
    mostrar: function (filhos, vista) {
      if (!Assistente.el) Assistente.montar();
      if (!Assistente.el) return;
      Assistente.vista = vista;
      Assistente.bolha.innerHTML = '';
      Assistente.bolha.appendChild(el('button', { type: 'button', class: 'dgo-aone-x', 'aria-label': t('fechar'), texto: '✕',
        onclick: function () { Assistente.fechar(); } }));
      filhos.forEach(function (f) { if (f) Assistente.bolha.appendChild(f); });
      Assistente.bolha.classList.remove('dgo-oculto');
      Assistente.el.classList.add('dgo-falando');
      Assistente.botao.setAttribute('aria-expanded', 'true');
    },
    fechar: function () {
      if (!Assistente.bolha) return;
      clearTimeout(Assistente._dicaX);
      Assistente.bolha.classList.add('dgo-oculto');
      Assistente.bolha.innerHTML = '';
      Assistente.vista = null;
      Assistente.el.classList.remove('dgo-falando');
      Assistente.botao.setAttribute('aria-expanded', 'false');
    },
    cabecalho: function (titulo) { return el('h4', {}, [Assistente.img(), d.createTextNode(titulo)]); },

    /* o primeiro bloco é sempre a ajuda da tela onde a pessoa está */
    dadosTela: function () { var telas = conf().telas || {}; return telas[Assistente.tela()] || null; },
    blocoTela: function () {
      var x = Assistente.dadosTela();
      if (!x) return null;
      /* a tela pode desenhar o próprio bloco (ex.: os comandos da cifra no modo celular) */
      var proprioBloco = null;
      if (typeof x.montar === 'function') { try { proprioBloco = x.montar(); } catch (e) { proprioBloco = null; } }
      var atalhos = el('div', { class: 'dgo-aone-atalhos' });
      (x.atalhos || []).forEach(function (a) {
        atalhos.appendChild(el('button', { type: 'button', class: a.principal ? 'dgo-on' : '', 'data-recurso': a.recurso || null, texto: Assistente.tx(a.rotulo),
          onclick: function () { Assistente.fechar(); setTimeout(function () { Assistente.executar(a.acao); }, 60); } }));
      });
      return el('div', { class: 'dgo-aone-aqui' }, [
        el('div', { class: 'dgo-aone-t', texto: '📍 ' + t('aoneVoceEsta') + ' ' + Assistente.tx(x.titulo) }),
        x.frase ? el('p', { texto: Assistente.tx(x.frase) }) : null,
        proprioBloco,
        (x.atalhos && x.atalhos.length) ? atalhos : null
      ]);
    },
    executar: function (acao) {
      if (typeof acao === 'function') { try { acao(); } catch (e) {} return; }
      if (typeof acao === 'string' && acao) {
        if (acao.charAt(0) === '#') {
          var alvo = null; try { alvo = $(acao); } catch (e) {}
          if (alvo) { alvo.scrollIntoView({ behavior: 'smooth', block: 'center' }); Assistente.destacar(alvo); if (alvo.focus) try { alvo.focus({ preventScroll: true }); } catch (e) {} }
          return;
        }
        raiz.location.href = acao;
      }
    },
    destacar: function (no) {
      no.classList.add('dgo-aone-achado');
      setTimeout(function () { no.classList.remove('dgo-aone-achado'); }, 1600);
    },

    /* "Começar": o wizard do módulo (DGO.wizard) ou, num app sem o módulo, uma função do próprio app */
    wizard: function () {
      var c = conf(), D = dgo();
      if (typeof c.wizard === 'function') return { feito: false, abrir: function () { try { c.wizard(); } catch (e) {} } };
      if (!c.wizard || !D || !D.wizard) return null;
      var id = c.wizard, feito = false;
      try { feito = !!D.wizard.feito(id); } catch (e) {}
      return { feito: feito, abrir: function () { D.wizard.abrir(id, feito ? 0 : undefined); } };
    },
    /* 💬 (diretriz "Feedback dos usuários"): o formulário do módulo já sabendo a tela */
    feedback: function () {
      var D = dgo();
      if (!D || !D.feedback || typeof D.feedback.abrir !== 'function') return false;
      var x = Assistente.dadosTela();
      try { D.feedback.abrir({ tela: Assistente.tela(), titulo: x ? Assistente.tx(x.titulo) : undefined }); } catch (e) { return false; }
      return true;
    },

    /* ---- 🎫 chamado: a função é do app (regra do dono, 12/Nov/2026); aqui só se junta o contexto ---- */
    _ultimoClique: null,
    funcaoChamado: function () {
      var f = conf().chamado;
      if (typeof f !== 'function') f = raiz.AONE_CHAMADO;
      return typeof f === 'function' ? f : null;
    },
    temChamado: function () { return !!Assistente.funcaoChamado(); },
    chamado: function () {
      var f = Assistente.funcaoChamado();
      if (!f) return false;
      var x = Assistente.dadosTela(), cfg = cfgApp();
      var info = { app: idApp(), tela: Assistente.tela(), titulo: x ? Assistente.tx(x.titulo) : '',
        versao: (proprio && proprio.versao) || cfg.versaoApp || cfg.versao || '', ultimoClique: Assistente._ultimoClique, assistone: VERSAO };
      try { f(info); } catch (e) { if (raiz.console) console.error(e); return false; }
      return true;
    },

    abrir: function (primeira) {
      if (!Assistente.ligado()) return;
      var c = conf(), D = dgo();
      var wiz = Assistente.wizard();
      var aqui = Assistente.blocoTela();
      var ops = el('div', { class: 'dgo-aone-ops' });
      function op(icone, titulo, sub, acao, principal, recurso) {
        ops.appendChild(el('button', { type: 'button', class: principal ? 'dgo-on' : '', 'data-recurso': recurso || null, onclick: acao }, [
          el('span', { texto: icone }),
          el('span', {}, [d.createTextNode(titulo), sub ? el('small', { texto: sub }) : null])
        ]));
      }
      if (wiz) op('🚀', wiz.feito ? t('aoneRever') : t('aoneComecar'), t('aonePoucosMinutos'), function () {
        Assistente.fechar(); wiz.abrir();
      }, !aqui);
      if (c.tour && c.tour.length) op('🧭', t('aoneTour'), t('aoneTourSub'), function () { Assistente.fechar(); Assistente.tour(0); });
      op('🔎', t('aoneProcurar'), t('aoneProcurarSub'), function () { Assistente.procurar(); });
      /* novo no arquivo próprio: o 💬 em toda abertura do balão (só aparece se o app tem o DGO.feedback) */
      if (D && D.feedback && typeof D.feedback.abrir === 'function') {
        op('💬', t('aoneFeedback'), t('aoneFeedbackSub'), function () { Assistente.fechar(); Assistente.feedback(); }, false, 'feedback');
      }
      /* 1.2.0: 🎫 Abrir um chamado, em toda abertura do balão, quando o app oferece a função (config.chamado ou AONE_CHAMADO) */
      if (Assistente.temChamado()) op('🎫', t('aoneChamado'), t('aoneChamadoSub'), function () { Assistente.fechar(); Assistente.chamado(); }, false, 'chamado');
      op('💤', t('aoneAgoraNao'), '', function () { Assistente.fechar(); });
      Assistente.mostrar([
        Assistente.cabecalho(primeira ? t('aoneOla') : t('aoneComoAjudo')),
        el('p', { texto: primeira ? t('aoneApresenta').replace('{app}', nomeApp()) : t('aoneVejaTela') }),
        aqui, ops,
        el('div', { class: 'dgo-aone-linha' }, [el('button', { type: 'button', class: 'dgo-aone-link', texto: t('aoneDesligar'),
          onclick: function () { Assistente.ligar(false); } })])
      ], primeira ? 'ola' : 'menu');
      setTimeout(function () { var f = $('.dgo-aone-aqui button, .dgo-aone-ops button', Assistente.bolha); if (f && !ehCelular()) try { f.focus(); } catch (e) {} }, 50);
    },

    /* ---- busca dentro do balão: o índice do config + os títulos da página ---- */
    normal: function (s) {
      s = String(s || '');
      try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
      return s.toLowerCase();
    },
    indice: function () {
      var lista = [];
      (conf().busca || cfgApp().busca || []).forEach(function (b) {
        var termo = Assistente.tx(b.termo);
        var sin = (b.sinonimos || []).map(function (s) { return Assistente.tx(s); }).join(' ');
        lista.push({ titulo: termo, icone: b.icone || '›', sub: Assistente.tx(b.descricao), chave: Assistente.normal(termo + ' ' + sin + ' ' + (b.termo && b.termo.pt || '') + ' ' + (b.termo && b.termo.en || '')), acao: b.destino });
      });
      Array.prototype.forEach.call(d.querySelectorAll('main h1, main h2, main h3, [data-busca]'), function (h) {
        if (h.closest && h.closest('[data-dgo-ui]')) return;
        var txt = (h.getAttribute('data-busca') || h.textContent || '').trim();
        if (!txt || txt.length > 80) return;
        lista.push({ titulo: txt, icone: '§', sub: '', chave: Assistente.normal(txt), acao: function () {
          h.scrollIntoView({ behavior: 'smooth', block: 'start' }); Assistente.destacar(h); } });
      });
      return lista;
    },
    achar: function (q) {
      var partes = Assistente.normal(q).split(/\s+/).filter(Boolean);
      if (!partes.length) return [];
      return Assistente.indice().filter(function (i) {
        return partes.every(function (p) { return i.chave.indexOf(p) !== -1; });
      }).slice(0, 8);
    },
    parecidos: function (q) {
      var palavras = {}, saida = [];
      Assistente.indice().forEach(function (i) {
        (i.titulo + ' ' + i.sub).split(/[^A-Za-z0-9À-ɏ]+/).forEach(function (w) { if (w.length >= 3) palavras[Assistente.normal(w)] = w; });
      });
      Assistente.normal(q).split(/\s+/).filter(Boolean).forEach(function (p) {
        var lim = p.length <= 4 ? 1 : p.length <= 7 ? 2 : 3;
        Object.keys(palavras).map(function (w) { return [w, distancia(p, w.slice(0, Math.max(p.length, Math.min(w.length, p.length + 2))))]; })
          .filter(function (x) { return x[1] <= lim; }).sort(function (a, b) { return a[1] - b[1]; }).slice(0, 3)
          .forEach(function (x) { if (saida.indexOf(palavras[x[0]]) === -1) saida.push(palavras[x[0]]); });
      });
      return saida.slice(0, 4);
    },
    procurar: function (pre) {
      if (!Assistente.ligado()) return;
      var ex = conf().exemploBusca;
      var caixa = el('input', { type: 'search', autocomplete: 'off', placeholder: ex ? Assistente.tx(ex) : t('aoneExemploBusca'), 'aria-label': t('aoneProcurar') });
      if (pre) caixa.value = pre;
      var res = el('div', { class: 'dgo-aone-res', 'aria-live': 'polite' });
      var temporizador = null;
      function desenhar() {
        var q = caixa.value.trim();
        Assistente._busca = q;
        res.innerHTML = '';
        if (!q) { res.appendChild(el('p', { class: 'dgo-mini', texto: t('aoneOndeProcuro') })); return; }
        Assistente._res = Assistente.achar(q);
        if (Assistente._res.length) {
          var ops = el('div', { class: 'dgo-aone-ops' });
          Assistente._res.forEach(function (r) {
            ops.appendChild(el('button', { type: 'button', onclick: function () { Assistente.fechar(); Assistente.executar(r.acao); } }, [
              el('span', { texto: r.icone }), el('span', {}, [d.createTextNode(r.titulo), r.sub ? el('small', { texto: r.sub }) : null])
            ]));
          });
          res.appendChild(ops);
        } else {
          var sug = Assistente.parecidos(q);
          res.appendChild(el('p', { texto: t('aoneNadaAchado') + ' “' + q + '”. ' + (sug.length ? t('aoneQuisDizer') : t('aoneTenteOutra')) }));
          if (sug.length) {
            var s = el('div', { class: 'dgo-aone-sug' });
            sug.forEach(function (w) { s.appendChild(el('button', { type: 'button', texto: w, onclick: function () { caixa.value = w; desenhar(); caixa.focus(); } })); });
            res.appendChild(s);
          }
        }
      }
      caixa.addEventListener('input', function () { clearTimeout(temporizador); temporizador = setTimeout(desenhar, 120); });
      caixa.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && Assistente._res[0]) { e.preventDefault(); var r = Assistente._res[0]; Assistente.fechar(); Assistente.executar(r.acao); }
      });
      Assistente.mostrar([Assistente.cabecalho(t('aoneOQueProcura')), caixa, res], 'busca');
      desenhar();
      setTimeout(function () { try { caixa.focus(); } catch (e) {} }, 60);
    },

    /* ---- tour rápido: destaca cada parte da tela, com Próximo e Sair ---- */
    passosTour: function () {
      return (conf().tour || []).concat([{ seletor: '#dgo-aone .dgo-aone-bt', titulo: 'AssistONE', texto: { pt: t('aoneSouEu'), en: t('aoneSouEu') } }]);
    },
    visivel: function (sel) {
      var e2 = null; try { e2 = $(sel); } catch (x) {}
      if (!e2) return null;
      var r = e2.getBoundingClientRect();
      return (r.width > 0 && r.height > 0 && raiz.getComputedStyle(e2).visibility !== 'hidden') ? e2 : null;
    },
    /* 1.1.0: um balão e um destaque só para o tour inteiro; a cada passo muda o conteúdo e a posição, e o CSS faz os
       dois "voarem" até o próximo (0,25 s; sem animação com "reduzir movimento"). O personagem fica à vista. */
    tour: function (i) {
      if (!Assistente.ligado()) return;
      if (!Assistente.el) Assistente.montar();
      var T = Assistente.passosTour();
      i = i || 0;
      if (Assistente.vista) Assistente.fechar();
      Assistente._tour = true;
      Assistente.el.classList.add('dgo-aone-no-tour');
      Assistente.sincronizar();
      while (i < T.length && !Assistente.visivel(T[i].seletor)) i++;
      if (i >= T.length) { prefGravar('aone:tour', true); Assistente.tourFim(); avisoRapido('✓ ' + t('aoneFimTour'), 3500); return; }
      var alvo = Assistente.visivel(T[i].seletor);
      alvo.scrollIntoView({ block: 'nearest' });
      var r = alvo.getBoundingClientRect(), pad = 6;
      /* o personagem só sai do caminho se cobrir o destaque (e nunca no passo dele, o "Sou eu!") */
      var ehEle = Assistente.el.contains(alvo), rb = Assistente.botao.getBoundingClientRect();
      Assistente.el.classList.toggle('dgo-aone-sai', !ehEle && cobre(rb, r, pad + 4));
      var els = Assistente._tourEls, primeiro = !els;
      var foco = primeiro ? corPropria(el('div', { class: 'dgo-aone-foco dgo-aone-ja', 'data-dgo-ui': '1' })) : els[0];
      var caixa = primeiro ? corPropria(el('div', { class: 'dgo-aone-tour dgo-aone-ja' + solo(), 'data-dgo-ui': '1', role: 'dialog' })) : els[1];
      foco.style.left = (r.left - pad) + 'px'; foco.style.top = (r.top - pad) + 'px';
      foco.style.width = (r.width + pad * 2) + 'px'; foco.style.height = (r.height + pad * 2) + 'px';
      var ultimo = i === T.length - 1;
      while (caixa.firstChild) caixa.removeChild(caixa.firstChild);
      caixa.setAttribute('aria-label', Assistente.tx(T[i].titulo));
      [Assistente.cabecalho(Assistente.tx(T[i].titulo)),
        el('p', { texto: Assistente.tx(T[i].texto) }),
        el('div', { class: 'dgo-aone-linha' }, [
          el('span', { class: 'dgo-mini', texto: (i + 1) + ' / ' + T.length }),
          el('span', { class: 'dgo-aone-bts' }, [
            el('button', { type: 'button', class: 'dgo-b dgo-b2', texto: t('aoneSair'), onclick: function () { Assistente.tourFim(); } }),
            el('button', { type: 'button', class: 'dgo-b', texto: ultimo ? t('aoneConcluir') : (t('aoneProximo') + ' ›'), onclick: function () { Assistente.tour(i + 1); } })
          ])
        ])].forEach(function (f) { caixa.appendChild(f); });
      if (primeiro) { d.body.appendChild(foco); d.body.appendChild(caixa); }
      var W = caixa.offsetWidth, H = caixa.offsetHeight, vw = raiz.innerWidth, vh = raiz.innerHeight;
      var topo = r.bottom + 14; if (topo + H > vh - 8) topo = Math.max(8, r.top - H - 14);
      var esq = Math.min(Math.max(8, r.left + r.width / 2 - W / 2), vw - W - 8);
      caixa.style.top = topo + 'px'; caixa.style.left = esq + 'px';
      Assistente._tourEls = [foco, caixa];
      /* no primeiro passo eles aparecem no lugar; daí em diante, voam */
      if (primeiro) setTimeout(function () { foco.classList.remove('dgo-aone-ja'); caixa.classList.remove('dgo-aone-ja'); }, 30);
      setTimeout(function () { var b = caixa.querySelector('.dgo-b:not(.dgo-b2)'); if (b) try { b.focus({ preventScroll: true }); } catch (e) {} }, 40);
    },
    tourFim: function () {
      (Assistente._tourEls || []).forEach(function (x) { if (x.parentNode) x.parentNode.removeChild(x); });
      Assistente._tourEls = null;
      Assistente._tour = false;
      if (Assistente.el) { Assistente.el.classList.remove('dgo-aone-no-tour'); Assistente.el.classList.remove('dgo-aone-sai'); }
      Assistente.sincronizar();
    },

    /* ---- dica curta da tela, uma vez só, alguns segundos depois de entrar ---- */
    dica: function () {
      var c = conf(), tela = Assistente.tela();
      if (!dicasLigadas()) return;                       /* RootifyONE: assistone.dicas = não */
      var txt = c.dicas && Assistente.tx(c.dicas[tela]);
      var vistas = prefLer('aone:dicas', {}) || {};
      if (!txt || vistas[tela] || Assistente.vista) return;
      clearTimeout(Assistente._dicaT);
      Assistente._dicaT = setTimeout(function () {
        if (Assistente.vista || Assistente.escondido() || !Assistente.ligado() || !dicasLigadas()) return;
        vistas[tela] = 1; prefGravar('aone:dicas', vistas);
        Assistente.mostrar([
          Assistente.cabecalho('AssistONE'),
          el('p', { texto: txt }),
          el('div', { class: 'dgo-aone-linha' }, [
            el('button', { type: 'button', class: 'dgo-b dgo-b2', style: { width: 'auto', minHeight: '36px', padding: '8px 14px' }, texto: t('aoneEntendi'), onclick: function () { Assistente.fechar(); } }),
            el('button', { type: 'button', class: 'dgo-b dgo-b2', style: { width: 'auto', minHeight: '36px', padding: '8px 14px' }, texto: t('aoneMaisAjuda'), onclick: function () { Assistente.abrir(); } })
          ])
        ], 'dica');
        Assistente._dicaX = setTimeout(function () { if (Assistente.vista === 'dica') Assistente.fechar(); }, 12000);
      }, 2200);
    },
    recomecar: function () {
      prefGravar('aone:ola', false); prefGravar('aone:dicas', {}); prefGravar('aone:tour', false);
      var c = conf(), D = dgo();
      if (c.wizard && typeof c.wizard === 'string' && D && D.wizard && D.wizard.reiniciar) { try { D.wizard.reiniciar(c.wizard); } catch (e) {} }
      avisoRapido('✓ ' + t('aoneRecomecou'), 3500);
    },

    /* idioma trocado: o que estiver aberto é redesenhado no idioma novo */
    redesenhar: function () {
      if (Assistente.botao) Assistente.botao.setAttribute('aria-label', t('aoneRotulo'));
      var v = Assistente.vista;
      if (v === 'menu' || v === 'ola') Assistente.abrir(v === 'ola');
      else if (v === 'busca') Assistente.procurar(Assistente._busca);
      else if (v === 'dica') Assistente.fechar();
      Cartoes.repintar();
    }
  };

  /* ------------------------------------------------------------------
     Cartão "💡 AssistONE" das Configurações (liga e desliga)
     ------------------------------------------------------------------ */
  var Cartoes = {
    vivos: [],
    novo: function () {
      injetarEstilo();
      var caixa = corPropria(el('div', { class: 'dgo-aone-cartao' + solo(), 'data-aone-cartao': '1' }));
      Cartoes.pintar(caixa);
      Cartoes.vivos.push(caixa);
      return caixa;
    },
    pintar: function (caixa) {
      caixa.innerHTML = '';
      var adm = adminLigou(), on = Assistente.ligado();
      var toggle = el('button', { type: 'button', class: 'dgo-aone-toggle' + (on ? ' dgo-on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false',
        'aria-disabled': adm ? null : 'true',
        onclick: function () {
          if (!adminLigou()) { avisoRapido(t('aoneAdmin'), 4000); return; }
          Assistente.ligar(!Assistente.ligado());
        } }, [
        Assistente.img(), el('span', { texto: 'ASSIST ONE ' + (on ? t('aoneAtivado') : t('aoneDesativado')) }),
        el('span', { class: 'dgo-aone-sw', 'aria-hidden': 'true' })
      ]);
      caixa.appendChild(toggle);
      if (!adm) { caixa.appendChild(el('p', { class: 'dgo-aone-adm', role: 'note', texto: t('aoneAdmin') })); return; }
      caixa.appendChild(el('div', { class: 'dgo-mini', texto: t('aoneExplica') }));
      var linha = el('div', { class: 'dgo-linha' });
      linha.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: '💬 ' + t('aoneAbrir'), onclick: function () {
        if (!Assistente.ligado()) Assistente.ligar(true);
        fecharModal(); setTimeout(function () { Assistente.abrir(); }, 200);
      } }));
      linha.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: '🔄 ' + t('aoneRecomecar'), onclick: function () { Assistente.recomecar(); } }));
      caixa.appendChild(linha);
    },
    /* liga/desliga, interruptor novo ou idioma novo: os cartões abertos mostram o estado certo */
    repintar: function () {
      Cartoes.vivos = Cartoes.vivos.filter(function (c) { return c.isConnected; });
      Cartoes.vivos.forEach(Cartoes.pintar);
    },
    /* põe a seção no painel montado pelo módulo: logo depois de "Idioma" (onde estava no 1.1.4) */
    colocar: function (raizCfg) {
      if (!raizCfg || !Assistente.ativoNoApp() || raizCfg.querySelector('[data-aone-secao]')) return;
      var D = dgo(), titIdioma = D && D.t ? D.t('idioma') : 'Idioma';
      var depois = null, h3s = raizCfg.querySelectorAll('h3');
      for (var i = 0; i < h3s.length; i++) {
        if (h3s[i].parentNode === raizCfg && h3s[i].textContent.trim() === titIdioma) {
          var n = h3s[i].nextElementSibling;
          while (n && n.tagName !== 'H3') n = n.nextElementSibling;
          depois = n || null;            /* insere antes da próxima seção (ou no fim) */
          break;
        }
      }
      var secao = el('div', { 'data-aone-secao': '1' }, [el('h3', { texto: '💡 AssistONE' }), Cartoes.novo()]);
      if (depois) raizCfg.insertBefore(secao, depois);
      else if (i < h3s.length) raizCfg.appendChild(secao);
      else raizCfg.insertBefore(secao, raizCfg.firstChild);
    }
  };

  /* ------------------------------------------------------------------
     Encaixe no módulo comum (DGO) — sem mexer no diretrizes.js
     ------------------------------------------------------------------ */
  var ultimasSecoes = null;      /* { secoes:[...] } da última vez que o app abriu as Configurações */
  function querCartao(op) { var s = op && op.secoes; return !s || s.indexOf('assistente') !== -1; }

  function ehPainelConfig(modal) {
    var D = dgo(); if (!D) return null;
    var h2 = modal.querySelector('.dgo-caixa > h2');
    if (!h2 || h2.textContent.trim() !== (D.t ? D.t('configuracoes') : 'Configurações')) return null;
    var r = h2.nextElementSibling;
    return r && r.getAttribute('data-dgo-ui') === '1' ? r : null;
  }

  var registrado = false;
  function registrarNoDGO() {
    var D = dgo();
    if (registrado || !D || moduloTemOProprio()) return;
    registrado = true;
    /* os mesmos nomes do DGO.assistente do 1.1.4 */
    D.assistente = {
      __assistone: true,
      versao: VERSAO,
      abrir: function () { Assistente.abrir(); },
      fechar: function () { Assistente.fechar(); },
      ligado: function () { return Assistente.ligado(); },
      ligar: function (v) { Assistente.ligar(v !== false); },
      tour: function () { Assistente.tour(0); },
      procurar: function (q) { Assistente.procurar(q); },
      dica: function () { Assistente.dica(); },
      chamado: function () { return Assistente.chamado(); },
      recomecar: function () { Assistente.recomecar(); },
      atualizar: function () { Assistente.sincronizar(); },
      cartaoConfig: function () { return Cartoes.novo(); }
    };
    /* ⚙ Configurações: o 1.9.0 não tem gancho para seção nova; o cartão entra pelo painel pronto */
    if (typeof D.abrirConfiguracoes === 'function' && !D.abrirConfiguracoes.__aone) {
      var abrirOrig = D.abrirConfiguracoes;
      D.abrirConfiguracoes = function (op) { ultimasSecoes = op || null; return abrirOrig.apply(this, arguments); };
      D.abrirConfiguracoes.__aone = true;
    }
    if (typeof D.montarConfiguracoes === 'function' && !D.montarConfiguracoes.__aone) {
      var montarOrig = D.montarConfiguracoes;
      D.montarConfiguracoes = function (op) {
        var r = montarOrig.apply(this, arguments);
        try { if (querCartao(op)) Cartoes.colocar(r); } catch (e) {}
        return r;
      };
      D.montarConfiguracoes.__aone = true;
    }
  }
  /* a janela de Configurações do módulo é posta direto no <body>: quando ela aparece, o cartão entra */
  function vigiarConfiguracoes() {
    if (!raiz.MutationObserver || !d.body || vigiarConfiguracoes._ok) return;
    vigiarConfiguracoes._ok = true;
    new MutationObserver(function (lista) {
      lista.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1 || !n.classList.contains('dgo-modal')) return;
          var r = ehPainelConfig(n);
          if (r && querCartao(ultimasSecoes)) { try { Cartoes.colocar(r); } catch (e) {} }
        });
      });
    }).observe(d.body, { childList: true });
  }

  var ouvindoInterruptores = false;
  function vigiarInterruptores() {
    if (ouvindoInterruptores) return;
    var r = interruptores();
    if (!r || typeof r.aoMudar !== 'function') return;
    ouvindoInterruptores = true;
    r.aoMudar(function () { Assistente.sincronizar(); Cartoes.repintar(); });
  }

  /* ------------------------------------------------------------------
     Começo
     ------------------------------------------------------------------ */
  var iniciado = false;
  function iniciar() {
    if (moduloTemOProprio() || !d.body) return;
    registrarNoDGO();
    vigiarConfiguracoes();
    vigiarInterruptores();
    if (iniciado) { Assistente.sincronizar(); return; }
    if (!Assistente.ativoNoApp()) return;
    iniciado = true;
    Assistente.iniciar();
  }
  function arrancar() {
    var D = dgo();
    if (moduloTemOProprio()) return;
    if (!D) { iniciar(); return; }
    registrarNoDGO();
    /* o módulo já terminou de abrir (o estilo dele está na página)? senão, espera o "dgo:pronto" */
    if (d.getElementById('dgo-estilo')) iniciar();
  }

  d.addEventListener('dgo:pronto', function () { setTimeout(iniciar, 0); });
  d.addEventListener('dgo:idioma', function () { Assistente.redesenhar(); });
  /* app sem o módulo: troca de idioma pelo <html lang> */
  if (raiz.MutationObserver) {
    new MutationObserver(function () { if (!dgo()) Assistente.redesenhar(); })
      .observe(d.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  registrarNoDGO();
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { setTimeout(arrancar, 0); });
  else setTimeout(arrancar, 0);

  /* ------------------------------------------------------------------
     API pública: AssistONE (e DGO.assistente com os nomes do 1.1.4)
     ------------------------------------------------------------------ */
  /* com o módulo antigo na página, quem manda é o AssistONE de dentro dele: as chamadas vão para lá */
  function via(nome, fn) {
    return function () {
      if (moduloTemOProprio()) { var a = raiz.DGO.assistente; return typeof a[nome] === 'function' ? a[nome].apply(a, arguments) : undefined; }
      return fn.apply(null, arguments);
    };
  }
  raiz.AssistONE = {
    __assistone: true,
    versao: VERSAO,
    /* app sem o módulo (ou que quer trocar o que o assistente sabe):
       AssistONE.configurar({ app, nome, cor, assistente: { telas, tour, dicas, busca, … } })
       também aceita só o bloco do assistente: AssistONE.configurar({ telas, tour, … }) */
    configurar: function (c) {
      c = c || {};
      var ehBloco = !c.assistente && (c.telas || c.tour || c.dicas || c.busca || c.tela || c.imagem || c.esconderCom);
      proprio = ehBloco ? { assistente: c } : c;
      if (!proprio.assistente) proprio.assistente = {};
      if (d.readyState !== 'loading') setTimeout(iniciar, 0);
      return raiz.AssistONE;
    },
    iniciar: function () { iniciar(); return raiz.AssistONE; },
    abrir: via('abrir', function () { Assistente.abrir(); }),
    fechar: via('fechar', function () { Assistente.fechar(); }),
    ligado: via('ligado', function () { return Assistente.ligado(); }),
    ligar: via('ligar', function (v) { Assistente.ligar(v !== false); }),
    tour: via('tour', function () { Assistente.tour(0); }),
    procurar: via('procurar', function (q) { Assistente.procurar(q); }),
    dica: via('dica', function () { Assistente.dica(); }),
    recomecar: via('recomecar', function () { Assistente.recomecar(); }),
    atualizar: via('atualizar', function () { Assistente.sincronizar(); }),
    /* o cartão liga/desliga para o app pôr nas próprias Configurações (app sem o módulo) */
    cartaoConfig: function () { return Cartoes.novo(); },
    tela: function () { return Assistente.tela(); },
    feedback: function () { return Assistente.feedback(); },
    chamado: function () { return Assistente.chamado(); }
  };
})(typeof window !== 'undefined' ? window : this);
