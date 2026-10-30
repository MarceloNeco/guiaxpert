/* =====================================================================
   DIRETRIZES GLOBAIS  —  modulo unico para os apps de MarceloNeco
   Versao 1.0.0
   ---------------------------------------------------------------------
   O que este arquivo faz, sozinho, em qualquer pagina onde for incluido:
     1. Idiomas Portugues / Ingles, com botao de troca sempre visivel
     2. Datas automaticas   PT: 17/Set/2026     EN: Sep/17/2026
     3. Varredura automatica do conteudo a cada atualizacao da tela
     4. Layout responsivo (celular, tablet, notebook) + area segura
     5. Tres tipos de acesso: Visitante, Pagante e Anunciante
     6. Banner de anuncio no topo, fechavel, que volta no proximo login
     7. OCR de verdade (le texto de foto) pela camera ou por arquivo
     8. Login social, biometria e senha
     9. Conexao segura com Google Drive / OneDrive + backup em arquivo
    10. Compartilhamento nativo (WhatsApp e afins)
    11. Preparado para virar app instalavel (celular e computador)

   Como usar:  <script src="diretrizes.js"></script>
               <script>DGO.iniciar({ app:'meu-app', nome:'Meu App' });</script>
   ===================================================================== */
(function (raiz) {
  'use strict';

  var VERSAO = '1.1.0';
  if (raiz.DGO && raiz.DGO.__carregado) { return; }

  /* ------------------------------------------------------------------
     1. CONFIGURACAO
     ------------------------------------------------------------------ */
  var cfg = {
    app: 'app',                       // identificador curto, sem espacos
    nome: 'App',                      // nome exibido (texto ou {pt:'',en:''})
    versaoApp: '',                    // versao do seu app (aparece em Config.)
    cor: '#0ea5e9',                   // cor de destaque
    corFundoBarra: '#0b1220',

    idiomaPadrao: 'pt',
    idiomaCompartilhado: true,        // mesmo idioma nos seus varios sites
    traducoes: {},                    // { 'Texto em portugues': 'Text in english' }

    datasAutomaticas: true,
    varreduraAutomatica: true,        // re-processa a tela a cada mudanca
    responsivo: true,

    seletorIdiomaVisivel: true,
    posicaoSeletorIdioma: 'faixa',   // 'faixa' = dentro da faixa do topo;
                                     // ou topo-direita, topo-esquerda,
                                     // baixo-direita, baixo-esquerda

    anuncios: {
      ativo: true,
      rotulo: { pt: 'ANÚNCIO', en: 'AD' },
      velocidade: 9,                  // segundos por cartao no carrossel
      lista: [],                      // vazio = os proprios apps do hub
      arquivo: 'anuncios.json',       // opcional: lista vinda de um arquivo
      /* enquanto uma destas telas estiver aberta, a faixa some sozinha
         e volta quando ela fecha (leitor de tela cheia, modal, etc.) */
      esconderCom: [],
      popup: {
        ativo: true,
        antesDoLogin: true,           // um app sorteado antes de entrar
        depoisDoLogin: true,          // outro app depois de entrar
        esperaSegundos: 3,            // conta 3, 2, 1 e so entao libera o X
        atrasoAbertura: 8,            // segundos ate aparecer
        atrasoAntesDoLogin: 5,
        umaVezPorSessao: true,        // uma vez antes e uma vez depois
        intervaloHoras: 0,            // 0 = sem limite alem da sessao
        botao: { pt: 'Conhecer', en: 'Open' }
      }
    },

    /* consulta a IA: a chave e da pessoa, colada uma vez, valendo nos 3 apps */
    ia: {
      ativo: true,
      botaoNaFaixa: true,           // o botao mora na faixa do topo, sem cobrir nada
      provedorPadrao: 'openrouter', // o que tem plano gratis e mais modelos num cadastro so
      modelos: {},                  // { openrouter:'...', groq:'...', gemini:'...' }
      enderecos: {},                // { personalizado:'https://.../v1' }
      proxy: {},                    // futuro: { openrouter:'https://seu-servidor/ia' } - a chave fica la
      contexto: '',                 // o que este app faz, para a IA saber onde esta
      sugestoes: [],                // [{pt,en}] perguntas de exemplo
      servico: 'ia'                 // id do servico, para o controle de nivel
    },

    /* o que pode ser feito em dados moveis: 'sempre' | 'wifi' | 'nunca' */
    rede: {
      pesado: 'wifi',               // imagens grandes, sons, motor de OCR, audio de voz
      ia: 'sempre'                  // perguntas a IA (sao pequenas)
    },

    /* niveis de acesso: Visitante -> Membro -> Premium */
    niveis: {
      ativo: true,
      padraoServico: 'visitante',   // nivel exigido quando o servico nao diz nada
      arquivo: 'servicos.json',     // fonte da verdade, editada pelo painel de admin
      servicos: [],                 // [{ id, nome:{pt,en}, descricao:{pt,en}, nivel }]
      aoQuererPremium: null
    },

    /* trechos que o tradutor e o formatador de datas nao podem tocar.
       O modulo marca sozinho, entao nao e preciso editar o index.html. */
    ignorar: [],

    login: {
      ativo: true,
      exigirNaAbertura: false,        // true = tela de login antes de usar
      permitirVisitante: true,
      permitirPagante: true,
      permitirAnunciante: true,
      google: { clientId: '' },       // preencha para ligar o login do Google
      biometria: true,
      exigirApelido: true,           // conta = apelido + e-mail + senha
      /* "esqueci a senha": o caminho muda conforme o que estiver configurado.
         1) se houver servidor (DGO.auth.backend.pedirRedefinicao) -> link por e-mail
         2) senao, se houver formularioRecuperacao -> o pedido chega para voce
         3) senao -> codigo de recuperacao gerado quando a conta e criada     */
      formularioRecuperacao: '',     // ex.: 'https://formspree.io/f/xxxxxxx'
      emailsAdmin: []                // contas com estes e-mails entram como administrador
    },

    email: {
      formulario: '',                // endereco do Formspree (ou parecido)
      deAvisos: '',                  // e-mail que voce usa para responder
      assuntoPadrao: ''
    },

    nuvem: {
      google: { clientId: '' },       // OAuth Web client ID
      microsoft: { clientId: '' },    // Azure app (SPA) client ID
      arquivo: 'dados.json'
    },

    ocr: {
      ativo: true,
      idiomas: 'por+eng',
      cdn: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
      caminhoLocal: '',               // se um dia hospedar o tesseract.js no repositorio
      caminhos: { worker: '', core: '', lang: '' },  // idem para worker, wasm e idiomas
      /* motor hospedado no proprio repositorio (recomendado):
         ocr-worker.js + tesseract-core-*.wasm.js + <idioma>.traineddata.gz */
      local: 'auto',                  // 'auto' | true | false
      worker: 'ocr-worker.js'
    },

    pwa: { ativo: true, manifesto: 'manifest.json', serviceWorker: 'sw.js' },

    notificacoes: {
      ativo: true,
      pedirNaAbertura: false,        // true = pede permissao assim que abre (evite)
      icone: 'icone-192.png',
      distintivo: 'icone-192.png',
      vapidPublicKey: '',            // chave publica do servidor de push (quando houver)
      endpointInscricao: '',         // endereco que guarda a inscricao do aparelho
      horarioSilencioso: { ativo: true, inicio: '22:00', fim: '07:00' },
      /* cada app declara os seus tipos de aviso; o usuario liga e desliga um a um */
      tipos: []                      // [{ id, nome:{pt,en}, descricao:{pt,en}, padrao:true }]
    },

    empurrarConteudo: true,
    seletoresTopoFixo: [],            // ex.: ['.minha-barra-fixa']
    aoTrocarIdioma: null,
    aoEntrar: null,
    aoSair: null
  };

  function fundir(alvo, novo) {
    for (var k in novo) {
      if (!Object.prototype.hasOwnProperty.call(novo, k)) continue;
      if (novo[k] && typeof novo[k] === 'object' && !Array.isArray(novo[k]) &&
          alvo[k] && typeof alvo[k] === 'object' && !Array.isArray(alvo[k])) {
        fundir(alvo[k], novo[k]);
      } else { alvo[k] = novo[k]; }
    }
    return alvo;
  }

  /* ------------------------------------------------------------------
     2. UTILIDADES
     ------------------------------------------------------------------ */
  var d = document;
  function el(tag, props, filhos) {
    var n = d.createElement(tag);
    if (props) for (var k in props) {
      if (k === 'style' && typeof props[k] === 'object') { for (var s in props[k]) n.style[s] = props[k][s]; }
      else if (k === 'html') { n.innerHTML = props[k]; }
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
  function texto(v) { return (v === null || v === undefined) ? '' : String(v); }

  /* '#a1b2c3' -> 'rgba(161,178,195,0.2)'  (sem depender de color-mix) */
  function corSuave(hex, alfa) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return 'rgba(148,163,184,' + (alfa || 0.2) + ')';
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ','
                   + parseInt(h.slice(4, 6), 16) + ',' + (alfa === undefined ? 0.2 : alfa) + ')';
  }

  /* Armazenamento com nome separado por app (os sites dividem o mesmo
     endereco marceloneco.github.io, entao os dados nao podem se misturar) */
  var Guardar = {
    prefixo: function () { return 'dgo:' + cfg.app + ':'; },
    _alvo: function () { return (Sessao.tipo === 'visitante') ? raiz.sessionStorage : raiz.localStorage; },
    ler: function (chave, padrao, global) {
      try {
        var p = global ? 'dgo:global:' : this.prefixo();
        var v = (global ? raiz.localStorage : this._alvo()).getItem(p + chave);
        return v === null ? padrao : JSON.parse(v);
      } catch (e) { return padrao; }
    },
    gravar: function (chave, valor, global) {
      try {
        var p = global ? 'dgo:global:' : this.prefixo();
        (global ? raiz.localStorage : this._alvo()).setItem(p + chave, JSON.stringify(valor));
        return true;
      } catch (e) { return false; }
    },
    apagar: function (chave, global) {
      try {
        var p = global ? 'dgo:global:' : this.prefixo();
        (global ? raiz.localStorage : this._alvo()).removeItem(p + chave);
      } catch (e) {}
    },
    limparPessoais: function () {
      try {
        [raiz.localStorage, raiz.sessionStorage].forEach(function (loja) {
          var fora = [], i;
          for (i = 0; i < loja.length; i++) {
            var c = loja.key(i);
            if (c && c.indexOf('dgo:' + cfg.app + ':') === 0 && c.indexOf(':conta:') === -1) fora.push(c);
          }
          fora.forEach(function (c) { loja.removeItem(c); });
        });
      } catch (e) {}
    }
  };

  /* ------------------------------------------------------------------
     3. ESTILO (injetado, com prefixo dgo- para nao afetar o seu app)
     ------------------------------------------------------------------ */
  function injetarEstilo() {
    if ($('#dgo-estilo')) return;
    var css = [
      ':root{--dgo-topo:0px;--dgo-cor:' + cfg.cor + ';--dgo-barra:' + cfg.corFundoBarra + ';}',
      '.dgo-oculto{display:none !important;}',
      /* ---------- faixa do topo ---------- */
      '.dgo-faixa{position:fixed;top:0;left:0;right:0;z-index:2147483000;display:flex;align-items:stretch;gap:7px;',
      'background:#0e1524;border-bottom:1px solid rgba(255,255,255,.12);padding:6px 7px;',
      'padding-top:calc(6px + env(safe-area-inset-top,0px));box-sizing:border-box;overflow:hidden;',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}',
      '.dgo-faixa.dgo-fina{padding:4px 7px;padding-top:calc(4px + env(safe-area-inset-top,0px));}',
      '.dgo-rot{flex:0 0 auto;align-self:stretch;display:flex;align-items:center;justify-content:center;',
      'writing-mode:vertical-rl;transform:rotate(180deg);font-size:8.5px;font-weight:800;letter-spacing:.22em;',
      'color:#64748b;border-right:1px solid rgba(255,255,255,.12);padding:0 3px 0 1px;}',
      '.dgo-carrossel{flex:1 1 auto;min-width:0;overflow:hidden;position:relative;',
      '-webkit-mask-image:linear-gradient(90deg,transparent,#000 14px,#000 calc(100% - 14px),transparent);',
      'mask-image:linear-gradient(90deg,transparent,#000 14px,#000 calc(100% - 14px),transparent);}',
      '.dgo-trilho{display:flex;width:max-content;animation:dgo-desliza 60s linear infinite;}',
      '.dgo-carrossel:hover .dgo-trilho,.dgo-carrossel:focus-within .dgo-trilho{animation-play-state:paused;}',
      '@keyframes dgo-desliza{from{transform:translateX(0)}to{transform:translateX(-50%)}}',
      '.dgo-card{flex:0 0 auto;display:flex;align-items:center;gap:8px;width:224px;padding:5px 9px 5px 6px;',
      'margin-right:7px;border-radius:9px;text-decoration:none;background:rgba(255,255,255,.045);',
      'border:1px solid rgba(255,255,255,.09);transition:background .15s,border-color .15s;}',
      '.dgo-card:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);}',
      '.dgo-ic{flex:0 0 auto;width:30px;height:30px;border-radius:8px;border:1px solid;display:flex;',
      'align-items:center;justify-content:center;font-size:16px;line-height:1;object-fit:cover;}',
      '.dgo-tx{min-width:0;display:flex;flex-direction:column;gap:1px;}',
      '.dgo-nm{display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:#e8eef8;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.dgo-pt{flex:0 0 auto;width:6px;height:6px;border-radius:50%;}',
      '.dgo-seta{flex:0 0 auto;color:#7dd3fc;font-weight:400;}',
      '.dgo-selo{flex:0 0 auto;font-style:normal;font-size:7.5px;font-weight:800;letter-spacing:.08em;',
      'padding:1px 4px;border-radius:4px;background:rgba(251,191,36,.18);color:#fcd34d;}',
      '.dgo-fr{font-size:10px;line-height:1.25;color:#8b9ab0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.dgo-faixa .dgo-x{flex:0 0 auto;align-self:center;width:26px;height:26px;border-radius:50%;border:0;cursor:pointer;',
      'background:rgba(255,255,255,.12);color:#fff;font-size:15px;line-height:26px;padding:0;}',
      '.dgo-faixa .dgo-x:hover{background:rgba(255,255,255,.26);}',
      /* ---------- seletor de idioma ---------- */
      '.dgo-idioma{display:flex;align-items:center;gap:0;background:rgba(255,255,255,.07);color:#fff;',
      'border-radius:999px;padding:2px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;',
      'font-size:11px;font-weight:800;user-select:none;}',
      '.dgo-idioma.dgo-na-faixa{flex:0 0 auto;align-self:center;}',
      '.dgo-idioma.dgo-flutua{position:fixed;z-index:2147483100;background:rgba(15,23,42,.92);padding:3px;',
      'box-shadow:0 4px 14px rgba(0,0,0,.35);font-size:12px;}',
      '.dgo-idioma button{border:0;background:transparent;color:#cbd5e1;padding:5px 9px;border-radius:999px;',
      'cursor:pointer;font:inherit;min-width:34px;min-height:28px;}',
      '.dgo-idioma.dgo-flutua button{padding:6px 11px;min-width:40px;min-height:32px;}',
      '.dgo-idioma button.dgo-on{background:var(--dgo-cor);color:#04121f;}',
      '.dgo-idioma.dgo-topo-direita{right:10px;top:calc(var(--dgo-topo) + 10px);}',
      '.dgo-idioma.dgo-topo-esquerda{left:10px;top:calc(var(--dgo-topo) + 10px);}',
      '.dgo-idioma.dgo-baixo-direita{right:10px;bottom:calc(12px + env(safe-area-inset-bottom,0px));}',
      '.dgo-idioma.dgo-baixo-esquerda{left:10px;bottom:calc(12px + env(safe-area-inset-bottom,0px));}',
      /* ---------- widget de IA ---------- */
      '.dgo-ia-fio{max-height:46vh;overflow:auto;margin:12px 0;display:flex;flex-direction:column;gap:8px;',
      '-webkit-overflow-scrolling:touch;}',
      '.dgo-ia-msg{max-width:88%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.5;',
      'white-space:pre-wrap;word-break:break-word;}',
      '.dgo-ia-msg.dgo-eu{align-self:flex-end;background:var(--dgo-cor);color:#08131d;font-weight:500;}',
      '.dgo-ia-msg.dgo-ia{align-self:flex-start;background:rgba(255,255,255,.07);color:#e2e8f0;}',
      '.dgo-ia-msg.dgo-pensando{opacity:.6;font-style:italic;}',
      '.dgo-ia-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;}',
      '.dgo-ia-chips button{border:1px solid rgba(255,255,255,.18);background:transparent;color:#cbd5e1;',
      'border-radius:999px;padding:7px 12px;font-size:12.5px;cursor:pointer;font-family:inherit;}',
      '.dgo-ia-chips button:hover{background:rgba(255,255,255,.08);}',
      '.dgo-ia-entrada{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:12px;',
      'border:1px solid rgba(255,255,255,.16);background:#0b1220;color:#e2e8f0;font-size:15px;',
      'font-family:inherit;resize:vertical;}',
      '.dgo-faixa .dgo-ia-bt{flex:0 0 auto;align-self:center;width:30px;height:30px;border-radius:50%;',
      'border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#e2e8f0;',
      'font-size:14px;line-height:1;cursor:pointer;padding:0;}',
      '.dgo-faixa .dgo-ia-bt:hover{background:rgba(255,255,255,.16);}',
      /* ---------- cofre de chaves ---------- */
      '.dgo-prov-cab{display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;',
      'padding:11px 12px;margin-top:6px;border-radius:11px;border:1px solid rgba(255,255,255,.12);',
      'background:rgba(255,255,255,.04);color:#e2e8f0;font:inherit;font-size:14px;font-weight:700;cursor:pointer;}',
      '.dgo-prov-cab.dgo-on{border-color:var(--dgo-cor);background:rgba(255,255,255,.07);}',
      '.dgo-prov-nome{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
      '.dgo-prov-corpo{padding:10px 12px 4px;border:1px solid rgba(255,255,255,.08);border-top:0;',
      'border-radius:0 0 11px 11px;margin-top:-4px;background:rgba(0,0,0,.15);}',
      '.dgo-selo-ok{background:rgba(34,197,94,.18) !important;color:#86efac !important;}',
      '.dgo-selo-pago{background:rgba(148,163,184,.18) !important;color:#cbd5e1 !important;}',
      '.dgo-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 6px;}',
      '.dgo-chip{font:inherit;font-size:12.5px;font-weight:700;padding:7px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.18);',
      'background:transparent;color:#e2e8f0;cursor:pointer;min-height:34px;}',
      '.dgo-chip.dgo-on{background:var(--dgo-cor);color:#04121f;border-color:var(--dgo-cor);}',
      '.dgo-cap{font-size:13px;line-height:1;}',
      '.dgo-serve{margin:4px 0 8px;font-size:13.5px;color:#e2e8f0;}',
      '.dgo-guia{margin:10px 0;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:6px 10px;}',
      '.dgo-guia summary{cursor:pointer;font-weight:700;font-size:13.5px;padding:4px 0;}',
      '.dgo-guia-lista{padding-left:22px;margin:6px 0 0;}',
      '.dgo-guia-lista li{margin:0 0 12px;}',
      '.dgo-guia-lista li p{margin:0 0 6px;font-size:13.5px;line-height:1.45;}',
      '.dgo-guia-ilu{margin:0;max-width:300px;}',
      '.dgo-guia-ilu img,.dgo-guia-ilu svg{display:block;width:100%;height:auto;border-radius:10px;}',
      '.dgo-campo{position:relative;}',
      '.dgo-olho{position:absolute;right:6px;bottom:6px;width:34px;height:34px;border:0;border-radius:8px;background:transparent;color:#94a3b8;cursor:pointer;font-size:16px;}',
      '.dgo-usar{flex-wrap:wrap;}.dgo-usar .dgo-b{width:auto;flex:1 1 auto;}',
      '.dgo-b.dgo-b2.dgo-on{border-color:var(--dgo-cor);color:var(--dgo-cor);}',
      '@media (prefers-color-scheme:light){.dgo-guia-ilu svg{filter:none;}}',
      '.dgo-caixa select{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;',
      'border:1px solid rgba(255,255,255,.16);background:#0b1220;color:#e2e8f0;font-size:15px;font-family:inherit;}',
      /* ---------- wizard ---------- */
      '.dgo-wz-topo{font-size:10px;font-weight:800;letter-spacing:.18em;color:#64748b;',
      'text-transform:uppercase;margin-bottom:9px;}',
      '.dgo-wz-barra{display:flex;gap:4px;margin-bottom:6px;}',
      '.dgo-wz-barra i{flex:1;height:4px;border-radius:99px;background:rgba(255,255,255,.14);}',
      '.dgo-wz-barra i.dgo-on{background:var(--dgo-cor);}',
      /* ---------- bloqueio por nivel ---------- */
      '.dgo-cadeado{font-size:34px;line-height:1;text-align:center;margin:2px 0 10px;}',
      '.dgo-bloqueado{position:relative;opacity:.62;}',
      '.dgo-bloqueado::after{content:"\\1F512";position:absolute;top:2px;right:4px;font-size:12px;',
      'line-height:1;pointer-events:none;}',
      '.dgo-admin-barra{position:fixed;left:50%;transform:translateX(-50%);z-index:2147483150;',
      'bottom:calc(10px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:8px;',
      'background:rgba(251,191,36,.95);color:#1c1300;border-radius:999px;padding:5px 6px 5px 14px;',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:11.5px;font-weight:800;',
      'letter-spacing:.04em;box-shadow:0 8px 24px rgba(0,0,0,.4);max-width:94vw;}',
      '.dgo-admin-barra button{border:0;background:rgba(28,19,0,.14);color:#1c1300;border-radius:999px;',
      'padding:6px 11px;font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;}',
      '.dgo-admin-barra button:hover{background:rgba(28,19,0,.26);}',
      /* ---------- pop-up de anuncio ---------- */
      '.dgo-pop-fundo{position:fixed;inset:0;z-index:2147483300;background:rgba(2,6,23,.82);',
      'backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;',
      'box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}',
      '.dgo-pop-env{position:relative;width:100%;max-width:340px;}',
      '.dgo-pop{position:relative;width:100%;background:#141c2b;border:1px solid rgba(255,255,255,.14);',
      'border-radius:24px;box-sizing:border-box;text-align:center;overflow:hidden;display:flex;',
      'flex-direction:column;box-shadow:0 26px 70px rgba(0,0,0,.6);animation:dgo-sobe .26s ease-out;}',
      '@keyframes dgo-sobe{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion:reduce){.dgo-pop{animation:none}}',
      '.dgo-pop-arte{position:relative;display:flex;align-items:center;justify-content:center;',
      'padding:30px 20px 4px;background:linear-gradient(160deg,var(--c-suave),transparent 70%);}',
      '.dgo-pop-halo{position:absolute;width:210px;height:210px;border-radius:50%;',
      'background:radial-gradient(circle,var(--c-suave),transparent 66%);filter:blur(4px);opacity:.9;}',
      '.dgo-pop-ic{position:relative;width:82px;height:82px;border-radius:22px;border:1px solid;',
      'display:flex;align-items:center;justify-content:center;font-size:41px;line-height:1;object-fit:cover;}',
      '.dgo-pop-corpo{padding:16px 24px 20px;display:flex;flex-direction:column;}',
      '.dgo-pop-nome{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;',
      'font-size:22px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:8px;}',
      '.dgo-pop-frase{font-size:14.5px;line-height:1.5;color:#a9b6c8;margin-bottom:20px;}',
      '.dgo-pop-bt{display:flex;align-items:center;justify-content:center;gap:9px;text-decoration:none;',
      'background:var(--c,var(--dgo-cor));color:#0a1017;font-size:15px;font-weight:800;padding:14px 20px;',
      'border-radius:999px;letter-spacing:.02em;transition:filter .15s,transform .15s;}',
      '.dgo-pop-bt:hover{filter:brightness(1.1);transform:translateY(-1px);}',
      '.dgo-pop-seta{font-weight:400;}',
      '.dgo-pop-rot{font-size:8.5px;font-weight:800;letter-spacing:.22em;color:#5b6879;}',
      '.dgo-pop-rot-topo{display:none;}',
      '.dgo-pop-rot-baixo{margin-top:14px;}',
      /* ---- em tela larga o pop-up deita: arte de um lado, texto do outro ---- */
      '@media (min-width:660px){',
      '.dgo-pop-env{max-width:640px;}',
      '.dgo-pop{flex-direction:row;text-align:left;border-radius:26px;}',
      '.dgo-pop-arte{flex:0 0 244px;align-self:stretch;padding:34px 18px;',
      'background:linear-gradient(150deg,var(--c-suave),var(--c-fraca) 55%,transparent);',
      'border-right:1px solid rgba(255,255,255,.08);}',
      '.dgo-pop-halo{width:250px;height:250px;}',
      '.dgo-pop-ic{width:116px;height:116px;border-radius:30px;font-size:58px;}',
      '.dgo-pop-corpo{flex:1 1 auto;padding:34px 34px 30px;justify-content:center;}',
      '.dgo-pop-nome{justify-content:flex-start;font-size:29px;margin-bottom:11px;}',
      '.dgo-pop-frase{font-size:16px;margin-bottom:26px;max-width:32ch;}',
      '.dgo-pop-bt{align-self:flex-start;padding:15px 30px;font-size:15.5px;}',
      '.dgo-pop-rot-topo{display:block;margin-bottom:13px;}',
      '.dgo-pop-rot-baixo{display:none;}',
      '.dgo-pop-x{top:-19px;right:-19px;width:48px;height:48px;}',
      '}',
      '.dgo-pop-x{position:absolute;top:-17px;right:-17px;width:46px;height:46px;',
      'border-radius:50%;border:1px solid rgba(255,255,255,.18);background:#27344a;color:#94a3b8;',
      'font-size:17px;font-weight:800;cursor:default;z-index:2;box-shadow:0 6px 18px rgba(0,0,0,.45);}',
      '.dgo-pop-x.dgo-pronto{cursor:pointer;font-size:23px;color:#fff;}',
      '.dgo-pop-x.dgo-pronto:hover{background:#334155;}',
      '@media (max-width:420px){.dgo-pop-x{top:-14px;right:-8px;width:40px;height:40px;}',
      '.dgo-pop-ic{width:66px;height:66px;font-size:33px;}}',
      '@media (max-width:440px){.dgo-card{width:198px;}',
      '.dgo-idioma.dgo-na-faixa button{min-width:30px;padding:5px 7px;font-size:10.5px;}}',
      '.dgo-modal{position:fixed;inset:0;z-index:2147483200;background:rgba(2,6,23,.72);backdrop-filter:blur(3px);',
      'display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overscroll-behavior:contain;}',
      '.dgo-caixa{background:#0f172a;color:#e2e8f0;border:1px solid rgba(255,255,255,.12);border-radius:16px;',
      'width:100%;max-width:440px;max-height:92vh;overflow:auto;box-shadow:0 24px 60px rgba(0,0,0,.6);',
      'padding:18px;box-sizing:border-box;-webkit-overflow-scrolling:touch;}',
      '.dgo-caixa.dgo-larga{max-width:760px;}',
      '.dgo-caixa h2{margin:0 0 4px;font-size:19px;color:#fff;}',
      '.dgo-caixa h3{margin:18px 0 8px;font-size:14px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;}',
      '.dgo-caixa p{margin:0 0 12px;font-size:13.5px;line-height:1.5;color:#94a3b8;}',
      '.dgo-abas{display:flex;gap:6px;margin:14px 0;flex-wrap:wrap;}',
      '.dgo-abas button{flex:1;min-width:96px;min-height:40px;padding:9px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);',
      'background:transparent;color:#cbd5e1;cursor:pointer;font-size:13px;font-weight:600;}',
      '.dgo-abas button.dgo-on{background:var(--dgo-cor);border-color:var(--dgo-cor);color:#04121f;}',
      '.dgo-campo{display:block;margin:0 0 10px;}',
      '.dgo-campo span{display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;}',
      '.dgo-campo input,.dgo-campo select,.dgo-campo textarea{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;',
      'border:1px solid rgba(255,255,255,.16);background:#0b1220;color:#e2e8f0;font-size:16px;font-family:inherit;}',
      '.dgo-b{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;padding:12px 14px;',
      'border-radius:11px;border:0;background:var(--dgo-cor);color:#04121f;font-size:14.5px;font-weight:700;cursor:pointer;margin-top:6px;font-family:inherit;}',
      '.dgo-b.dgo-b2{background:transparent;border:1px solid rgba(255,255,255,.2);color:#e2e8f0;}',
      '.dgo-b:disabled{opacity:.5;cursor:not-allowed;}',
      '.dgo-aviso{font-size:12.5px;border-radius:9px;padding:9px 11px;margin:10px 0 0;line-height:1.45;}',
      '.dgo-aviso.erro{background:rgba(239,68,68,.15);color:#fca5a5;}',
      '.dgo-aviso.ok{background:rgba(34,197,94,.15);color:#86efac;}',
      '.dgo-aviso.info{background:rgba(148,163,184,.14);color:#cbd5e1;}',
      '.dgo-linha{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
      '.dgo-linha>*{flex:1;min-width:120px;}',
      '.dgo-fechar{position:absolute;top:10px;right:12px;}',
      '.dgo-video,.dgo-foto{width:100%;border-radius:12px;background:#000;display:block;max-height:48vh;object-fit:contain;}',
      '.dgo-barra{height:7px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden;margin:10px 0;}',
      '.dgo-barra i{display:block;height:100%;width:0;background:var(--dgo-cor);transition:width .18s;}',
      '.dgo-sep{height:1px;background:rgba(255,255,255,.1);margin:16px 0;}',
      '.dgo-mini{font-size:11.5px;color:#64748b;}',
      '@media (max-width:480px){.dgo-caixa{max-width:100%;border-radius:14px;padding:15px;}.dgo-abas button{min-width:0;}}'
    ].join('');

    var extra = cfg.responsivo ? [
      'html{-webkit-text-size-adjust:100%;text-size-adjust:100%;}',
      'img,video,canvas,svg{max-width:100%;}',
      '@media (max-width:640px){body{overflow-x:hidden;}}'
    ].join('') : '';

    d.head.appendChild(el('style', { id: 'dgo-estilo', html: css + extra }));
  }

  function garantirMeta() {
    if (!$('meta[name="viewport"]')) {
      d.head.appendChild(el('meta', {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover'
      }));
    } else {
      var m = $('meta[name="viewport"]');
      if ((m.getAttribute('content') || '').indexOf('viewport-fit') === -1) {
        m.setAttribute('content', m.getAttribute('content') + ', viewport-fit=cover');
      }
    }
    if (!$('meta[name="theme-color"]')) {
      d.head.appendChild(el('meta', { name: 'theme-color', content: cfg.corFundoBarra }));
    }
  }

  /* ------------------------------------------------------------------
     4. IDIOMAS
     ------------------------------------------------------------------ */
  var MES = {
    pt: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  };

  /* Textos da propria interface deste modulo */
  var UI = {
    entrar: ['Entrar', 'Sign in'],
    sair: ['Sair', 'Sign out'],
    visitante: ['Visitante', 'Guest'],
    assinante: ['Assinante', 'Subscriber'],
    anunciante: ['Anunciante', 'Advertiser'],
    email: ['E-mail', 'E-mail'],
    senha: ['Senha', 'Password'],
    confirmarSenha: ['Confirmar senha', 'Confirm password'],
    criarConta: ['Criar conta', 'Create account'],
    jaTenhoConta: ['Já tenho conta', 'I already have an account'],
    entrarVisitante: ['Entrar sem senha', 'Continue without a password'],
    avisoVisitante: ['Como visitante nenhum dado pessoal é guardado e são exibidos anúncios.',
                     'As a guest no personal data is kept and ads are displayed.'],
    avisoMembro: ['Com conta os dados ficam guardados. Sem anúncios só no Premium.',
                  'With an account your data is kept. Ad-free only with Premium.'],
    avisoAnunciante: ['Área para acompanhar campanhas e desempenho dos anúncios.',
                      'Area to follow campaigns and ad performance.'],
    entrarGoogle: ['Entrar com Google', 'Sign in with Google'],
    entrarBiometria: ['Entrar com biometria', 'Sign in with biometrics'],
    ativarBiometria: ['Ativar biometria neste aparelho', 'Enable biometrics on this device'],
    biometriaAtiva: ['Biometria ativada neste aparelho.', 'Biometrics enabled on this device.'],
    configuracoes: ['Configurações', 'Settings'],
    idioma: ['Idioma', 'Language'],
    conta: ['Conta', 'Account'],
    nuvem: ['Nuvem e backup', 'Cloud and backup'],
    conectarDrive: ['Conectar Google Drive', 'Connect Google Drive'],
    conectarOneDrive: ['Conectar OneDrive', 'Connect OneDrive'],
    desconectar: ['Desconectar', 'Disconnect'],
    enviarNuvem: ['Enviar para a nuvem', 'Upload to the cloud'],
    baixarNuvem: ['Trazer da nuvem', 'Download from the cloud'],
    salvarArquivo: ['Salvar backup em arquivo', 'Save backup to a file'],
    abrirArquivo: ['Restaurar de um arquivo', 'Restore from a file'],
    compartilhar: ['Compartilhar', 'Share'],
    copiarLink: ['Copiar link', 'Copy link'],
    copiado: ['Copiado.', 'Copied.'],
    instalarApp: ['Instalar como app', 'Install as an app'],
    appInstalado: ['App ja instalado.', 'App already installed.'],
    escanear: ['Escanear (OCR)', 'Scan (OCR)'],
    usarCamera: ['Usar a câmera', 'Use the camera'],
    escolherImagem: ['Escolher uma imagem', 'Choose an image'],
    tirarFoto: ['Tirar foto', 'Take a photo'],
    outraFoto: ['Outra foto', 'Another photo'],
    lerTexto: ['Ler o texto', 'Read the text'],
    lendo: ['Lendo a imagem...', 'Reading the image...'],
    carregandoMotor: ['Preparando o leitor...', 'Preparing the reader...'],
    textoLido: ['Texto lido', 'Text read'],
    usarTexto: ['Usar este texto', 'Use this text'],
    copiarTexto: ['Copiar texto', 'Copy text'],
    semCamera: ['Não foi possível abrir a câmera neste aparelho.', 'The camera could not be opened on this device.'],
    fechar: ['Fechar', 'Close'],
    cancelar: ['Cancelar', 'Cancel'],
    salvar: ['Salvar', 'Save'],
    anuncio: ['Publicidade', 'Advertisement'],
    anuncioRotulo: ['ANÚNCIO', 'AD'],
    conhecer: ['Conhecer', 'Open'],
    fecharAnuncio: ['Fechar anúncio', 'Close ad'],
    anuncieAqui: ['<ANUNCIE AQUI>', '<ADVERTISE HERE>'],
    versao: ['Versão', 'Version'],
    naoConfigurado: ['Ainda não configurado. Veja o passo a passo.', 'Not configured yet. See the step-by-step guide.'],
    senhaCurta: ['A senha precisa de pelo menos 6 caracteres.', 'The password needs at least 6 characters.'],
    senhasDiferentes: ['As duas senhas não são iguais.', 'The two passwords do not match.'],
    contaExiste: ['Já existe uma conta com esse e-mail neste aparelho.', 'An account with that e-mail already exists on this device.'],
    dadosErrados: ['E-mail ou senha incorretos.', 'Wrong e-mail or password.'],
    semConta: ['Nenhuma conta encontrada. Crie uma conta primeiro.', 'No account found. Create an account first.'],
    campanhas: ['Campanhas', 'Campaigns'],
    exibicoes: ['Exibições', 'Impressions'],
    cliques: ['Cliques', 'Clicks'],
    painelAnunciante: ['Painel do anunciante', 'Advertiser panel'],
    semCampanhas: ['Nenhuma campanha cadastrada ainda.', 'No campaigns registered yet.'],
    novaCampanha: ['Nova campanha', 'New campaign'],
    titulo: ['Título', 'Title'],
    linkDestino: ['Link de destino', 'Destination link'],
    imagemUrl: ['Endereço da imagem', 'Image address'],
    periodo: ['Período', 'Period'],
    ate: ['até', 'to'],
    ativa: ['Ativa', 'Active'],
    pausada: ['Pausada', 'Paused'],

    notificacoes: ['Notificações', 'Notifications'],
    ativarNotificacoes: ['Ativar notificações', 'Enable notifications'],
    notifAtivas: ['Notificações ativadas neste aparelho.', 'Notifications enabled on this device.'],
    notifBloqueadas: ['As notificações estão bloqueadas nas configurações do navegador. Libere por lá para voltar a receber.',
                      'Notifications are blocked in the browser settings. Allow them there to receive alerts again.'],
    notifSemSuporte: ['Este navegador não envia notificações.', 'This browser does not send notifications.'],
    notifIOS: ['No iPhone e no iPad é preciso instalar o app na Tela de Início para receber avisos.',
               'On iPhone and iPad the app must be installed on the Home Screen to receive alerts.'],
    avisosDoApp: ['Quais avisos você quer receber', 'Which alerts you want to receive'],
    horarioSilencioso: ['Horário silencioso', 'Quiet hours'],
    testarAviso: ['Enviar um aviso de teste', 'Send a test alert'],
    lembretes: ['Lembretes agendados', 'Scheduled reminders'],
    semLembretes: ['Nenhum lembrete agendado.', 'No reminders scheduled.'],
    remover: ['Remover', 'Remove'],
    comAppFechado: ['Receber avisos com o app fechado', 'Receive alerts with the app closed'],
    inscrito: ['Este aparelho está inscrito para receber avisos.', 'This device is subscribed to receive alerts.'],
    avisoTesteTitulo: ['Aviso de teste', 'Test alert'],
    avisoTesteTexto: ['Se você está lendo isto, as notificações funcionam.',
                      'If you are reading this, notifications are working.'],

    apelido: ['Apelido (nome de usuário)', 'Alias (username)'],
    apelidoOuEmail: ['Apelido ou e-mail', 'Alias or e-mail'],
    esqueciSenha: ['Esqueci a senha', 'I forgot my password'],
    recuperarSenha: ['Recuperar a senha', 'Recover password'],
    codigoRecuperacao: ['Código de recuperação', 'Recovery code'],
    guardeCodigo: ['Guarde este código num lugar seguro. Ele é a única forma de voltar à conta se a senha for esquecida, e não será mostrado outra vez.',
                   'Keep this code somewhere safe. It is the only way back into the account if the password is forgotten, and it will not be shown again.'],
    copiarCodigo: ['Copiar o código', 'Copy the code'],
    baixarCodigo: ['Baixar em arquivo', 'Download as a file'],
    jaGuardei: ['Já guardei, continuar', 'Saved it, continue'],
    novaSenha: ['Nova senha', 'New password'],
    confirmarNovaSenha: ['Confirmar a nova senha', 'Confirm the new password'],
    trocarSenha: ['Trocar a senha', 'Change password'],
    senhaAtual: ['Senha atual', 'Current password'],
    codigoErrado: ['Código de recuperação incorreto.', 'Wrong recovery code.'],
    senhaTrocada: ['Senha trocada. Entre com a senha nova.', 'Password changed. Sign in with the new password.'],
    apelidoEmUso: ['Esse apelido já está em uso neste aparelho.', 'That alias is already in use on this device.'],
    apelidoCurto: ['O apelido precisa de 3 letras ou mais, sem espaços.', 'The alias needs 3 or more characters, no spaces.'],
    emailInvalido: ['Escreva um e-mail válido.', 'Write a valid e-mail address.'],
    comoRecuperar: ['Como você quer recuperar o acesso?', 'How do you want to recover access?'],
    porEmail: ['Receber um link por e-mail', 'Get a link by e-mail'],
    porCodigo: ['Usar o código de recuperação', 'Use the recovery code'],
    pedirAoDono: ['Pedir ajuda ao responsável pelo site', 'Ask the site owner for help'],
    verifiqueEmail: ['Se esse e-mail estiver cadastrado, o link de redefinição já foi enviado.',
                     'If that e-mail is registered, the reset link has been sent.'],
    pedidoEnviado: ['Pedido enviado. A resposta chega no e-mail que você informou.',
                    'Request sent. The reply will arrive at the e-mail you provided.'],
    pedidoFalhou: ['Não foi possível enviar o pedido agora.', 'The request could not be sent right now.'],
    mensagem: ['Mensagem', 'Message'],
    enviarPedido: ['Enviar pedido', 'Send request'],
    semRecuperacaoConfigurada: ['Este app ainda não tem recuperação por e-mail. Use o código de recuperação que apareceu quando a conta foi criada.',
                                'This app has no e-mail recovery yet. Use the recovery code shown when the account was created.'],
    contaCriada: ['Conta criada.', 'Account created.'],
    identificadorVazio: ['Escreva o apelido ou o e-mail da conta.', 'Write the alias or the e-mail of the account.'],

    membro: ['Membro', 'Member'],
    premium: ['Premium', 'Premium'],
    admin: ['Administrador', 'Administrator'],
    painelAdmin: ['Painel do administrador', 'Administrator panel'],
    adminNaoEhSeguranca: ['Este painel serve para testar o fluxo. Num site sem servidor ele organiza a oferta, mas não protege nada.',
                          'This panel is for testing the flow. On a site without a server it organizes the offer, but protects nothing.'],
    verComo: ['Ver o app como', 'View the app as'],
    modoTeste: ['MODO DE TESTE', 'TEST MODE'],
    sairDoTeste: ['Sair do teste', 'Leave test mode'],
    servicos: ['Serviços e níveis', 'Services and levels'],
    semServicos: ['Este app ainda não declarou serviços.', 'This app has not declared any services yet.'],
    baixarServicos: ['Baixar o arquivo de níveis', 'Download the levels file'],
    servicosComoSubir: ['Suba este arquivo na raiz do repositório para valer para todo mundo.',
                        'Upload this file to the repository root so it applies to everyone.'],
    contas: ['Contas neste aparelho', 'Accounts on this device'],
    sohMembro: ['Este recurso é para quem tem conta. Criar conta é rápido e gratuito.',
                'This feature is for account holders. Creating an account is quick and free.'],
    sohPremium: ['Este recurso faz parte do Premium.', 'This feature is part of Premium.'],
    virarPremium: ['Quero o Premium', 'I want Premium'],
    premiumSemCobranca: ['Ainda não há cobrança automática. O pedido chega para o responsável, que libera a conta.',
                         'There is no automatic billing yet. The request reaches the site owner, who unlocks the account.'],
    entendi: ['Entendi', 'Got it'],

    wzAvancar: ['Avançar', 'Next'],
    wzVoltar: ['Voltar', 'Back'],
    wzConcluir: ['Concluir', 'Finish'],
    wzPular: ['Pular por enquanto', 'Skip for now'],
    wzObrigatorio: ['Falta preencher:', 'Still missing:'],

    perguntarIA: ['Perguntar à IA', 'Ask the AI'],
    perguntar: ['Perguntar', 'Ask'],
    pensando: ['Pensando...', 'Thinking...'],
    escrevaPergunta: ['Escreva a sua pergunta', 'Write your question'],
    sugestoes: ['Sugestões', 'Suggestions'],
    limparConversa: ['Limpar a conversa', 'Clear the conversation'],
    semResposta: ['A IA não devolveu resposta.', 'The AI returned no answer.'],
    erroIA: ['Não deu certo:', 'It did not work:'],
    semChave: ['Falta colar a chave da IA.', 'The AI key has not been pasted yet.'],
    semInternet: ['Sem internet agora. O resto do app continua funcionando.',
                  'No internet right now. The rest of the app keeps working.'],
    cofreChaves: ['Chaves de IA', 'AI keys'],
    tudo: ['Tudo', 'All'],
    emUsoAgora: ['Em uso agora', 'In use now'],
    limitesTit: ['Limites', 'Limits'],
    contaTit: ['Conta', 'Account'],
    abrirSite: ['Abrir o site', 'Open the site'],
    guiaPasso: ['Guia passo a passo', 'Step-by-step guide'],
    guiaPrintDica: ['Dica para quem administra: um print seu no lugar do desenho é só pôr um arquivo {arq} na raiz do app.',
                    'Tip for admins: to show your own screenshot instead of the drawing, put a file {arq} in the app root.'],
    suaChave: ['Sua chave', 'Your key'],
    umaVez: ['aparece só uma vez!', 'shows only once!'],
    salvarTestar: ['Salvar e testar', 'Save and test'],
    mostrarChave: ['Mostrar ou esconder a chave', 'Show or hide the key'],
    testando: ['Testando a chave com o provedor…', 'Testing the key with the provider…'],
    chaveOk: ['✓ Chave aceita. Pronto para usar.', '✓ Key accepted. Ready to use.'],
    chaveSalva: ['Chave salva.', 'Key saved.'],
    chaveRecusada: ['O provedor recusou a chave. Confira se copiou inteira, ou crie outra no site.', 'The provider rejected the key. Check you copied it whole, or create another on the site.'],
    corsAviso: ['Chave salva, mas o teste não passou pelo navegador. Pode ser bloqueio do provedor: tente usar a IA normalmente.', 'Key saved, but the test could not go through the browser. It may be a provider block: try using the AI normally.'],
    usarPara: ['Usar para', 'Use for'],
    pedeCartao: ['pede cartão', 'asks for a card'],
    chaveNuncaChat: ['Nunca cole a chave em chat, e-mail ou arquivo: ela é como uma senha.', 'Never paste the key in a chat, e-mail or file: it is like a password.'],
    cofreExplica: ['A chave é sua e fica guardada só neste navegador. Vale para os seus apps, e não passa por servidor nenhum além do próprio provedor.',
                   'The key is yours and is kept in this browser only. It works across your apps and goes to no server other than the provider itself.'],
    ondePegar: ['Onde pegar a chave do', 'Where to get the key for'],
    qualUsar: ['Qual usar', 'Which one to use'],
    emUso: ['Em uso', 'In use'],
    usarEste: ['Usar este', 'Use this one'],
    chave: ['Chave', 'Key'],
    chaveAvisoCusto: ['Nos provedores pagos, o uso é cobrado na sua conta. Nos grátis, há limite de pedidos por dia.',
                      'On paid providers usage is billed to your account. On free ones there is a daily request limit.'],
    gratis: ['grátis', 'free'],
    pago: ['pago', 'paid'],
    provedor: ['Provedor', 'Provider'],
    escolhaProvedor: ['Escolha o provedor…', 'Choose the provider…'],
    modelo: ['Modelo', 'Model'],
    listarModelos: ['Ver modelos que esta chave aceita', 'List models this key accepts'],
    modelosGratis: ['só os grátis', 'free only'],
    endereco: ['Endereço da API', 'API address'],
    colarChave: ['colar a chave', 'paste the key'],
    semEndereco: ['Falta o endereço da API deste provedor.', 'This provider is missing its API address.'],
    soWifi: ['Você escolheu usar a IA só no Wi-Fi. Conecte ao Wi-Fi ou mude em Configurações → Rede.',
             'You chose to use the AI on Wi-Fi only. Connect to Wi-Fi or change it in Settings → Network.'],
    redeTitulo: ['Rede e dados móveis', 'Network and mobile data'],
    redeAgora: ['Conexão agora', 'Connection now'],
    redePesado: ['Baixar imagens, sons e pacotes grandes', 'Download images, sounds and large packages'],
    redeIA: ['Perguntar à IA', 'Ask the AI'],
    redeSempre: ['Wi-Fi ou dados', 'Wi-Fi or data'],
    redeWifi: ['Só no Wi-Fi', 'Wi-Fi only'],
    redeNunca: ['Nunca', 'Never'],
    redeDados: ['dados móveis', 'mobile data'],
    redeOffline: ['sem internet', 'offline'],
    redeDesconhecida: ['não dá para saber neste navegador', 'cannot tell in this browser'],
    redeAviso: ['Você está em dados móveis', 'You are on mobile data'],
    redeSoWifi: ['Este download foi marcado para acontecer só no Wi-Fi.', 'This download is set to happen on Wi-Fi only.'],
    redeBaixarAgora: ['Baixar mesmo assim', 'Download anyway'],
    redeEsperarWifi: ['Esperar o Wi-Fi', 'Wait for Wi-Fi'],
    oQueAIARecebe: ['O que a IA recebe junto com a pergunta', 'What the AI receives with the question'],
    avisoIA: ['A resposta vem de um modelo de linguagem: pode errar. A pergunta e o contexto acima vão para o provedor escolhido; nada mais sai daqui.',
              'The answer comes from a language model: it can be wrong. The question and the context above go to the chosen provider; nothing else leaves.']
  };

  var Idioma = {
    atual: 'pt',
    _regex: null,
    _dic: null,
    _cache: null,

    normalizar: function (s) {
      return texto(s).trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ');
    },

    montarDicionario: function () {
      var dic = {}, k;
      for (k in BASE_PT_EN) if (Object.prototype.hasOwnProperty.call(BASE_PT_EN, k)) dic[Idioma.normalizar(k)] = BASE_PT_EN[k];
      for (k in cfg.traducoes) if (Object.prototype.hasOwnProperty.call(cfg.traducoes, k)) dic[Idioma.normalizar(k)] = cfg.traducoes[k];
      Idioma._dic = dic;
      Idioma._cache = {};
      /* o texto da pagina tem acentos; a busca aceita com e sem acento */
      var grafias = {}, bruto;
      function juntar(lista) {
        for (var i = 0; i < lista.length; i++) {
          bruto = String(lista[i]).trim().replace(/\s+/g, ' ');
          if (!bruto) continue;
          grafias[bruto] = 1;
          var sem = bruto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (sem !== bruto) grafias[sem] = 1;
        }
      }
      juntar(Object.keys(BASE_PT_EN));
      juntar(Object.keys(cfg.traducoes || {}));
      var chaves = Object.keys(grafias).sort(function (a, b) { return b.length - a.length; });
      if (!chaves.length) { Idioma._regex = null; return; }
      var partes = chaves.map(function (c) { return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
      try {
        Idioma._regex = new RegExp('(^|[^\\p{L}\\p{N}\\-])(' + partes.join('|') + ')(?![\\p{L}\\p{N}\\-])', 'giu');
      } catch (e) {
        Idioma._regex = new RegExp('(^|[^A-Za-z0-9\\u00C0-\\u024F\\-])(' + partes.join('|') + ')(?![A-Za-z0-9\\u00C0-\\u024F\\-])', 'gi');
      }
    },

    /* aplica o mesmo "formato de caixa" do original na traducao */
    caixa: function (orig, novo) {
      if (!orig) return novo;
      if (orig === orig.toUpperCase() && orig !== orig.toLowerCase()) return novo.toUpperCase();
      var p = orig.charAt(0);
      if (p === p.toUpperCase() && p !== p.toLowerCase()) return novo.charAt(0).toUpperCase() + novo.slice(1);
      return novo;
    },

    traduzir: function (s) {
      if (Idioma.atual !== 'en' || !s) return s;
      if (!Idioma._dic) Idioma.montarDicionario();
      if (Idioma._cache[s] !== undefined) return Idioma._cache[s];
      var saida = s, chave = Idioma.normalizar(s);
      if (Idioma._dic[chave]) {
        saida = s.replace(/^(\s*)([\s\S]*?)(\s*)$/, function (t, a, meio, b) {
          return a + Idioma.caixa(meio, Idioma._dic[chave]) + b;
        });
      } else if (Idioma._regex) {
        Idioma._regex.lastIndex = 0;
        saida = s.replace(Idioma._regex, function (tudo, antes, achado) {
          var v = Idioma._dic[Idioma.normalizar(achado)];
          return v ? antes + Idioma.caixa(achado, v) : tudo;
        });
      }
      Idioma._cache[s] = saida;
      return saida;
    },

    definir: function (novo, silencioso) {
      novo = (novo === 'en') ? 'en' : 'pt';
      if (novo === Idioma.atual && !silencioso) return;
      Idioma.atual = novo;
      Guardar.gravar('idioma', novo, !!cfg.idiomaCompartilhado);
      d.documentElement.setAttribute('lang', novo === 'en' ? 'en' : 'pt-BR');
      d.documentElement.setAttribute('data-dgo-idioma', novo);
      Varredura.tudo(true);
      atualizarSeletorIdioma();
      redesenharInterfaceDGO();
      if (typeof cfg.aoTrocarIdioma === 'function') { try { cfg.aoTrocarIdioma(novo); } catch (e) {} }
      d.dispatchEvent(new CustomEvent('dgo:idioma', { detail: { idioma: novo } }));
    }
  };

  function t(chave) {
    var v = UI[chave];
    if (!v) return chave;
    return Idioma.atual === 'en' ? v[1] : v[0];
  }

  /* ------------------------------------------------------------------
     5. DATAS   PT: 17/Set/2026    EN: Sep/17/2026
     ------------------------------------------------------------------ */
  function paraData(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') { var n = new Date(v); return isNaN(n.getTime()) ? null : n; }
    var s = texto(v).trim();
    var m;
    /* so a data pura vira meia-noite local; com hora junto, deixa o navegador ler */
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) return new Date(+m[3], +m[2] - 1, +m[1]);
    var n2 = new Date(s);
    return isNaN(n2.getTime()) ? null : n2;
  }

  function formatarData(v, idioma, comHora) {
    var dt = paraData(v);
    if (!dt) return texto(v);
    var li = idioma || Idioma.atual;
    var dia = ('0' + dt.getDate()).slice(-2);
    var mes = MES[li === 'en' ? 'en' : 'pt'][dt.getMonth()];
    var ano = dt.getFullYear();
    var base = (li === 'en') ? (mes + '/' + dia + '/' + ano) : (dia + '/' + mes + '/' + ano);
    if (comHora) {
      var hh = ('0' + dt.getHours()).slice(-2), mm = ('0' + dt.getMinutes()).slice(-2);
      base += (li === 'en') ? (' ' + (((dt.getHours() + 11) % 12) + 1) + ':' + mm + (dt.getHours() < 12 ? ' AM' : ' PM'))
                            : (' ' + hh + ':' + mm);
    }
    return base;
  }

  var RE_BARRA = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  var RE_ISO   = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  var RE_PRONTA_PT = null, RE_PRONTA_EN = null;
  (function () {
    var pt = MES.pt.join('|'), en = MES.en.join('|');
    RE_PRONTA_PT = new RegExp('\\b(\\d{1,2})/(' + pt + '|' + en + ')/(\\d{4})\\b', 'gi');
    RE_PRONTA_EN = new RegExp('\\b(' + pt + '|' + en + ')/(\\d{1,2})/(\\d{4})\\b', 'gi');
  })();

  function indiceMes(abrev) {
    var a = abrev.toLowerCase(), i;
    for (i = 0; i < 12; i++) {
      if (MES.pt[i].toLowerCase() === a || MES.en[i].toLowerCase() === a) return i;
    }
    return -1;
  }

  function reescreverDatas(s) {
    if (!cfg.datasAutomaticas || !s || s.indexOf('/') === -1 && s.indexOf('-') === -1) return s;
    var li = Idioma.atual;
    var saida = s.replace(RE_BARRA, function (tudo, a, b, ano) {
      var dia = +a, mes = +b;
      if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return tudo;
      return formatarData(new Date(+ano, mes - 1, dia), li);
    });
    saida = saida.replace(RE_ISO, function (tudo, ano, mes, dia) {
      if (+mes < 1 || +mes > 12 || +dia < 1 || +dia > 31) return tudo;
      return formatarData(new Date(+ano, +mes - 1, +dia), li);
    });
    saida = saida.replace(RE_PRONTA_PT, function (tudo, dia, abrev, ano) {
      var im = indiceMes(abrev);
      return im < 0 ? tudo : formatarData(new Date(+ano, im, +dia), li);
    });
    saida = saida.replace(RE_PRONTA_EN, function (tudo, abrev, dia, ano) {
      var im = indiceMes(abrev);
      return im < 0 ? tudo : formatarData(new Date(+ano, im, +dia), li);
    });
    return saida;
  }

  /* ------------------------------------------------------------------
     6. VARREDURA AUTOMATICA DO CONTEUDO
        Percorre a tela, traduz o que reconhece e ajusta as datas.
        Roda de novo sozinha sempre que a tela muda (update).
     ------------------------------------------------------------------ */
  var IGNORAR_TAG = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, KBD: 1, SAMP: 1, SVG: 1, CANVAS: 1, IFRAME: 1, OPTION: 0 };
  var ATRIBUTOS = ['placeholder', 'title', 'aria-label', 'alt'];

  function marcarIgnorados() {
    var sels = cfg.ignorar || [];
    if (!sels.length) return;
    sels.forEach(function (sel) {
      try {
        Array.prototype.forEach.call(d.querySelectorAll(sel), function (n) {
          if (!n.hasAttribute('data-dgo-ignorar')) n.setAttribute('data-dgo-ignorar', '');
        });
      } catch (e) {}
    });
  }

  var Varredura = {
    obs: null,
    mapa: (typeof WeakMap === 'function') ? new WeakMap() : null,
    pendente: false,

    ignorado: function (no) {
      var p = no;
      while (p && p !== d.body) {
        if (p.nodeType === 1) {
          var tag = p.tagName;
          if (IGNORAR_TAG[tag]) return true;
          if (p.hasAttribute && (p.hasAttribute('data-dgo-ignorar') || p.hasAttribute('data-dgo-ui'))) return true;
          if (p.isContentEditable) return true;
        }
        p = p.parentNode;
      }
      return false;
    },

    original: function (no, chave, valorAtual) {
      if (!Varredura.mapa) return valorAtual;
      var reg = Varredura.mapa.get(no);
      if (!reg) { reg = {}; Varredura.mapa.set(no, reg); }
      if (reg[chave] === undefined) reg[chave] = valorAtual;
      return reg[chave];
    },

    textoNo: function (no) {
      var atual = no.nodeValue;
      if (!atual || !/\S/.test(atual)) return;
      var orig = Varredura.original(no, '#texto', atual);
      var novo = reescreverDatas(Idioma.traduzir(orig));
      if (novo !== atual) no.nodeValue = novo;
    },

    elemento: function (e) {
      var i, a, atual, orig, novo;
      for (i = 0; i < ATRIBUTOS.length; i++) {
        a = ATRIBUTOS[i];
        if (!e.hasAttribute(a)) continue;
        atual = e.getAttribute(a);
        if (!atual || !/\S/.test(atual)) continue;
        orig = Varredura.original(e, a, atual);
        novo = reescreverDatas(Idioma.traduzir(orig));
        if (novo !== atual) e.setAttribute(a, novo);
      }
      if (e.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(e.type || '') && e.value) {
        orig = Varredura.original(e, '@value', e.value);
        novo = reescreverDatas(Idioma.traduzir(orig));
        if (novo !== e.value) e.value = novo;
      }
      /* <time datetime="2026-09-17"> vira a data no formato do idioma */
      if (e.tagName === 'TIME' && e.getAttribute('datetime')) {
        novo = formatarData(e.getAttribute('datetime'));
        if (e.textContent !== novo) e.textContent = novo;
      }
      /* qualquer elemento com data-data="2026-09-17" */
      if (e.hasAttribute('data-data')) {
        novo = formatarData(e.getAttribute('data-data'), null, e.hasAttribute('data-hora'));
        if (e.textContent !== novo) e.textContent = novo;
      }
      /* traducao dirigida:  data-pt="..." data-en="..." */
      if (e.hasAttribute('data-pt') || e.hasAttribute('data-en')) {
        novo = e.getAttribute('data-' + Idioma.atual);
        if (novo !== null && e.textContent !== novo) e.textContent = novo;
      }
    },

    ramo: function (raizNo) {
      if (!raizNo) return;
      if (raizNo.nodeType === 3) { if (!Varredura.ignorado(raizNo)) Varredura.textoNo(raizNo); return; }
      if (raizNo.nodeType !== 1 && raizNo.nodeType !== 9 && raizNo.nodeType !== 11) return;
      if (raizNo.nodeType === 1 && Varredura.ignorado(raizNo)) return;

      if (raizNo.nodeType === 1) Varredura.elemento(raizNo);
      var caminhador = d.createTreeWalker(raizNo, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: function (no) {
          if (no.nodeType === 1) {
            if (IGNORAR_TAG[no.tagName] || no.hasAttribute('data-dgo-ignorar') || no.hasAttribute('data-dgo-ui') || no.isContentEditable) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
          return /\S/.test(no.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      var no;
      while ((no = caminhador.nextNode())) {
        if (no.nodeType === 1) Varredura.elemento(no); else Varredura.textoNo(no);
      }
    },

    tudo: function () {
      if (!d.body) return;
      marcarIgnorados();
      try { Varredura.ramo(d.body); } catch (e) {}
      try {
        if (d.title) {
          var orig = Guardar._tituloOriginal || (Guardar._tituloOriginal = d.title);
          var novo = reescreverDatas(Idioma.traduzir(orig));
          if (d.title !== novo) d.title = novo;
        }
      } catch (e) {}
    },

    agendar: function (nos) {
      if (Varredura.pendente) return;
      Varredura.pendente = true;
      raiz.setTimeout(function () {
        Varredura.pendente = false;
        marcarIgnorados();
        if (cfg.niveis.ativo) { try { Niveis.revisar(); } catch (e) {} }
        if (nos && nos.length) { nos.forEach(function (n) { try { Varredura.ramo(n); } catch (e) {} }); }
        else Varredura.tudo();
      }, 16);
    },

    iniciar: function () {
      Varredura.tudo();
      if (!cfg.varreduraAutomatica || typeof MutationObserver !== 'function') return;
      Varredura.obs = new MutationObserver(function (lista) {
        var novos = [], i, m, j;
        for (i = 0; i < lista.length; i++) {
          m = lista[i];
          if (m.type === 'childList') {
            for (j = 0; j < m.addedNodes.length; j++) novos.push(m.addedNodes[j]);
          } else if (m.type === 'characterData') {
            novos.push(m.target);
          } else if (m.type === 'attributes') {
            novos.push(m.target);
          }
        }
        if (novos.length) Varredura.agendar(novos);
      });
      Varredura.obs.observe(d.body, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ATRIBUTOS.concat(['data-data', 'data-pt', 'data-en', 'datetime'])
      });
    }
  };

  /* ------------------------------------------------------------------
     7. SELETOR GLOBAL DE IDIOMA (sempre visivel)
     ------------------------------------------------------------------ */
  var seletorEl = null;

  /* o par PT | EN, para viver dentro da faixa do topo */
  function blocoIdioma() {
    var bPT = el('button', { type: 'button', 'aria-label': 'Português', texto: 'PT',
                             onclick: function () { Idioma.definir('pt'); } });
    var bEN = el('button', { type: 'button', 'aria-label': 'English', texto: 'EN',
                             onclick: function () { Idioma.definir('en'); } });
    seletorEl = el('div', { class: 'dgo-idioma dgo-na-faixa', role: 'group' }, [bPT, bEN]);
    seletorEl._pt = bPT; seletorEl._en = bEN;
    return seletorEl;
  }

  function montarSeletorIdioma() {
    if (!cfg.seletorIdiomaVisivel) return;
    if (cfg.posicaoSeletorIdioma === 'faixa' || !cfg.posicaoSeletorIdioma) return;  /* vai na faixa */
    if (seletorEl && seletorEl.parentNode === d.body) return;
    var pos = 'dgo-' + cfg.posicaoSeletorIdioma;
    var bPT = el('button', { type: 'button', 'aria-label': 'Portugues', texto: 'PT', onclick: function () { Idioma.definir('pt'); } });
    var bEN = el('button', { type: 'button', 'aria-label': 'English', texto: 'EN', onclick: function () { Idioma.definir('en'); } });
    seletorEl = el('div', { class: 'dgo-idioma dgo-flutua ' + pos, 'data-dgo-ui': '1', role: 'group' }, [bPT, bEN]);
    seletorEl._pt = bPT; seletorEl._en = bEN;
    d.body.appendChild(seletorEl);
    atualizarSeletorIdioma();
  }
  function atualizarSeletorIdioma() {
    if (!seletorEl || !seletorEl._pt) return;
    seletorEl._pt.className = Idioma.atual === 'pt' ? 'dgo-on' : '';
    seletorEl._en.className = Idioma.atual === 'en' ? 'dgo-on' : '';
  }

  /* ------------------------------------------------------------------
     8. BANNER DE ANUNCIO NO TOPO
        Fechavel durante a sessao; volta a aparecer no proximo login.
     ------------------------------------------------------------------ */
  var faixaEl = null;
  var bannerEl = null;          /* mantido por compatibilidade: aponta para a faixa */

  /* ------------------------------------------------------------------
     8-A. LISTA PADRAO DE ANUNCIOS  —  os proprios apps do hub
     Fonte: marceloneco.github.io (nome, frase, link e cor de cada card).
     O app que esta rodando nunca anuncia a si mesmo.
     Para trocar: anuncios.lista no config, ou um anuncios.json na raiz.
     ------------------------------------------------------------------ */
  var APPS_HUB = [
    { id: 'moneytrio', nome: 'MoneyTrio', cor: '#d6a076', glifo: '💰',
      link: 'https://marceloneco.github.io/investify-me/',
      frase: { pt: 'Finanças pessoais: BudgetONE, InvestifyONE e TaxONE',
               en: 'Personal finance: BudgetONE, InvestifyONE and TaxONE' } },
    { id: 'rise-one', nome: 'RiseONE', cor: '#beb0ec', glifo: '🏃',
      link: 'https://marceloneco.github.io/rise-one/',
      frase: { pt: 'Treino, corrida e dieta, com metas e evolução',
               en: 'Training, running and diet, with goals and progress' } },
    { id: 'omnilife-one', nome: 'OmniLifeONE', cor: '#e4a460', glifo: '🧩',
      link: 'https://marceloneco.github.io/omnilife-one/', selo: { pt: 'EM BREVE', en: 'SOON' },
      frase: { pt: 'A vida organizada em um só lugar', en: 'Life organized in one place' } },
    { id: 'planos-candidatos-2026', nome: 'Eleições 2026', cor: '#a4c4a6', glifo: '🗳️',
      link: 'https://marceloneco.github.io/planos-candidatos-2026/',
      frase: { pt: 'Dados públicos transformados em informação clara',
               en: 'Public data turned into clear information' } },
    { id: 'contador-de-historias', nome: 'Contador de Histórias', cor: '#96c0e8', glifo: '📖',
      link: 'https://marceloneco.github.io/contador-de-historias/',
      frase: { pt: 'Cria e narra histórias de dormir', en: 'Creates and narrates bedtime stories' } },
    { id: 'cifras-violao', nome: 'Cifras e Acordes', cor: '#eaa4b8', glifo: '🎸',
      link: 'https://marceloneco.github.io/cifras-violao/',
      frase: { pt: 'Cifras, troca de tom e dicionário de acordes',
               en: 'Chord charts, key change and chord dictionary' } }
  ];

  var Anuncios = {
    _lista: null,

    lista: function () {
      if (Anuncios._lista) return Anuncios._lista;
      var base = (cfg.anuncios.lista && cfg.anuncios.lista.length) ? cfg.anuncios.lista : APPS_HUB;
      Anuncios._lista = base.filter(function (a) { return a.id !== cfg.app; });
      return Anuncios._lista;
    },

    /* carrega de um anuncios.json na raiz, se existir */
    carregarArquivo: function () {
      if (!cfg.anuncios.arquivo) return Promise.resolve(false);
      return fetch(cfg.anuncios.arquivo, { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var lista = Array.isArray(j) ? j : (j && j.anuncios);
          if (!lista || !lista.length) return false;
          cfg.anuncios.lista = lista;
          Anuncios._lista = null;
          montarFaixa();
          return true;
        })
        .catch(function () { return false; });
    },

    frase: function (a) {
      if (!a.frase) return '';
      return (typeof a.frase === 'string') ? a.frase : (a.frase[Idioma.atual] || a.frase.pt || '');
    },
    selo: function (a) {
      if (!a.selo) return '';
      return (typeof a.selo === 'string') ? a.selo : (a.selo[Idioma.atual] || a.selo.pt || '');
    },
    botao: function (a) {
      var b = a.botao || cfg.anuncios.popup.botao;
      if (!b) return t('conhecer');
      return (typeof b === 'string') ? b : (b[Idioma.atual] || b.pt || t('conhecer'));
    },

    registrar: function (tipo, id) {
      try {
        var hoje = new Date().toISOString().slice(0, 10);
        var m = Guardar.ler('metricas-anuncio', {}, true) || {};
        if (!m[hoje]) m[hoje] = { exibicao: 0, clique: 0, por: {} };
        if (!m[hoje].por) m[hoje].por = {};
        m[hoje][tipo] = (m[hoje][tipo] || 0) + 1;
        if (id) {
          if (!m[hoje].por[id]) m[hoje].por[id] = { exibicao: 0, clique: 0 };
          m[hoje].por[id][tipo] = (m[hoje].por[id][tipo] || 0) + 1;
        }
        var dias = Object.keys(m).sort().slice(-60), limpo = {};
        dias.forEach(function (k) { limpo[k] = m[k]; });
        Guardar.gravar('metricas-anuncio', limpo, true);
      } catch (e) {}
    },

    totais: function () {
      var m = Guardar.ler('metricas-anuncio', {}, true) || {}, tot = { exibicao: 0, clique: 0, por: {} };
      Object.keys(m).forEach(function (k) {
        tot.exibicao += m[k].exibicao || 0;
        tot.clique += m[k].clique || 0;
        var por = m[k].por || {};
        Object.keys(por).forEach(function (id) {
          if (!tot.por[id]) tot.por[id] = { exibicao: 0, clique: 0 };
          tot.por[id].exibicao += por[id].exibicao || 0;
          tot.por[id].clique += por[id].clique || 0;
        });
      });
      return tot;
    }
  };

  /* o anuncio fica fechado so ate o fim da sessao (sessionStorage) */
  var FlagAnuncio = {
    chave: function () { return 'dgo:' + cfg.app + ':anuncio-fechado'; },
    fechado: function () { try { return raiz.sessionStorage.getItem(FlagAnuncio.chave()) === '1'; } catch (e) { return false; } },
    fechar: function () { try { raiz.sessionStorage.setItem(FlagAnuncio.chave(), '1'); } catch (e) {} },
    reabrir: function () { try { raiz.sessionStorage.removeItem(FlagAnuncio.chave()); } catch (e) {} }
  };

  function telaCheiaAberta() {
    var sels = (cfg.anuncios && cfg.anuncios.esconderCom) || [];
    if (!sels.length) return false;
    for (var i = 0; i < sels.length; i++) {
      var nos;
      try { nos = d.querySelectorAll(sels[i]); } catch (e) { continue; }
      for (var j = 0; j < nos.length; j++) {
        var n = nos[j];
        if (!n.getClientRects().length) continue;
        var st = raiz.getComputedStyle(n);
        if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
        return true;
      }
    }
    return false;
  }

  function vigiarTelaCheia() {
    if (!((cfg.anuncios && cfg.anuncios.esconderCom) || []).length) return;
    var anterior = telaCheiaAberta();
    setInterval(function () {
      if (d.hidden) return;
      var agora = telaCheiaAberta();
      if (agora !== anterior) { anterior = agora; montarFaixa(); }
    }, 450);
  }

  function semAnuncios() {
    /* so Premium fica livre de anuncio. Membro ve. O admin simulando um nivel
       ve o que aquele nivel veria — e para isso que o modo de teste existe. */
    if (Sessao.tipo === 'anunciante') return true;
    return Niveis.atual() === 'premium';
  }

  function deveMostrarAnuncio() {
    if (!cfg.anuncios.ativo) return false;
    if (semAnuncios()) return false;
    if (FlagAnuncio.fechado()) return false;
    if (!Anuncios.lista().length) return false;
    return true;
  }

  /* ------------------------------------------------------------------
     8-B. A FAIXA DO TOPO
     [ PT | EN ]  [ A N U N C I O ]  [ carrossel andando ]  [ x ]
     O seletor de idioma mora aqui dentro, e nao flutuando sobre a tela,
     para nunca cobrir o titulo nem os botoes do app.
     ------------------------------------------------------------------ */
  function cartaoAnuncio(a) {
    var pt = el('i', { class: 'dgo-pt', style: { background: a.cor || cfg.cor } });
    var nome = el('span', { class: 'dgo-nm' }, [pt, d.createTextNode(a.nome)]);
    var selo = Anuncios.selo(a);
    if (selo) nome.appendChild(el('em', { class: 'dgo-selo', texto: selo }));
    nome.appendChild(el('b', { class: 'dgo-seta', texto: '→' }));

    var icone = a.icone
      ? el('img', { class: 'dgo-ic', src: a.icone, alt: '', loading: 'lazy' })
      : el('span', { class: 'dgo-ic', style: { background: 'color-mix(in srgb, ' + (a.cor || cfg.cor) + ' 22%, #0b1220)',
                                               borderColor: a.cor || cfg.cor },
                     texto: a.glifo || '●' });

    return el('a', {
      class: 'dgo-card', href: a.link, target: '_blank', rel: 'noopener noreferrer',
      'aria-label': a.nome + ' — ' + Anuncios.frase(a),
      onclick: function () { Anuncios.registrar('clique', a.id); }
    }, [
      icone,
      el('span', { class: 'dgo-tx' }, [nome, el('span', { class: 'dgo-fr', texto: Anuncios.frase(a) })])
    ]);
  }

  function montarFaixa() {
    if (faixaEl && faixaEl.parentNode) faixaEl.parentNode.removeChild(faixaEl);
    faixaEl = null; bannerEl = null;

    var naFaixa = (cfg.posicaoSeletorIdioma === 'faixa' || !cfg.posicaoSeletorIdioma);
    var querIdioma = cfg.seletorIdiomaVisivel && naFaixa;
    var querIA = cfg.ia.ativo && cfg.ia.botaoNaFaixa !== false;
    var querAnuncio = deveMostrarAnuncio();
    var escondida = telaCheiaAberta();

    if (escondida || (!querIdioma && !querAnuncio && !querIA)) { ajustarTopo(0); return; }

    var filhos = [];

    if (querIdioma) filhos.push(blocoIdioma());

    if (cfg.ia.ativo && cfg.ia.botaoNaFaixa !== false) {
      filhos.push(el('button', {
        class: 'dgo-ia-bt', type: 'button', title: t('perguntarIA'), 'aria-label': t('perguntarIA'),
        texto: '\u2728', onclick: function () { abrirIA(); }
      }));
    }

    if (querAnuncio) {
      var rot = cfg.anuncios.rotulo;
      var rotulo = (rot && (rot[Idioma.atual] || rot.pt)) || t('anuncioRotulo');
      filhos.push(el('span', { class: 'dgo-rot', 'aria-hidden': 'true', texto: rotulo }));

      var lista = Anuncios.lista();
      var trilho = el('div', { class: 'dgo-trilho' });
      /* duas voltas do mesmo conteudo: o laco fica sem costura */
      [0, 1].forEach(function (volta) {
        lista.forEach(function (a) {
          var c = cartaoAnuncio(a);
          if (volta === 1) c.setAttribute('aria-hidden', 'true');
          trilho.appendChild(c);
        });
      });
      var segundos = Math.max(12, (cfg.anuncios.velocidade || 9) * lista.length);
      trilho.style.animationDuration = segundos + 's';
      if (raiz.matchMedia && raiz.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        trilho.style.animation = 'none';
      }
      var janela = el('div', { class: 'dgo-carrossel', role: 'complementary',
                               'aria-label': rotulo }, [trilho]);
      filhos.push(janela);

      filhos.push(el('button', {
        class: 'dgo-x', type: 'button', 'aria-label': t('fecharAnuncio'), title: t('fecharAnuncio'),
        texto: '×', onclick: function () { FlagAnuncio.fechar(); montarFaixa(); }
      }));
    }

    faixaEl = el('div', { class: 'dgo-faixa' + (querAnuncio ? '' : ' dgo-fina'), 'data-dgo-ui': '1' }, filhos);
    bannerEl = faixaEl;
    d.body.insertBefore(faixaEl, d.body.firstChild);

    if (querAnuncio && !montarFaixa._contou) {
      montarFaixa._contou = true;
      Anuncios.lista().forEach(function (a) { Anuncios.registrar('exibicao', a.id); });
    }
    atualizarSeletorIdioma();
    raiz.setTimeout(function () { ajustarTopo(faixaEl ? faixaEl.offsetHeight : 0); }, 30);
  }

  /* compatibilidade com o nome antigo */
  function montarBanner() { montarFaixa(); }

  function ajustarTopo(altura) {
    d.documentElement.style.setProperty('--dgo-topo', altura + 'px');
    if (cfg.empurrarConteudo && d.body) {
      if (d.body.dataset.dgoPadOriginal === undefined) {
        d.body.dataset.dgoPadOriginal = raiz.getComputedStyle(d.body).paddingTop || '0px';
      }
      var base = parseFloat(d.body.dataset.dgoPadOriginal) || 0;
      d.body.style.paddingTop = (base + altura) + 'px';
    }
    (cfg.seletoresTopoFixo || []).forEach(function (sel) {
      Array.prototype.forEach.call(d.querySelectorAll(sel), function (n) {
        n.style.top = 'calc(' + altura + 'px + ' + (n.dataset.dgoTopoOriginal || '0px') + ')';
      });
    });
  }

  /* ------------------------------------------------------------------
     8-C. POP-UP DE ANUNCIO
     Aparece na area logada, sorteando um app por vez, com espera antes
     do X. Nunca para quem nao ve anuncios, nunca sobre uma tela cheia.
     ------------------------------------------------------------------ */
  var Popup = {
    _timer: null,

    momento: function () { return Sessao.tipo ? 'depois' : 'antes'; },

    podeMostrar: function (momento) {
      var p = cfg.anuncios.popup || {};
      momento = momento || Popup.momento();
      if (!cfg.anuncios.ativo || !p.ativo) return false;
      if (momento === 'antes' && p.antesDoLogin === false) return false;
      if (momento === 'depois' && p.depoisDoLogin === false) return false;
      if (semAnuncios()) return false;
      if (telaCheiaAberta()) return false;
      if (modalEl) return false;                      /* nao atropela login/configuracoes */
      if (!Anuncios.lista().length) return false;
      if (p.umaVezPorSessao !== false) {
        try { if (raiz.sessionStorage.getItem('dgo:' + cfg.app + ':popup:' + momento) === '1') return false; } catch (e) {}
      }
      if (p.intervaloHoras) {
        var ultimo = Guardar.ler('popup-em', 0, true);
        if (ultimo && (Date.now() - ultimo) < p.intervaloHoras * 3600000) return false;
      }
      return true;
    },

    sortear: function () {
      var lista = Anuncios.lista();
      if (lista.length === 1) return lista[0];
      var anterior = Guardar.ler('popup-ultimo', '', true);
      var candidatos = lista.filter(function (a) { return a.id !== anterior; });
      if (!candidatos.length) candidatos = lista;
      return candidatos[Math.floor(Math.random() * candidatos.length)];
    },

    agendar: function (momento) {
      var p = cfg.anuncios.popup || {};
      momento = momento || Popup.momento();
      var atraso = 1000 * (momento === 'antes'
        ? (p.atrasoAntesDoLogin === undefined ? 5 : p.atrasoAntesDoLogin)
        : (p.atrasoAbertura === undefined ? 8 : p.atrasoAbertura));
      if (Popup._timer) clearTimeout(Popup._timer);
      Popup._timer = setTimeout(function () {
        if (Popup.podeMostrar(momento)) { Popup.abrir(null, momento); return; }
        /* se havia uma janela aberta na hora, tenta de novo daqui a pouco */
        if (modalEl || telaCheiaAberta()) {
          Popup._timer = setTimeout(function esperar() {
            if (Popup.podeMostrar(momento)) Popup.abrir(null, momento);
            else if (modalEl || telaCheiaAberta()) Popup._timer = setTimeout(esperar, 4000);
          }, 4000);
        }
      }, Math.max(0, atraso));
    },

    abrir: function (anuncio, momento) {
      var a = anuncio || Popup.sortear();
      if (!a) return null;
      var p = cfg.anuncios.popup || {};
      var espera = (p.esperaSegundos === undefined ? 3 : p.esperaSegundos);
      momento = momento || Popup.momento();

      try { raiz.sessionStorage.setItem('dgo:' + cfg.app + ':popup:' + momento, '1'); } catch (e) {}
      Guardar.gravar('popup-em', Date.now(), true);
      Guardar.gravar('popup-ultimo', a.id, true);
      Anuncios.registrar('exibicao', a.id);

      var fecharBt = el('button', {
        class: 'dgo-pop-x', type: 'button', disabled: '', 'aria-label': t('fechar'),
        texto: String(espera)
      });
      var cor = a.cor || cfg.cor;
      var icone = a.icone
        ? el('img', { class: 'dgo-pop-ic', src: a.icone, alt: '' })
        : el('div', { class: 'dgo-pop-ic', style: { borderColor: cor,
              background: 'color-mix(in srgb, ' + cor + ' 20%, #0b1220)' }, texto: a.glifo || '●' });

      var rotuloTxt = (cfg.anuncios.rotulo &&
            (cfg.anuncios.rotulo[Idioma.atual] || cfg.anuncios.rotulo.pt)) || t('anuncioRotulo');
      var selo = Anuncios.selo(a);

      var arte = el('div', { class: 'dgo-pop-arte' }, [
        el('div', { class: 'dgo-pop-halo' }),
        icone
      ]);

      var corpo = el('div', { class: 'dgo-pop-corpo' }, [
        el('div', { class: 'dgo-pop-rot dgo-pop-rot-topo', texto: rotuloTxt }),
        el('div', { class: 'dgo-pop-nome' }, [
          d.createTextNode(a.nome),
          selo ? el('em', { class: 'dgo-selo', texto: selo }) : null
        ]),
        el('div', { class: 'dgo-pop-frase', texto: Anuncios.frase(a) }),
        el('a', {
          class: 'dgo-pop-bt', href: a.link, target: '_blank', rel: 'noopener noreferrer',
          onclick: function () { Anuncios.registrar('clique', a.id); }
        }, [d.createTextNode(Anuncios.botao(a)), el('span', { class: 'dgo-pop-seta', texto: '\u2192' })]),
        el('div', { class: 'dgo-pop-rot dgo-pop-rot-baixo', texto: rotuloTxt })
      ]);

      var caixa = el('div', { class: 'dgo-pop' }, [arte, corpo]);
      caixa.style.setProperty('--c', cor);
      caixa.style.setProperty('--c-suave', corSuave(cor, 0.22));
      caixa.style.setProperty('--c-fraca', corSuave(cor, 0.10));

      var envelope = el('div', { class: 'dgo-pop-env' }, [caixa, fecharBt]);
      var fundo = el('div', { class: 'dgo-pop-fundo', 'data-dgo-ui': '1', role: 'dialog',
                              'aria-modal': 'true' }, [envelope]);
      d.body.appendChild(fundo);

      var resta = espera;
      var conta = setInterval(function () {
        resta--;
        if (resta > 0) { fecharBt.textContent = String(resta); return; }
        clearInterval(conta);
        fecharBt.removeAttribute('disabled');
        fecharBt.textContent = '×';
        fecharBt.classList.add('dgo-pronto');
      }, 1000);

      function fechar() {
        clearInterval(conta);
        if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
        d.removeEventListener('keydown', porTecla);
      }
      function porTecla(e) { if (e.key === 'Escape' && !fecharBt.disabled) fechar(); }
      fecharBt.addEventListener('click', function () { if (!fecharBt.disabled) fechar(); });
      fundo.addEventListener('click', function (e) { if (e.target === fundo && !fecharBt.disabled) fechar(); });
      d.addEventListener('keydown', porTecla);
      return fundo;
    }
  };

  /* ------------------------------------------------------------------
     9. ACESSO: VISITANTE, ASSINANTE (pagante) E ANUNCIANTE
     ------------------------------------------------------------------
     Visitante  -> sem senha, nada pessoal fica guardado, com anuncios
     Assinante  -> entra com senha, dados guardados, sem anuncios
     Anunciante -> area propria para acompanhar campanhas
     ------------------------------------------------------------------
     Observacao honesta: um site no GitHub Pages nao tem servidor, entao a
     conferencia da senha acontece dentro do proprio aparelho. Isso serve
     para separar perfis e proteger a tela, mas nao substitui um servidor.
     Quando houver um, basta ligar o adaptador:  DGO.auth.backend = {...}
     que todo o resto do app continua igual.
     ------------------------------------------------------------------ */

  function bytesParaB64(buf) {
    var b = new Uint8Array(buf), s = '', i;
    for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return raiz.btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64ParaBytes(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = raiz.atob(s), b = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  function aleatorio(n) {
    var b = new Uint8Array(n || 16);
    if (raiz.crypto && raiz.crypto.getRandomValues) raiz.crypto.getRandomValues(b);
    else for (var i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }
  var temCripto = !!(raiz.crypto && raiz.crypto.subtle && raiz.crypto.subtle.importKey);

  function derivarSenha(senha, saltB64) {
    var salt = saltB64 ? b64ParaBytes(saltB64) : aleatorio(16);
    if (!temCripto) {                       // so acontece abrindo o arquivo local (file://)
      var h = 5381, txt = bytesParaB64(salt) + '|' + senha, i;
      for (i = 0; i < txt.length; i++) h = ((h * 33) ^ txt.charCodeAt(i)) >>> 0;
      return Promise.resolve({ salt: bytesParaB64(salt), hash: 'simples:' + h.toString(16) });
    }
    var enc = new TextEncoder();
    return raiz.crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) {
        return raiz.crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' }, k, 256);
      })
      .then(function (bits) { return { salt: bytesParaB64(salt), hash: bytesParaB64(bits) }; });
  }

  /* alfabeto do codigo de recuperacao: sem 0/O e 1/I, para nao confundir na hora de digitar */
  var ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function gerarCodigo() {
    var b = aleatorio(12), saida = '', i;
    for (i = 0; i < 12; i++) {
      saida += ALFABETO[b[i] % ALFABETO.length];
      if (i === 3 || i === 7) saida += '-';
    }
    return saida;                       // ex.: ABCD-EF23-GH45
  }
  function emailValido(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim()); }
  function apelidoValido(a) { return /^[A-Za-z0-9._-]{3,}$/.test(String(a || '').trim()); }

  var Contas = {
    chave: function () { return 'dgo:' + cfg.app + ':conta:lista'; },
    todas: function () {
      try { return JSON.parse(raiz.localStorage.getItem(Contas.chave()) || '{}'); }
      catch (e) { return {}; }
    },
    gravarTodas: function (o) {
      try { raiz.localStorage.setItem(Contas.chave(), JSON.stringify(o)); } catch (e) {}
    },

    /* aceita o e-mail OU o apelido */
    achar: function (identificador) {
      var id = String(identificador || '').trim().toLowerCase();
      if (!id) return null;
      var lista = Contas.todas();
      if (lista[id]) return lista[id];
      var k;
      for (k in lista) {
        if (Object.prototype.hasOwnProperty.call(lista, k) &&
            String(lista[k].apelido || '').toLowerCase() === id) return lista[k];
      }
      return null;
    },

    apelidoLivre: function (apelido) {
      var a = String(apelido || '').trim().toLowerCase(), lista = Contas.todas(), k;
      for (k in lista) {
        if (Object.prototype.hasOwnProperty.call(lista, k) &&
            String(lista[k].apelido || '').toLowerCase() === a) return false;
      }
      return true;
    },

    /* criar({ apelido, email, senha, tipo }) -> { conta, codigo } */
    criar: function (dados) {
      dados = dados || {};
      var email = String(dados.email || '').trim().toLowerCase();
      var apelido = String(dados.apelido || '').trim();
      var lista = Contas.todas();
      if (cfg.login.exigirApelido && !apelidoValido(apelido)) return Promise.reject(new Error('apelido-curto'));
      if (!emailValido(email)) return Promise.reject(new Error('email-invalido'));
      if (lista[email]) return Promise.reject(new Error('existe'));
      if (apelido && !Contas.apelidoLivre(apelido)) return Promise.reject(new Error('apelido-em-uso'));
      if (String(dados.senha || '').length < 6) return Promise.reject(new Error('senha-curta'));

      var codigo = gerarCodigo();
      return derivarSenha(dados.senha).then(function (rs) {
        return derivarSenha(codigo.replace(/-/g, '')).then(function (rc) {
          lista[email] = {
            email: email,
            apelido: apelido || email.split('@')[0],
            nome: apelido || email.split('@')[0],
            tipo: dados.tipo || 'pagante',
            salt: rs.salt, hash: rs.hash,
            recSalt: rc.salt, recHash: rc.hash,
            criadaEm: new Date().toISOString()
          };
          Contas.gravarTodas(lista);
          return { conta: lista[email], codigo: codigo };
        });
      });
    },

    conferir: function (identificador, senha) {
      var c = Contas.achar(identificador);
      if (!c) return Promise.reject(new Error('sem-conta'));
      return derivarSenha(senha, c.salt).then(function (r) {
        if (r.hash !== c.hash) throw new Error('errado');
        return c;
      });
    },

    /* troca a senha sabendo a senha atual */
    trocarSenha: function (identificador, senhaAtual, nova) {
      if (String(nova || '').length < 6) return Promise.reject(new Error('senha-curta'));
      return Contas.conferir(identificador, senhaAtual).then(function (c) {
        return derivarSenha(nova).then(function (r) {
          var lista = Contas.todas();
          lista[c.email].salt = r.salt; lista[c.email].hash = r.hash;
          lista[c.email].senhaTrocadaEm = new Date().toISOString();
          Contas.gravarTodas(lista);
          return lista[c.email];
        });
      });
    },

    /* troca a senha com o codigo de recuperacao (funciona sem servidor) */
    redefinirComCodigo: function (identificador, codigo, nova) {
      var c = Contas.achar(identificador);
      if (!c) return Promise.reject(new Error('sem-conta'));
      if (!c.recHash) return Promise.reject(new Error('sem-codigo'));
      if (String(nova || '').length < 6) return Promise.reject(new Error('senha-curta'));
      var limpo = String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      return derivarSenha(limpo, c.recSalt).then(function (r) {
        if (r.hash !== c.recHash) throw new Error('codigo-errado');
        return derivarSenha(nova).then(function (rs) {
          var novoCodigo = gerarCodigo();
          return derivarSenha(novoCodigo.replace(/-/g, '')).then(function (rc) {
            var lista = Contas.todas();
            lista[c.email].salt = rs.salt;   lista[c.email].hash = rs.hash;
            lista[c.email].recSalt = rc.salt; lista[c.email].recHash = rc.hash;
            lista[c.email].senhaTrocadaEm = new Date().toISOString();
            Contas.gravarTodas(lista);
            return { conta: lista[c.email], codigo: novoCodigo };   // codigo novo, o antigo nao vale mais
          });
        });
      });
    },

    apagar: function (identificador) {
      var c = Contas.achar(identificador);
      if (!c) return false;
      var lista = Contas.todas();
      delete lista[c.email];
      Contas.gravarTodas(lista);
      return true;
    }
  };

  /* ---------------- envio de e-mail ----------------
     Um site no GitHub Pages nao envia e-mail sozinho: nao existe servidor
     para isso. Entao ha dois caminhos que funcionam hoje:
       1) um servico de formulario (Formspree e parecidos): o navegador manda
          o conteudo para o servico, e o servico manda o e-mail para voce;
       2) abrir o programa de e-mail da pessoa, com o texto ja escrito.
     Os dois estao aqui. Enviar e-mail automatico para OUTRAS pessoas (como um
     link de redefinicao de senha) precisa de servidor - veja o passo a passo. */
  var Email = {
    configurado: function () { return !!cfg.email.formulario; },

    enviarFormulario: function (dados) {
      dados = dados || {};
      if (!cfg.email.formulario) return Promise.reject(new Error('sem-formulario'));
      var corpo = {
        app: cfg.app,
        assunto: dados.assunto || cfg.email.assuntoPadrao || nomeApp(),
        mensagem: dados.mensagem || '',
        email: dados.responderPara || '',
        idioma: Idioma.atual,
        em: new Date().toISOString()
      };
      if (dados.extra) corpo.extra = dados.extra;
      return fetch(cfg.email.formulario, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(corpo)
      }).then(function (r) {
        if (!r.ok) throw new Error('falha-envio');
        return true;
      });
    },

    abrirCliente: function (dados) {
      dados = dados || {};
      var para = dados.para || cfg.email.deAvisos || '';
      var url = 'mailto:' + encodeURIComponent(para) +
        '?subject=' + encodeURIComponent(dados.assunto || nomeApp()) +
        '&body=' + encodeURIComponent(dados.mensagem || '');
      try { raiz.location.href = url; return true; } catch (e) { return false; }
    }
  };

  var Sessao = {
    tipo: null,          // 'visitante' | 'pagante' | 'anunciante'
    usuario: null,
    backend: null,       // adaptador para quando existir servidor

    carregar: function () {
      var s = null;
      try { s = JSON.parse(raiz.localStorage.getItem('dgo:' + cfg.app + ':sessao') || 'null'); } catch (e) {}
      if (!s) { try { s = JSON.parse(raiz.sessionStorage.getItem('dgo:' + cfg.app + ':sessao') || 'null'); } catch (e) {} }
      if (s && s.tipo) { Sessao.tipo = s.tipo; Sessao.usuario = s.usuario || null; }
      return Sessao;
    },

    gravar: function () {
      var s = JSON.stringify({ tipo: Sessao.tipo, usuario: Sessao.usuario });
      try {
        if (Sessao.tipo === 'visitante') {
          raiz.localStorage.removeItem('dgo:' + cfg.app + ':sessao');
          raiz.sessionStorage.setItem('dgo:' + cfg.app + ':sessao', s);
        } else {
          raiz.sessionStorage.removeItem('dgo:' + cfg.app + ':sessao');
          raiz.localStorage.setItem('dgo:' + cfg.app + ':sessao', s);
        }
      } catch (e) {}
    },

    entrar: function (tipo, usuario) {
      Sessao.tipo = tipo;
      Sessao.usuario = usuario || null;
      Sessao.gravar();
      /* a cada novo login o anuncio volta a aparecer */
      FlagAnuncio.reabrir();
      montarFaixa._contou = false;
      montarFaixa();
      Niveis.revisar();
      montarBarraAdmin();
      Popup.agendar('depois');
      redesenharInterfaceDGO();
      if (typeof cfg.aoEntrar === 'function') { try { cfg.aoEntrar(Sessao.resumo()); } catch (e) {} }
      d.dispatchEvent(new CustomEvent('dgo:entrou', { detail: Sessao.resumo() }));
      return Sessao.resumo();
    },

    sair: function () {
      var eraVisitante = Sessao.tipo === 'visitante';
      if (eraVisitante) Guardar.limparPessoais();   // visitante nao deixa rastro
      try {
        raiz.localStorage.removeItem('dgo:' + cfg.app + ':sessao');
        raiz.sessionStorage.removeItem('dgo:' + cfg.app + ':sessao');
      } catch (e) {}
      Sessao.tipo = null; Sessao.usuario = null;
      Guardar.apagar('admin-simular');
      montarBanner();
      Niveis.revisar();
      montarBarraAdmin();
      redesenharInterfaceDGO();
      if (typeof cfg.aoSair === 'function') { try { cfg.aoSair(); } catch (e) {} }
      d.dispatchEvent(new CustomEvent('dgo:saiu', {}));
    },

    resumo: function () {
      return {
        tipo: Sessao.tipo,
        nivel: (typeof Niveis !== 'undefined') ? Niveis.atual() : 'visitante',
        usuario: Sessao.usuario,
        semAnuncios: semAnuncios(),
        guardaDados: Sessao.tipo !== 'visitante' && Sessao.tipo !== null
      };
    }
  };

  /* ------------------------------------------------------------------
     9-B. NIVEIS DE ACESSO:  Visitante -> Membro -> Premium
     ------------------------------------------------------------------
     Uma funcao so responde "esta pessoa pode usar este servico?".
     Hoje ela olha o arquivo de configuracao e o nivel local. Quando
     existir servidor, ela passa a perguntar para ele (DGO.niveis.backend)
     e NADA MAIS no app muda.
     ------------------------------------------------------------------ */
  var ORDEM = { visitante: 0, membro: 1, premium: 2 };

  var Niveis = {
    backend: null,
    _servicos: null,

    /* o nivel efetivo de quem esta usando, respeitando a simulacao do admin */
    atual: function () {
      var fingido = Guardar.ler('admin-simular', null);
      if (fingido && Sessao.tipo === 'admin') return fingido;
      switch (Sessao.tipo) {
        case 'premium': return 'premium';
        case 'admin': return 'premium';
        case 'pagante': return 'membro';      /* nome antigo */
        case 'membro': return 'membro';
        case 'anunciante': return 'membro';
        default: return 'visitante';
      }
    },

    ehAdmin: function () { return Sessao.tipo === 'admin'; },

    servicos: function () {
      if (Niveis._servicos) return Niveis._servicos;
      var guardado = Guardar.ler('servicos', null, false);
      var base = (cfg.niveis.servicos || []).map(function (s) {
        var copia = {};
        for (var k in s) copia[k] = s[k];
        if (guardado && guardado[s.id]) copia.nivel = guardado[s.id];
        return copia;
      });
      Niveis._servicos = base;
      return base;
    },

    servico: function (id) {
      var l = Niveis.servicos(), i;
      for (i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
      return null;
    },

    nivelDoServico: function (id) {
      var s = Niveis.servico(id);
      return (s && s.nivel) || cfg.niveis.padraoServico || 'visitante';
    },

    definirNivelDoServico: function (id, nivel) {
      var s = Niveis.servico(id);
      if (s) s.nivel = nivel;
      var guardado = Guardar.ler('servicos', {}, false) || {};
      guardado[id] = nivel;
      Guardar.gravar('servicos', guardado, false);
      d.dispatchEvent(new CustomEvent('dgo:niveis', { detail: { servico: id, nivel: nivel } }));
    },

    /* carrega servicos.json da raiz, se existir — e a fonte da verdade */
    carregarArquivo: function () {
      if (!cfg.niveis.arquivo) return Promise.resolve(false);
      return fetch(cfg.niveis.arquivo, { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var lista = Array.isArray(j) ? j : (j && j.servicos);
          if (!lista || !lista.length) return false;
          cfg.niveis.servicos = lista;
          Niveis._servicos = null;
          d.dispatchEvent(new CustomEvent('dgo:niveis', { detail: { origem: 'arquivo' } }));
          return true;
        })
        .catch(function () { return false; });
    },

    /* A PERGUNTA UNICA */
    pode: function (idServico) {
      if (!cfg.niveis.ativo) return true;
      if (Niveis.backend && typeof Niveis.backend.pode === 'function') {
        try { return !!Niveis.backend.pode(idServico, Niveis.atual()); } catch (e) {}
      }
      var exigido = Niveis.nivelDoServico(idServico);
      return (ORDEM[Niveis.atual()] || 0) >= (ORDEM[exigido] || 0);
    },

    /* roda a acao se puder; se nao, mostra o convite certo */
    exigir: function (idServico, acao, opcoes) {
      if (Niveis.pode(idServico)) {
        if (typeof acao === 'function') acao();
        return true;
      }
      Niveis.convite(idServico, opcoes);
      return false;
    },

    rotulo: function (nivel) {
      return nivel === 'premium' ? t('premium') : nivel === 'membro' ? t('membro') : t('visitante');
    },

    /* o aviso de bloqueio: cartao no celular, janela no computador */
    convite: function (idServico, opcoes) {
      opcoes = opcoes || {};
      var s = Niveis.servico(idServico) || {};
      var exigido = Niveis.nivelDoServico(idServico);
      var nome = s.nome ? (s.nome[Idioma.atual] || s.nome.pt) : (opcoes.nome || idServico);
      var desc = s.descricao ? (s.descricao[Idioma.atual] || s.descricao.pt) : '';

      var caixa = el('div', { class: 'dgo-caixa', style: { maxWidth: '380px' } });
      caixa.appendChild(el('div', { class: 'dgo-cadeado', texto: '🔒' }));
      caixa.appendChild(el('h2', { texto: nome }));
      if (desc) caixa.appendChild(el('p', { texto: desc }));
      caixa.appendChild(aviso(
        exigido === 'premium' ? t('sohPremium') : t('sohMembro'), 'info'));

      if (exigido === 'membro' && !Sessao.tipo) {
        caixa.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('criarConta'),
          onclick: function () { fecharModal(); abrirLogin('pagante'); } }));
      } else if (exigido === 'premium') {
        caixa.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('virarPremium'),
          onclick: function () {
            fecharModal();
            if (typeof cfg.niveis.aoQuererPremium === 'function') cfg.niveis.aoQuererPremium(idServico);
            else abrirComoVirarPremium();
          } }));
      }
      caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('entendi'),
        onclick: fecharModal }));
      return abrirModal(caixa);
    },

    /* marca de agua discreta nos botoes bloqueados */
    marcar: function (seletorOuNo, idServico) {
      var nos = (typeof seletorOuNo === 'string') ? d.querySelectorAll(seletorOuNo) : [seletorOuNo];
      Array.prototype.forEach.call(nos, function (n) {
        if (!n) return;
        var liberado = Niveis.pode(idServico);
        n.classList.toggle('dgo-bloqueado', !liberado);
        if (!liberado) {
          n.setAttribute('data-dgo-servico', idServico);
          n.setAttribute('title', t('sohPremium'));
        } else {
          n.removeAttribute('data-dgo-servico');
        }
      });
    },

    /* passa por todos os elementos com data-servico="..." e marca */
    revisar: function () {
      Array.prototype.forEach.call(d.querySelectorAll('[data-servico]'), function (n) {
        Niveis.marcar(n, n.getAttribute('data-servico'));
      });
    }
  };

  function abrirComoVirarPremium() {
    var caixa = el('div', { class: 'dgo-caixa', style: { maxWidth: '380px' } });
    caixa.appendChild(el('h2', { texto: t('virarPremium') }));
    caixa.appendChild(aviso(t('premiumSemCobranca'), 'info'));
    if (cfg.email.formulario) {
      var cE = campo(t('email'), { type: 'email', inputmode: 'email' });
      caixa.appendChild(cE);
      var msg = el('div');
      caixa.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('enviarPedido'),
        onclick: function () {
          var b = this; b.disabled = true;
          Email.enviarFormulario({ assunto: t('virarPremium') + ' - ' + nomeApp(),
                                   mensagem: t('virarPremium'), responderPara: cE._input.value.trim() })
            .then(function () { msg.innerHTML = ''; msg.appendChild(aviso(t('pedidoEnviado'), 'ok')); })
            .catch(function () { msg.innerHTML = ''; msg.appendChild(aviso(t('pedidoFalhou'), 'erro')); })
            .then(function () { b.disabled = false; });
        } }));
      caixa.appendChild(msg);
    }
    caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('fechar'), onclick: fecharModal }));
    return abrirModal(caixa);
  }

  /* ---------------- painel do administrador ---------------- */
  function abrirAdmin() {
    if (!Niveis.ehAdmin()) { abrirLogin('admin'); return null; }

    function montar() {
      var caixa = el('div', { class: 'dgo-caixa dgo-larga' });
      caixa.appendChild(el('h2', { texto: t('painelAdmin') }));
      caixa.appendChild(aviso(t('adminNaoEhSeguranca'), 'info'));

      /* ver o app como... */
      caixa.appendChild(el('h3', { texto: t('verComo') }));
      var atual = Guardar.ler('admin-simular', null) || 'premium';
      var linha = el('div', { class: 'dgo-linha' });
      ['visitante', 'membro', 'premium'].forEach(function (n) {
        linha.appendChild(el('button', {
          class: 'dgo-b' + (atual === n ? '' : ' dgo-b2'), type: 'button', texto: Niveis.rotulo(n),
          onclick: function () {
            Guardar.gravar('admin-simular', n);
            montarFaixa(); Niveis.revisar(); montarBarraAdmin();
            abrirAdmin();
          }
        }));
      });
      caixa.appendChild(linha);

      /* servicos */
      caixa.appendChild(el('h3', { texto: t('servicos') }));
      var lista = Niveis.servicos();
      if (!lista.length) caixa.appendChild(aviso(t('semServicos'), 'info'));
      lista.forEach(function (s) {
        var nome = s.nome ? (s.nome[Idioma.atual] || s.nome.pt) : s.id;
        var desc = s.descricao ? (s.descricao[Idioma.atual] || s.descricao.pt) : '';
        var sel = el('select');
        [['visitante', t('visitante')], ['membro', t('membro')], ['premium', t('premium')]].forEach(function (p) {
          var o = el('option', { value: p[0], texto: p[1] });
          if (Niveis.nivelDoServico(s.id) === p[0]) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener('change', function () {
          Niveis.definirNivelDoServico(s.id, sel.value);
          Niveis.revisar();
        });
        caixa.appendChild(el('div', {
          style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '9px 0',
                   borderBottom: '1px solid rgba(255,255,255,.08)' }
        }, [
          el('div', { style: { flex: '1', minWidth: '0' } }, [
            el('div', { style: { color: '#e2e8f0', fontSize: '14px', fontWeight: '600' }, texto: nome }),
            desc ? el('div', { class: 'dgo-mini', texto: desc }) : null
          ]),
          el('div', { style: { flex: '0 0 auto', width: '130px' } }, [sel])
        ]));
      });

      /* exportar servicos.json */
      caixa.appendChild(el('div', { class: 'dgo-sep' }));
      caixa.appendChild(el('button', {
        class: 'dgo-b', type: 'button', texto: t('baixarServicos'),
        onclick: function () {
          Nuvem.salvarArquivo({ servicos: Niveis.servicos() }, cfg.niveis.arquivo || 'servicos.json');
        }
      }));
      caixa.appendChild(el('div', { class: 'dgo-mini', texto: t('servicosComoSubir') }));

      /* contas */
      var contas = Contas.todas();
      var emails = Object.keys(contas);
      if (emails.length) {
        caixa.appendChild(el('h3', { texto: t('contas') }));
        emails.forEach(function (e) {
          var c = contas[e];
          var selC = el('select');
          [['visitante', t('visitante')], ['pagante', t('membro')], ['premium', t('premium')],
           ['anunciante', t('anunciante')], ['admin', t('admin')]].forEach(function (p) {
            var o = el('option', { value: p[0], texto: p[1] });
            if ((c.tipo || 'pagante') === p[0]) o.selected = true;
            selC.appendChild(o);
          });
          selC.addEventListener('change', function () {
            var todas = Contas.todas();
            todas[e].tipo = selC.value;
            Contas.gravarTodas(todas);
          });
          caixa.appendChild(el('div', {
            style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '7px 0',
                     borderBottom: '1px solid rgba(255,255,255,.08)' }
          }, [
            el('div', { style: { flex: '1', minWidth: '0' } }, [
              el('div', { style: { color: '#e2e8f0', fontSize: '13.5px' }, texto: c.apelido || e }),
              el('div', { class: 'dgo-mini', texto: e })
            ]),
            el('div', { style: { flex: '0 0 auto', width: '130px' } }, [selC])
          ]));
        });
      }

      caixa.appendChild(el('div', { class: 'dgo-sep' }));
      caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('fechar'), onclick: fecharModal }));
      return caixa;
    }
    return abrirModal(montar(), abrirAdmin);
  }

  /* faixa de aviso quando o admin esta simulando um nivel */
  var barraAdminEl = null;
  function montarBarraAdmin() {
    if (barraAdminEl && barraAdminEl.parentNode) barraAdminEl.parentNode.removeChild(barraAdminEl);
    barraAdminEl = null;
    if (!Niveis.ehAdmin()) return;
    var fingido = Guardar.ler('admin-simular', null);
    if (!fingido) return;
    barraAdminEl = el('div', { class: 'dgo-admin-barra', 'data-dgo-ui': '1' }, [
      el('span', { texto: t('modoTeste') + ': ' + Niveis.rotulo(fingido) }),
      el('button', { type: 'button', texto: t('sairDoTeste'), onclick: function () {
        Guardar.apagar('admin-simular');
        montarFaixa(); Niveis.revisar(); montarBarraAdmin();
      } }),
      el('button', { type: 'button', texto: t('painelAdmin'), onclick: abrirAdmin })
    ]);
    d.body.appendChild(barraAdminEl);
  }

  /* ---------------- biometria (WebAuthn) ---------------- */
  var Biometria = {
    _plataforma: null,     // preenchido no arranque: o aparelho tem leitor?
    verificarAparelho: function () {
      if (!raiz.PublicKeyCredential || !raiz.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        Biometria._plataforma = false; return Promise.resolve(false);
      }
      return raiz.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(function (v) { Biometria._plataforma = !!v; return !!v; })
        .catch(function () { Biometria._plataforma = false; return false; });
    },
    suportada: function () {
      return !!(raiz.PublicKeyCredential && navigator.credentials && navigator.credentials.create) &&
             (raiz.isSecureContext !== false) && Biometria._plataforma !== false;
    },
    registrada: function () { return !!Guardar.ler('biometria-id', null, true); },
    registrar: function (email) {
      if (!Biometria.suportada()) return Promise.reject(new Error('sem-suporte'));
      var nome = String(email || 'usuario');
      return navigator.credentials.create({
        publicKey: {
          challenge: aleatorio(32),
          rp: { name: nomeApp() },
          user: { id: aleatorio(16), name: nome, displayName: nome },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
          timeout: 60000, attestation: 'none'
        }
      }).then(function (cred) {
        Guardar.gravar('biometria-id', bytesParaB64(cred.rawId), true);
        Guardar.gravar('biometria-email', nome, true);
        return true;
      });
    },
    entrar: function () {
      var id = Guardar.ler('biometria-id', null, true);
      if (!id) return Promise.reject(new Error('sem-registro'));
      return navigator.credentials.get({
        publicKey: {
          challenge: aleatorio(32),
          allowCredentials: [{ type: 'public-key', id: b64ParaBytes(id) }],
          userVerification: 'required', timeout: 60000
        }
      }).then(function () {
        var email = Guardar.ler('biometria-email', '', true);
        var c = Contas.achar(email);
        return Sessao.entrar(c ? c.tipo : 'pagante', { email: email, nome: c ? c.nome : email, via: 'biometria' });
      });
    },
    remover: function () { Guardar.apagar('biometria-id', true); Guardar.apagar('biometria-email', true); }
  };

  /* ---------------- login social (Google) ---------------- */
  var Google = {
    carregado: false,
    carregar: function () {
      if (Google.carregado) return Promise.resolve();
      if (!cfg.login.google.clientId) return Promise.reject(new Error('sem-client-id'));
      return new Promise(function (ok, erro) {
        var s = el('script', { src: 'https://accounts.google.com/gsi/client', async: '', defer: '' });
        s.onload = function () { Google.carregado = true; ok(); };
        s.onerror = function () { erro(new Error('falha-script')); };
        d.head.appendChild(s);
      });
    },
    entrar: function () {
      return Google.carregar().then(function () {
        return new Promise(function (ok, erro) {
          try {
            raiz.google.accounts.id.initialize({
              client_id: cfg.login.google.clientId,
              callback: function (resp) {
                try {
                  var p = JSON.parse(raiz.atob(resp.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                  ok(Sessao.entrar('pagante', { email: p.email, nome: p.name || p.email, foto: p.picture, via: 'google' }));
                } catch (e) { erro(e); }
              }
            });
            raiz.google.accounts.id.prompt();
          } catch (e) { erro(e); }
        });
      });
    }
  };

  function nomeApp() {
    if (cfg.nome && typeof cfg.nome === 'object') return cfg.nome[Idioma.atual] || cfg.nome.pt || 'App';
    return cfg.nome || 'App';
  }

  /* ------------------------------------------------------------------
     10. OCR — ler texto de uma foto (camera do celular ou do notebook)
     ------------------------------------------------------------------ */
  var OCR = {
    _motor: null, _carregando: null, _stream: null,

    disponivel: function () { return !!cfg.ocr.ativo; },

    carregarBiblioteca: function () {
      if (raiz.Tesseract) return Promise.resolve(raiz.Tesseract);
      if (OCR._carregando) return OCR._carregando;
      var fontes = [];
      if (cfg.ocr.caminhoLocal) fontes.push(cfg.ocr.caminhoLocal);
      fontes.push(cfg.ocr.cdn);
      fontes.push('https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js');
      OCR._carregando = new Promise(function (ok, erro) {
        (function tentar(i) {
          if (i >= fontes.length) { erro(new Error('ocr-indisponivel')); return; }
          var s = el('script', { src: fontes[i] });
          s.onload = function () { raiz.Tesseract ? ok(raiz.Tesseract) : tentar(i + 1); };
          s.onerror = function () { tentar(i + 1); };
          d.head.appendChild(s);
        })(0);
      });
      return OCR._carregando;
    },

    motor: function (aoProgredir) {
      if (OCR._motor) return Promise.resolve(OCR._motor);
      return OCR.carregarBiblioteca().then(function (T) {
        var op = {
          logger: function (m) {
            if (aoProgredir && m && typeof m.progress === 'number') aoProgredir(m.progress, m.status);
          }
        };
        if (cfg.ocr.caminhos.worker) op.workerPath = cfg.ocr.caminhos.worker;
        if (cfg.ocr.caminhos.core) op.corePath = cfg.ocr.caminhos.core;
        if (cfg.ocr.caminhos.lang) { op.langPath = cfg.ocr.caminhos.lang; op.gzip = cfg.ocr.gzip !== false; }
        return T.createWorker(cfg.ocr.idiomas, 1, op);
      }).then(function (w) { OCR._motor = w; return w; });
    },

    /* melhora a foto antes de ler: aumenta, tira a cor e reforca o contraste */
    tratar: function (fonte) {
      var largura = fonte.naturalWidth || fonte.videoWidth || fonte.width;
      var altura = fonte.naturalHeight || fonte.videoHeight || fonte.height;
      if (!largura || !altura) return fonte;
      var escala = Math.min(3, Math.max(1, 1400 / largura));
      var c = d.createElement('canvas');
      c.width = Math.round(largura * escala); c.height = Math.round(altura * escala);
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(fonte, 0, 0, c.width, c.height);
      try {
        var img = ctx.getImageData(0, 0, c.width, c.height), p = img.data, i, v;
        var min = 255, max = 0;
        for (i = 0; i < p.length; i += 4) {
          v = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) | 0;
          p[i] = p[i + 1] = p[i + 2] = v;
          if (v < min) min = v; if (v > max) max = v;
        }
        var amp = (max - min) || 1;
        for (i = 0; i < p.length; i += 4) {
          v = ((p[i] - min) * 255 / amp) | 0;
          v = v < 0 ? 0 : (v > 255 ? 255 : v);
          p[i] = p[i + 1] = p[i + 2] = v;
        }
        ctx.putImageData(img, 0, 0);
      } catch (e) {}
      return c;
    },

    /* ---- motor hospedado no repositorio: sem internet, sem CDN ---- */
    _local: null, _workerLocal: null, _fila: null,

    temLocal: function () {
      if (OCR._local !== null) return Promise.resolve(OCR._local);
      if (cfg.ocr.local === false || !cfg.ocr.worker) { OCR._local = false; return Promise.resolve(false); }
      if (cfg.ocr.local === true) { OCR._local = true; return Promise.resolve(true); }
      if (typeof Worker !== 'function' || raiz.location.protocol === 'file:') {
        OCR._local = false; return Promise.resolve(false);
      }
      return fetch(cfg.ocr.worker, { method: 'GET' })
        .then(function (r) { OCR._local = !!r.ok; return OCR._local; })
        .catch(function () { OCR._local = false; return false; });
    },

    motorJaBaixado: function () {
      if (!raiz.caches) return Promise.resolve(false);
      return raiz.caches.match('tesseract-core-simd-lstm.wasm.js')
        .then(function (r) { return r ? true : raiz.caches.match('tesseract-core-lstm.wasm.js'); })
        .then(function (r) { return !!r; }).catch(function () { return false; });
    },

    lerLocal: function (fonte, aoProgredir) {
      if (OCR._workerLocal) return OCR._lerLocalAgora(fonte, aoProgredir);
      /* primeira vez nesta sessao: o motor pesa ~11 MB - respeita a regra de rede */
      return OCR.motorJaBaixado().then(function (ja) {
        if (ja) return true;
        return Rede.pedirPesado(t('escanear'), 11);
      }).then(function (pode) {
        if (!pode) throw new Error('so-wifi');
        return OCR._lerLocalAgora(fonte, aoProgredir);
      });
    },

    _lerLocalAgora: function (fonte, aoProgredir) {
      return new Promise(function (ok, erro) {
        var canvas = OCR.tratar(fonte);
        var paraBlob = canvas.toBlob
          ? new Promise(function (r) { canvas.toBlob(r, 'image/png'); })
          : Promise.resolve(null);
        paraBlob.then(function (blob) {
          if (!blob) { erro(new Error('sem-imagem')); return; }
          return blob.arrayBuffer();
        }).then(function (buf) {
          if (!buf) return;
          if (!OCR._workerLocal) {
            OCR._workerLocal = new Worker(cfg.ocr.worker);
            OCR._workerLocal.onerror = function () {
              OCR._local = false;
              if (OCR._fila) { var f = OCR._fila; OCR._fila = null; f.erro(new Error('worker-falhou')); }
              try { OCR._workerLocal.terminate(); } catch (e) {}
              OCR._workerLocal = null;
            };
            OCR._workerLocal.onmessage = function (ev) {
              var m = ev.data || {};
              if (!OCR._fila) return;
              if (m.tipo === 'estado') {
                var p = m.etapa === 'lendo' ? 0.7 : m.etapa === 'idioma' ? 0.4 : 0.15;
                if (OCR._fila.aoProgredir) OCR._fila.aoProgredir(p, m.etapa === 'lendo' ? 'recognizing text' : 'loading');
                return;
              }
              var f = OCR._fila; OCR._fila = null;
              if (m.tipo === 'pronto') f.ok({ texto: m.texto, confianca: m.confianca });
              else f.erro(new Error(m.mensagem || 'falhou'));
            };
          }
          OCR._fila = { ok: ok, erro: erro, aoProgredir: aoProgredir };
          OCR._workerLocal.postMessage({ tipo: 'ler', imagem: buf, idiomas: cfg.ocr.idiomas }, [buf]);
        }).catch(erro);
      });
    },

    ler: function (fonte, aoProgredir) {
      return OCR.temLocal().then(function (local) {
        if (local) {
          return OCR.lerLocal(fonte, aoProgredir).then(function (r) {
            return {
              texto: texto(r.texto).replace(/[ \t]+\n/g, '\n').trim(),
              confianca: r.confianca || 0,
              linhas: texto(r.texto).split('\n').filter(function (l) { return l.trim(); })
            };
          }).catch(function (e) {
            if (String(e && e.message) === 'worker-falhou') return OCR.lerPelaBiblioteca(fonte, aoProgredir);
            throw e;
          });
        }
        return OCR.lerPelaBiblioteca(fonte, aoProgredir);
      });
    },

    lerPelaBiblioteca: function (fonte, aoProgredir) {
      return OCR.motor(aoProgredir).then(function (w) {
        return w.recognize(OCR.tratar(fonte));
      }).then(function (r) {
        var dados = r && r.data ? r.data : {};
        return {
          texto: texto(dados.text).replace(/[ \t]+\n/g, '\n').trim(),
          confianca: dados.confidence || 0,
          linhas: (dados.lines || []).map(function (l) { return l.text; })
        };
      });
    },

    lerArquivo: function (arquivo, aoProgredir) {
      return new Promise(function (ok, erro) {
        var img = new Image();
        img.onload = function () { ok(OCR.ler(img, aoProgredir)); };
        img.onerror = function () { erro(new Error('imagem-invalida')); };
        img.src = URL.createObjectURL(arquivo);
      });
    },

    /* utilidades uteis para nota fiscal / recibo */
    extrair: function (txt) {
      txt = texto(txt);
      var valores = (txt.match(/(?:R\$|\bUS\$|\$)\s?-?\d{1,3}(?:[.\s]\d{3})*(?:[,.]\d{2})?/gi) || []);
      var numeros = valores.map(function (v) {
        var n = v.replace(/[^\d,.-]/g, '');
        if (/,\d{2}$/.test(n)) n = n.replace(/\./g, '').replace(',', '.');
        else n = n.replace(/,/g, '');
        return parseFloat(n);
      }).filter(function (n) { return !isNaN(n); });
      var datas = (txt.match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g) || []);
      var cnpj = (txt.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) || []);
      return {
        valores: numeros,
        maiorValor: numeros.length ? Math.max.apply(null, numeros) : null,
        datas: datas.map(function (s) {
          var p = s.split(/[\/.-]/), ano = p[2].length === 2 ? ('20' + p[2]) : p[2];
          return formatarData(new Date(+ano, +p[1] - 1, +p[0]));
        }),
        cnpj: cnpj,
        primeiraLinha: (txt.split('\n').find(function (l) { return l.trim().length > 3; }) || '').trim()
      };
    },

    pararCamera: function () {
      if (OCR._stream) { OCR._stream.getTracks().forEach(function (f) { f.stop(); }); OCR._stream = null; }
    },

    ondeEsta: function () {
      return OCR._local === true ? 'repositorio' : OCR._local === false ? 'internet' : 'nao-verificado';
    }
  };

  /* ------------------------------------------------------------------
     11. NUVEM — pasta privada do app no Google Drive / OneDrive
         Escopo minimo: o app so enxerga a pasta que ele mesmo cria.
     ------------------------------------------------------------------ */
  function pkceVerificador() {
    var b = aleatorio(32);
    return bytesParaB64(b);
  }
  function pkceDesafio(verificador) {
    if (!temCripto) return Promise.resolve(verificador);
    return raiz.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador)).then(bytesParaB64);
  }
  function abrirPopup(url, nome) {
    var l = Math.max(0, (raiz.screen.width - 520) / 2), tp = Math.max(0, (raiz.screen.height - 640) / 2);
    return raiz.open(url, nome || 'dgo-auth', 'width=520,height=640,left=' + l + ',top=' + tp);
  }

  var Nuvem = {
    conectado: function () {
      return Guardar.ler('nuvem-provedor', null) || null;
    },

    google: {
      token: null,
      conectar: function () {
        if (!cfg.nuvem.google.clientId) return Promise.reject(new Error('sem-client-id'));
        return Google.carregar().then(function () {
          return new Promise(function (ok, erro) {
            var cliente = raiz.google.accounts.oauth2.initTokenClient({
              client_id: cfg.nuvem.google.clientId,
              scope: 'https://www.googleapis.com/auth/drive.appdata',
              callback: function (r) {
                if (r && r.access_token) {
                  Nuvem.google.token = r.access_token;
                  Guardar.gravar('nuvem-provedor', 'google');
                  ok(true);
                } else erro(new Error('sem-token'));
              }
            });
            cliente.requestAccessToken();
          });
        });
      },
      _achar: function () {
        return fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=' +
          encodeURIComponent("name='" + cfg.nuvem.arquivo + "'"), {
          headers: { Authorization: 'Bearer ' + Nuvem.google.token }
        }).then(function (r) { return r.json(); })
          .then(function (j) { return (j.files && j.files[0]) || null; });
      },
      enviar: function (dados) {
        var corpo = JSON.stringify(dados);
        return Nuvem.google._achar().then(function (arq) {
          var meta = { name: cfg.nuvem.arquivo, mimeType: 'application/json' };
          if (!arq) meta.parents = ['appDataFolder'];
          var limite = '-dgo-' + Date.now();
          var multi = '--' + limite + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(meta) + '\r\n--' + limite +
            '\r\nContent-Type: application/json\r\n\r\n' + corpo + '\r\n--' + limite + '--';
          var url = 'https://www.googleapis.com/upload/drive/v3/files' + (arq ? ('/' + arq.id) : '') + '?uploadType=multipart';
          return fetch(url, {
            method: arq ? 'PATCH' : 'POST',
            headers: { Authorization: 'Bearer ' + Nuvem.google.token, 'Content-Type': 'multipart/related; boundary=' + limite },
            body: multi
          }).then(function (r) { if (!r.ok) throw new Error('falha-envio'); return r.json(); });
        });
      },
      baixar: function () {
        return Nuvem.google._achar().then(function (arq) {
          if (!arq) return null;
          return fetch('https://www.googleapis.com/drive/v3/files/' + arq.id + '?alt=media', {
            headers: { Authorization: 'Bearer ' + Nuvem.google.token }
          }).then(function (r) { return r.json(); });
        });
      }
    },

    microsoft: {
      token: null,
      conectar: function () {
        var id = cfg.nuvem.microsoft.clientId;
        if (!id) return Promise.reject(new Error('sem-client-id'));
        var verif = pkceVerificador();
        var redirect = raiz.location.origin + raiz.location.pathname;
        return pkceDesafio(verif).then(function (desafio) {
          var url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=' + encodeURIComponent(id) +
            '&response_type=code&redirect_uri=' + encodeURIComponent(redirect) +
            '&scope=' + encodeURIComponent('Files.ReadWrite.AppFolder offline_access openid profile') +
            '&code_challenge=' + encodeURIComponent(desafio) + '&code_challenge_method=S256' +
            '&state=dgo&prompt=select_account';
          var win = abrirPopup(url, 'dgo-ms');
          return new Promise(function (ok, erro) {
            var t0 = Date.now();
            var timer = setInterval(function () {
              if (Date.now() - t0 > 180000) { clearInterval(timer); erro(new Error('tempo')); return; }
              var codigo = null;
              try {
                if (win && win.location && win.location.origin === raiz.location.origin) {
                  var q = new URLSearchParams(win.location.search);
                  codigo = q.get('code');
                }
              } catch (e) { /* ainda na Microsoft */ }
              if (codigo) {
                clearInterval(timer); win.close();
                var corpo = new URLSearchParams({
                  client_id: id, grant_type: 'authorization_code', code: codigo,
                  redirect_uri: redirect, code_verifier: verif
                });
                fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corpo
                }).then(function (r) { return r.json(); }).then(function (j) {
                  if (!j.access_token) throw new Error('sem-token');
                  Nuvem.microsoft.token = j.access_token;
                  Guardar.gravar('nuvem-provedor', 'microsoft');
                  ok(true);
                }).catch(erro);
              } else if (win && win.closed) { clearInterval(timer); erro(new Error('cancelado')); }
            }, 700);
          });
        });
      },
      enviar: function (dados) {
        return fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot:/' + cfg.nuvem.arquivo + ':/content', {
          method: 'PUT',
          headers: { Authorization: 'Bearer ' + Nuvem.microsoft.token, 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        }).then(function (r) { if (!r.ok) throw new Error('falha-envio'); return r.json(); });
      },
      baixar: function () {
        return fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot:/' + cfg.nuvem.arquivo + ':/content', {
          headers: { Authorization: 'Bearer ' + Nuvem.microsoft.token }
        }).then(function (r) { return r.ok ? r.json() : null; });
      }
    },

    /* backup que funciona sempre, sem depender de nuvem nenhuma */
    salvarArquivo: function (dados, nomeArquivo) {
      var blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      var a = el('a', { href: URL.createObjectURL(blob), download: nomeArquivo || (cfg.app + '-backup.json') });
      d.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    },
    abrirArquivo: function () {
      return new Promise(function (ok, erro) {
        var inp = el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
        inp.addEventListener('change', function () {
          var f = inp.files && inp.files[0];
          if (!f) { erro(new Error('cancelado')); return; }
          var fr = new FileReader();
          fr.onload = function () { try { ok(JSON.parse(fr.result)); } catch (e) { erro(e); } };
          fr.onerror = function () { erro(new Error('falha-leitura')); };
          fr.readAsText(f);
          inp.remove();
        });
        d.body.appendChild(inp); inp.click();
      });
    }
  };

  /* ------------------------------------------------------------------
     12. COMPARTILHAMENTO NATIVO (WhatsApp e demais apps do aparelho)
     ------------------------------------------------------------------ */
  function compartilhar(dados) {
    dados = dados || {};
    var d2 = {
      title: dados.titulo || nomeApp(),
      text: dados.texto || '',
      url: dados.url || raiz.location.href
    };
    if (dados.arquivos && navigator.canShare && navigator.canShare({ files: dados.arquivos })) {
      d2.files = dados.arquivos;
    }
    if (navigator.share) {
      return navigator.share(d2).catch(function (e) {
        if (e && e.name === 'AbortError') return;
        return abrirMenuCompartilhar(d2);
      });
    }
    return abrirMenuCompartilhar(d2);
  }

  function abrirMenuCompartilhar(d2) {
    var msg = (d2.text ? d2.text + ' ' : '') + (d2.url || '');
    var opcoes = [
      ['WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(msg)],
      ['Telegram', 'https://t.me/share/url?url=' + encodeURIComponent(d2.url) + '&text=' + encodeURIComponent(d2.text || '')],
      ['E-mail', 'mailto:?subject=' + encodeURIComponent(d2.title) + '&body=' + encodeURIComponent(msg)]
    ];
    var caixa = el('div', { class: 'dgo-caixa', style: { maxWidth: '360px' } }, [
      el('h2', { texto: t('compartilhar') })
    ]);
    opcoes.forEach(function (o) {
      caixa.appendChild(el('a', { class: 'dgo-b dgo-b2', href: o[1], target: '_blank', rel: 'noopener', texto: o[0],
        style: { textDecoration: 'none' } }));
    });
    caixa.appendChild(el('button', {
      class: 'dgo-b', type: 'button', texto: t('copiarLink'),
      onclick: function () {
        (navigator.clipboard ? navigator.clipboard.writeText(msg) : Promise.reject())
          .then(function () { this.textContent = t('copiado'); }.bind(this)).catch(function () {});
      }
    }));
    caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('fechar'),
      onclick: function () { fecharModal(); } }));
    return abrirModal(caixa);
  }

  /* ------------------------------------------------------------------
     13. APP INSTALAVEL (celular e computador) — base para o app nativo
     ------------------------------------------------------------------ */
  var PWA = {
    prompt: null,
    instalado: function () {
      return raiz.matchMedia && raiz.matchMedia('(display-mode: standalone)').matches ||
             raiz.navigator.standalone === true;
    },
    preparar: function () {
      if (!cfg.pwa.ativo) return;
      if (cfg.pwa.manifesto && !$('link[rel="manifest"]')) {
        d.head.appendChild(el('link', { rel: 'manifest', href: cfg.pwa.manifesto }));
      }
      raiz.addEventListener('beforeinstallprompt', function (ev) {
        ev.preventDefault(); PWA.prompt = ev; redesenharInterfaceDGO();
      });
      if ('serviceWorker' in navigator && cfg.pwa.serviceWorker && raiz.location.protocol !== 'file:') {
        raiz.addEventListener('load', function () {
          navigator.serviceWorker.register(cfg.pwa.serviceWorker).catch(function () {});
        });
      }
    },
    instalar: function () {
      if (!PWA.prompt) return Promise.resolve(false);
      PWA.prompt.prompt();
      return PWA.prompt.userChoice.then(function (r) { PWA.prompt = null; return r.outcome === 'accepted'; });
    }
  };

  /* ------------------------------------------------------------------
     14. PLATAFORMA — ponte para quando virar app nativo
     ------------------------------------------------------------------ */
  var Plataforma = {
    qual: function () {
      if (raiz.Capacitor) return 'capacitor';
      if (raiz.__TAURI__) return 'tauri';
      if (raiz.process && raiz.process.versions && raiz.process.versions.electron) return 'electron';
      if (PWA.instalado()) return 'pwa';
      return 'web';
    },
    ehCelular: function () {
      return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
             (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
    },
    /* pontos de troca: um app nativo substitui so estas tres funcoes */
    adaptadores: { camera: null, armazenamento: null, compartilhar: null }
  };

  /* ------------------------------------------------------------------
     15. JANELAS (modais) DO MODULO
     ------------------------------------------------------------------ */
  var modalEl = null;
  function abrirModal(caixa, recriar) {
    fecharModal();
    modalEl = el('div', { class: 'dgo-modal', 'data-dgo-ui': '1', role: 'dialog', 'aria-modal': 'true' }, [caixa]);
    modalEl._recriar = recriar || null;
    modalEl.addEventListener('click', function (e) { if (e.target === modalEl) fecharModal(); });
    d.addEventListener('keydown', escFecha);
    d.body.appendChild(modalEl);
    var primeiro = modalEl.querySelector('input,button,select,textarea');
    if (primeiro && !Plataforma.ehCelular()) { try { primeiro.focus(); } catch (e) {} }
    return modalEl;
  }
  function escFecha(e) { if (e.key === 'Escape') fecharModal(); }
  function fecharModal() {
    OCR.pararCamera();
    d.removeEventListener('keydown', escFecha);
    if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
    modalEl = null;
  }
  function redesenharInterfaceDGO() {
    if (modalEl && typeof modalEl._recriar === 'function') { var f = modalEl._recriar; fecharModal(); f(); }
    if (bannerEl) { /* o texto do placeholder muda com o idioma */
      var img = bannerEl.querySelector('img');
      if (img && !cfg.anuncios.imagem) img.src = imagemPlaceholder();
    }
  }
  function campo(rotulo, props) {
    var i = el('input', props || { type: 'text' });
    var l = el('label', { class: 'dgo-campo' }, [el('span', { texto: rotulo }), i]);
    l._input = i;
    return l;
  }
  function aviso(txt, tipo) { return el('div', { class: 'dgo-aviso ' + (tipo || 'info'), texto: txt }); }

  /* ------------------------------------------------------------------
     16. TELA DE ACESSO
     ------------------------------------------------------------------ */
  function abrirLogin(abaInicial) {
    var aba = abaInicial || 'visitante';
    if (!cfg.login.permitirVisitante && aba === 'visitante') aba = 'pagante';

    function montar() {
      var caixa = el('div', { class: 'dgo-caixa' });
      caixa.appendChild(el('h2', { texto: nomeApp() }));
      caixa.appendChild(el('p', { texto: t('entrar') }));

      var abas = el('div', { class: 'dgo-abas' });
      var lista = [];
      if (cfg.login.permitirVisitante) lista.push(['visitante', t('visitante')]);
      if (cfg.login.permitirPagante) lista.push(['pagante', t('membro')]);
      if (cfg.login.permitirAnunciante) lista.push(['anunciante', t('anunciante')]);
      lista.forEach(function (par) {
        abas.appendChild(el('button', {
          type: 'button', class: aba === par[0] ? 'dgo-on' : '', texto: par[1],
          onclick: function () { aba = par[0]; abrirModal(montar(), function () { abrirLogin(aba); }); }
        }));
      });
      caixa.appendChild(abas);

      var corpo = el('div');
      caixa.appendChild(corpo);

      if (aba === 'visitante') {
        corpo.appendChild(aviso(t('avisoVisitante'), 'info'));
        corpo.appendChild(el('button', {
          class: 'dgo-b', type: 'button', texto: t('entrarVisitante'),
          onclick: function () { Sessao.entrar('visitante', { nome: t('visitante') }); fecharModal(); }
        }));
      } else {
        var ehAnunciante = (aba === 'anunciante');
        corpo.appendChild(aviso(ehAnunciante ? t('avisoAnunciante') : t('avisoMembro'), 'info'));

        var modoCriar = { v: false };
        var cApelido = campo(t('apelido'), { type: 'text', autocomplete: 'username',
                                             autocapitalize: 'none', spellcheck: 'false' });
        var cIdent = campo(t('apelidoOuEmail'), { type: 'text', autocomplete: 'username',
                                                  autocapitalize: 'none', spellcheck: 'false' });
        var cEmail = campo(t('email'), { type: 'email', autocomplete: 'email', inputmode: 'email' });
        var cSenha = campo(t('senha'), { type: 'password', autocomplete: 'current-password' });
        var cSenha2 = campo(t('confirmarSenha'), { type: 'password', autocomplete: 'new-password' });

        cApelido.style.display = 'none';
        cEmail.style.display = 'none';
        cSenha2.style.display = 'none';
        corpo.appendChild(cApelido);
        corpo.appendChild(cIdent);
        corpo.appendChild(cEmail);
        corpo.appendChild(cSenha);
        corpo.appendChild(cSenha2);

        var msg = el('div');
        var bPrincipal = el('button', { class: 'dgo-b', type: 'button', texto: t('entrar') });
        var bTrocar = el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('criarConta') });

        function mostrar(txt, tipo) { msg.innerHTML = ''; msg.appendChild(aviso(txt, tipo || 'erro')); }

        function aplicarModo() {
          var criando = modoCriar.v;
          cApelido.style.display = (criando && cfg.login.exigirApelido) ? '' : 'none';
          cEmail.style.display = criando ? '' : 'none';
          cIdent.style.display = criando ? 'none' : '';
          cSenha2.style.display = criando ? '' : 'none';
          cSenha._input.setAttribute('autocomplete', criando ? 'new-password' : 'current-password');
          bPrincipal.textContent = criando ? t('criarConta') : t('entrar');
          bTrocar.textContent = criando ? t('jaTenhoConta') : t('criarConta');
          msg.innerHTML = '';
        }
        bTrocar.addEventListener('click', function () { modoCriar.v = !modoCriar.v; aplicarModo(); });

        function erroEmTexto(e) {
          var m = (e && e.message) || '';
          if (m === 'apelido-curto') return t('apelidoCurto');
          if (m === 'apelido-em-uso') return t('apelidoEmUso');
          if (m === 'email-invalido') return t('emailInvalido');
          if (m === 'senha-curta') return t('senhaCurta');
          if (m === 'existe') return t('contaExiste');
          if (m === 'sem-conta') return t('semConta');
          return t('dadosErrados');
        }

        bPrincipal.addEventListener('click', function () {
          var senha = cSenha._input.value;
          bPrincipal.disabled = true;
          var fim = function () { bPrincipal.disabled = false; };

          if (modoCriar.v) {
            var apelido = cApelido._input.value.trim();
            var email = cEmail._input.value.trim();
            if (senha !== cSenha2._input.value) { mostrar(t('senhasDiferentes')); fim(); return; }
            if (Sessao.backend && Sessao.backend.cadastrar) {
              Sessao.backend.cadastrar({ apelido: apelido, email: email, senha: senha, tipo: aba })
                .then(function (u) { Sessao.entrar(aba, u || { email: email, nome: apelido }); fecharModal(); })
                .catch(function (e) { mostrar(erroEmTexto(e)); }).then(fim, fim);
              return;
            }
            Contas.criar({ apelido: apelido, email: email, senha: senha, tipo: aba })
              .then(function (r) {
                Sessao.entrar(aba, { email: r.conta.email, nome: r.conta.apelido, apelido: r.conta.apelido });
                mostrarCodigoRecuperacao(r.codigo, r.conta);
              })
              .catch(function (e) { mostrar(erroEmTexto(e)); }).then(fim, fim);
            return;
          }

          var ident = cIdent._input.value.trim();
          if (!ident) { mostrar(t('identificadorVazio')); fim(); return; }
          if (Sessao.backend && Sessao.backend.entrar) {
            Sessao.backend.entrar(ident, senha, aba)
              .then(function (u) { Sessao.entrar(aba, u || { email: ident }); fecharModal(); })
              .catch(function (e) { mostrar(erroEmTexto(e)); }).then(fim, fim);
            return;
          }
          Contas.conferir(ident, senha).then(function (c) {
            var tipo = c.tipo || aba;
            if ((cfg.login.emailsAdmin || []).indexOf(c.email) !== -1) tipo = 'admin';
            Sessao.entrar(tipo, { email: c.email, nome: c.apelido || c.nome, apelido: c.apelido });
            fecharModal();
            if (cfg.login.biometria && Biometria.suportada() && !Biometria.registrada()) perguntarBiometria(c.email);
          }).catch(function (e) { mostrar(erroEmTexto(e)); }).then(fim, fim);
        });

        corpo.appendChild(bPrincipal);
        corpo.appendChild(bTrocar);

        /* esqueci a senha */
        corpo.appendChild(el('button', {
          class: 'dgo-b dgo-b2', type: 'button', texto: t('esqueciSenha'),
          style: { background: 'transparent', border: '0', color: '#7dd3fc', textDecoration: 'underline',
                   minHeight: '38px', fontWeight: '600' },
          onclick: function () { abrirRecuperacao(aba); }
        }));
        corpo.appendChild(msg);

        if (cfg.login.google.clientId) {
          corpo.appendChild(el('button', {
            class: 'dgo-b dgo-b2', type: 'button', texto: t('entrarGoogle'),
            onclick: function () { Google.entrar().then(fecharModal).catch(function () { mostrar(t('naoConfigurado')); }); }
          }));
        }
        if (cfg.login.biometria && Biometria.suportada() && Biometria.registrada()) {
          corpo.appendChild(el('button', {
            class: 'dgo-b dgo-b2', type: 'button', texto: t('entrarBiometria'),
            onclick: function () { Biometria.entrar().then(fecharModal).catch(function () { mostrar(t('dadosErrados')); }); }
          }));
        }
        aplicarModo();
      }
      return caixa;
    }
    return abrirModal(montar(), function () { abrirLogin(aba); });
  }

  /* ---- o codigo de recuperacao, mostrado uma unica vez ---- */
  function mostrarCodigoRecuperacao(codigo, conta, motivo) {
    var caixa = el('div', { class: 'dgo-caixa' });
    caixa.appendChild(el('h2', { texto: t('codigoRecuperacao') }));
    caixa.appendChild(aviso(motivo === 'trocada' ? t('senhaTrocada') : t('contaCriada'), 'ok'));
    caixa.appendChild(el('p', { texto: t('guardeCodigo') }));
    caixa.appendChild(el('div', {
      texto: codigo,
      style: { fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: '25px', fontWeight: '700',
               letterSpacing: '.09em', textAlign: 'center', color: '#fff', background: '#0b1220',
               border: '1px dashed rgba(94,234,212,.6)', borderRadius: '12px', padding: '16px 8px', margin: '4px 0 6px',
               userSelect: 'all', wordBreak: 'break-all' }
    }));
    var linha = el('div', { class: 'dgo-linha' });
    linha.appendChild(el('button', {
      class: 'dgo-b dgo-b2', type: 'button', texto: t('copiarCodigo'),
      onclick: function () {
        var b = this;
        (navigator.clipboard ? navigator.clipboard.writeText(codigo) : Promise.reject())
          .then(function () { b.textContent = t('copiado'); }).catch(function () {});
      }
    }));
    linha.appendChild(el('button', {
      class: 'dgo-b dgo-b2', type: 'button', texto: t('baixarCodigo'),
      onclick: function () {
        var txt = nomeApp() + '\n' +
          t('apelido') + ': ' + ((conta && conta.apelido) || '') + '\n' +
          t('email') + ': ' + ((conta && conta.email) || '') + '\n' +
          t('codigoRecuperacao') + ': ' + codigo + '\n' +
          formatarData(new Date(), null, true) + '\n';
        var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        var a = el('a', { href: URL.createObjectURL(blob), download: cfg.app + '-codigo-de-recuperacao.txt' });
        d.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      }
    }));
    caixa.appendChild(linha);
    caixa.appendChild(el('button', {
      class: 'dgo-b', type: 'button', texto: t('jaGuardei'),
      onclick: function () {
        fecharModal();
        if (cfg.login.biometria && Biometria.suportada() && conta) perguntarBiometria(conta.email);
      }
    }));
    return abrirModal(caixa);
  }

  /* ---- esqueci a senha ---- */
  function abrirRecuperacao(aba) {
    var temServidor = !!(Sessao.backend && Sessao.backend.pedirRedefinicao);
    var temFormulario = !!(cfg.login.formularioRecuperacao || cfg.email.formulario);
    var modo = temServidor ? 'email' : 'codigo';

    function montar() {
      var caixa = el('div', { class: 'dgo-caixa' });
      caixa.appendChild(el('h2', { texto: t('recuperarSenha') }));
      var msg = el('div');
      function mostrar(txt, tipo) { msg.innerHTML = ''; msg.appendChild(aviso(txt, tipo || 'erro')); }

      /* escolha do caminho, quando ha mais de um */
      var caminhos = [];
      if (temServidor) caminhos.push(['email', t('porEmail')]);
      caminhos.push(['codigo', t('porCodigo')]);
      if (temFormulario) caminhos.push(['pedido', t('pedirAoDono')]);
      if (caminhos.length > 1) {
        caixa.appendChild(el('p', { texto: t('comoRecuperar') }));
        var abas = el('div', { class: 'dgo-abas' });
        caminhos.forEach(function (c) {
          abas.appendChild(el('button', {
            type: 'button', class: modo === c[0] ? 'dgo-on' : '', texto: c[1],
            onclick: function () { modo = c[0]; abrirModal(montar(), function () { abrirRecuperacao(aba); }); }
          }));
        });
        caixa.appendChild(abas);
      }

      if (modo === 'email') {
        var cE = campo(t('email'), { type: 'email', autocomplete: 'email', inputmode: 'email' });
        caixa.appendChild(cE);
        caixa.appendChild(el('button', {
          class: 'dgo-b', type: 'button', texto: t('enviarPedido'),
          onclick: function () {
            Sessao.backend.pedirRedefinicao(cE._input.value.trim())
              .then(function () { mostrar(t('verifiqueEmail'), 'ok'); })
              .catch(function () { mostrar(t('pedidoFalhou')); });
          }
        }));

      } else if (modo === 'pedido') {
        var cE2 = campo(t('email'), { type: 'email', autocomplete: 'email', inputmode: 'email' });
        var cM = el('label', { class: 'dgo-campo' }, [
          el('span', { texto: t('mensagem') }),
          el('textarea', { rows: 4 })
        ]);
        caixa.appendChild(cE2); caixa.appendChild(cM);
        caixa.appendChild(el('button', {
          class: 'dgo-b', type: 'button', texto: t('enviarPedido'),
          onclick: function () {
            var b = this; b.disabled = true;
            var alvo = cfg.login.formularioRecuperacao || cfg.email.formulario;
            var corpo = {
              app: cfg.app, assunto: t('recuperarSenha') + ' - ' + nomeApp(),
              mensagem: cM.querySelector('textarea').value,
              email: cE2._input.value.trim(), idioma: Idioma.atual, em: new Date().toISOString()
            };
            fetch(alvo, { method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify(corpo) })
              .then(function (r) { if (!r.ok) throw new Error('x'); mostrar(t('pedidoEnviado'), 'ok'); })
              .catch(function () { mostrar(t('pedidoFalhou')); })
              .then(function () { b.disabled = false; });
          }
        }));

      } else {
        if (!temServidor && !temFormulario) caixa.appendChild(aviso(t('semRecuperacaoConfigurada'), 'info'));
        var cId = campo(t('apelidoOuEmail'), { type: 'text', autocapitalize: 'none', spellcheck: 'false' });
        var cCod = campo(t('codigoRecuperacao'), { type: 'text', placeholder: 'ABCD-EF23-GH45',
                                                   autocapitalize: 'characters', spellcheck: 'false' });
        var cN1 = campo(t('novaSenha'), { type: 'password', autocomplete: 'new-password' });
        var cN2 = campo(t('confirmarNovaSenha'), { type: 'password', autocomplete: 'new-password' });
        [cId, cCod, cN1, cN2].forEach(function (x) { caixa.appendChild(x); });
        caixa.appendChild(el('button', {
          class: 'dgo-b', type: 'button', texto: t('trocarSenha'),
          onclick: function () {
            if (cN1._input.value !== cN2._input.value) { mostrar(t('senhasDiferentes')); return; }
            var b = this; b.disabled = true;
            Contas.redefinirComCodigo(cId._input.value.trim(), cCod._input.value, cN1._input.value)
              .then(function (r) {
                fecharModal();
                mostrarCodigoRecuperacao(r.codigo, r.conta, 'trocada');
              })
              .catch(function (e) {
                var m = (e && e.message) || '';
                mostrar(m === 'codigo-errado' ? t('codigoErrado')
                      : m === 'sem-conta' ? t('semConta')
                      : m === 'senha-curta' ? t('senhaCurta') : t('dadosErrados'));
              })
              .then(function () { b.disabled = false; });
          }
        }));
      }

      caixa.appendChild(msg);
      caixa.appendChild(el('div', { class: 'dgo-sep' }));
      caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: Idioma.atual === 'en' ? 'Back' : 'Voltar',
        onclick: function () { abrirLogin(aba); } }));
      return caixa;
    }
    return abrirModal(montar(), function () { abrirRecuperacao(aba); });
  }

  function perguntarBiometria(email) {
    var caixa = el('div', { class: 'dgo-caixa', style: { maxWidth: '360px' } }, [
      el('h2', { texto: t('ativarBiometria') }),
      el('p', { texto: nomeApp() })
    ]);
    caixa.appendChild(el('button', {
      class: 'dgo-b', type: 'button', texto: t('ativarBiometria'),
      onclick: function () { Biometria.registrar(email).then(fecharModal).catch(fecharModal); }
    }));
    caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('cancelar'), onclick: fecharModal }));
    abrirModal(caixa);
  }

  /* ------------------------------------------------------------------
     17. TELA DE OCR
     ------------------------------------------------------------------ */
  function abrirOCR(opcoes) {
    opcoes = opcoes || {};
    var caixa = el('div', { class: 'dgo-caixa dgo-larga' });
    caixa.appendChild(el('h2', { texto: t('escanear') }));
    var area = el('div');
    var barra = el('div', { class: 'dgo-barra', style: { display: 'none' } }, [el('i')]);
    var estado = el('div');
    var saida = el('div');
    caixa.appendChild(area); caixa.appendChild(barra); caixa.appendChild(estado); caixa.appendChild(saida);

    var video = null, fotoCanvas = null;

    function limpar() { area.innerHTML = ''; saida.innerHTML = ''; estado.innerHTML = ''; barra.style.display = 'none'; }

    function progresso(p, st) {
      barra.style.display = '';
      barra.firstChild.style.width = Math.round((p || 0) * 100) + '%';
      estado.innerHTML = '';
      estado.appendChild(aviso(st === 'recognizing text' ? t('lendo') : t('carregandoMotor'), 'info'));
    }

    function mostrarResultado(r) {
      barra.style.display = 'none'; estado.innerHTML = '';
      saida.innerHTML = '';
      saida.appendChild(el('h3', { texto: t('textoLido') }));
      var ta = el('textarea', { rows: 9, style: { width: '100%', boxSizing: 'border-box', padding: '11px',
        borderRadius: '10px', border: '1px solid rgba(255,255,255,.16)', background: '#0b1220', color: '#e2e8f0',
        fontSize: '14px', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' } });
      ta.value = r.texto || '';
      saida.appendChild(ta);
      var extras = OCR.extrair(r.texto);
      if (extras.maiorValor !== null || extras.datas.length) {
        var det = [];
        if (extras.maiorValor !== null) det.push((Idioma.atual === 'en' ? 'Largest amount: ' : 'Maior valor: ') + extras.maiorValor.toFixed(2));
        if (extras.datas.length) det.push((Idioma.atual === 'en' ? 'Date: ' : 'Data: ') + extras.datas[0]);
        saida.appendChild(aviso(det.join('   |   '), 'ok'));
      }
      var linha = el('div', { class: 'dgo-linha' });
      linha.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('usarTexto'), onclick: function () {
        if (typeof opcoes.aoTexto === 'function') opcoes.aoTexto(ta.value, extras);
        d.dispatchEvent(new CustomEvent('dgo:ocr', { detail: { texto: ta.value, dados: extras } }));
        fecharModal();
      } }));
      linha.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('copiarTexto'), onclick: function () {
        if (navigator.clipboard) navigator.clipboard.writeText(ta.value);
      } }));
      linha.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('outraFoto'), onclick: inicio }));
      saida.appendChild(linha);
    }

    function lerFonte(fonte) {
      progresso(0.02, '');
      OCR.ler(fonte, progresso).then(mostrarResultado).catch(function (e) {
        estado.innerHTML = '';
        estado.appendChild(aviso(String(e && e.message) === 'so-wifi' ? t('redeSoWifi') : t('semCamera'), 'erro'));
        barra.style.display = 'none';
      });
    }

    function usarCamera() {
      limpar();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        area.appendChild(aviso(t('semCamera'), 'erro')); return;
      }
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false
      }).then(function (stream) {
        OCR._stream = stream;
        video = el('video', { class: 'dgo-video', autoplay: '', playsinline: '', muted: '' });
        video.srcObject = stream; video.muted = true;
        area.appendChild(video);
        area.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('tirarFoto'), onclick: function () {
          fotoCanvas = d.createElement('canvas');
          fotoCanvas.width = video.videoWidth; fotoCanvas.height = video.videoHeight;
          fotoCanvas.getContext('2d').drawImage(video, 0, 0);
          OCR.pararCamera();
          limpar();
          fotoCanvas.className = 'dgo-foto';
          area.appendChild(fotoCanvas);
          var l = el('div', { class: 'dgo-linha' });
          l.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('lerTexto'), onclick: function () { lerFonte(fotoCanvas); } }));
          l.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('outraFoto'), onclick: usarCamera }));
          area.appendChild(l);
        } }));
        area.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('cancelar'), onclick: inicio }));
      }).catch(function () {
        area.appendChild(aviso(t('semCamera'), 'erro'));
        area.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('escolherImagem'), onclick: escolher }));
      });
    }

    function escolher() {
      var inp = el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0]; inp.remove();
        if (!f) return;
        limpar();
        var img = new Image();
        img.className = 'dgo-foto';
        img.onload = function () { area.appendChild(img); lerFonte(img); };
        img.src = URL.createObjectURL(f);
      });
      d.body.appendChild(inp); inp.click();
    }

    function inicio() {
      OCR.pararCamera(); limpar();
      area.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('usarCamera'), onclick: usarCamera }));
      area.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('escolherImagem'), onclick: escolher }));
      area.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('fechar'), onclick: fecharModal }));
    }

    abrirModal(caixa);
    inicio();
    return modalEl;
  }

  /* ------------------------------------------------------------------
     18. CONFIGURACOES (painel central; cada app mostra so o que usa)
     ------------------------------------------------------------------ */
  var SECOES_PADRAO = ['idioma', 'conta', 'notificacoes', 'ia', 'rede', 'nuvem', 'ocr', 'app'];

  function montarConfiguracoes(opcoes) {
    opcoes = opcoes || {};
    var secoes = opcoes.secoes || SECOES_PADRAO;
    var raizEl = el('div', { 'data-dgo-ui': '1' });
    function tem(s) { return secoes.indexOf(s) !== -1; }

    if (tem('idioma')) {
      raizEl.appendChild(el('h3', { texto: t('idioma') }));
      var linhaId = el('div', { class: 'dgo-linha' });
      [['pt', 'Português'], ['en', 'English']].forEach(function (p) {
        linhaId.appendChild(el('button', {
          class: 'dgo-b' + (Idioma.atual === p[0] ? '' : ' dgo-b2'), type: 'button', texto: p[1],
          onclick: function () { Idioma.definir(p[0]); }
        }));
      });
      raizEl.appendChild(linhaId);
      raizEl.appendChild(el('div', { class: 'dgo-mini', texto:
        (Idioma.atual === 'en' ? 'Date format: ' : 'Formato de data: ') + formatarData(new Date()) }));
    }

    if (tem('conta')) {
      raizEl.appendChild(el('h3', { texto: t('conta') }));
      var r = Sessao.resumo();
      var qual = r.tipo === 'pagante' ? t('assinante') : r.tipo === 'anunciante' ? t('anunciante') :
                 r.tipo === 'visitante' ? t('visitante') : '-';
      raizEl.appendChild(aviso(qual + (r.usuario && r.usuario.email ? ('  -  ' + r.usuario.email) : ''), 'info'));
      if (r.tipo) {
        raizEl.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('sair'),
          onclick: function () { Sessao.sair(); fecharModal(); } }));
        if (r.tipo !== 'visitante' && r.usuario && r.usuario.email && !Sessao.backend) {
          raizEl.appendChild(el('button', {
            class: 'dgo-b dgo-b2', type: 'button', texto: t('trocarSenha'),
            onclick: function () { abrirTrocaDeSenha(r.usuario.email); }
          }));
        }
        if (cfg.login.biometria && Biometria.suportada() && r.tipo !== 'visitante') {
          raizEl.appendChild(el('button', {
            class: 'dgo-b dgo-b2', type: 'button',
            texto: Biometria.registrada() ? t('biometriaAtiva') : t('ativarBiometria'),
            onclick: function () {
              if (Biometria.registrada()) { Biometria.remover(); abrirConfiguracoes(opcoes); }
              else Biometria.registrar(r.usuario && r.usuario.email).then(function () { abrirConfiguracoes(opcoes); }).catch(function () {});
            }
          }));
        }
      } else {
        raizEl.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('entrar'),
          onclick: function () { fecharModal(); abrirLogin(); } }));
      }
      if (r.tipo === 'anunciante') {
        raizEl.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('painelAnunciante'),
          onclick: function () { abrirPainelAnunciante(); } }));
      }
    }

    if (tem('notificacoes') && cfg.notificacoes.ativo) {
      raizEl.appendChild(el('h3', { texto: t('notificacoes') }));
      raizEl.appendChild(montarNotificacoes());
    }

    if (tem('nuvem')) {
      raizEl.appendChild(el('h3', { texto: t('nuvem') }));
      var msgN = el('div');
      function nuvemAviso(txt, tipo) { msgN.innerHTML = ''; msgN.appendChild(aviso(txt, tipo)); }
      var dadosApp = function () {
        return (typeof opcoes.dados === 'function') ? opcoes.dados() : (opcoes.dados || API.exportarDados());
      };
      var l1 = el('div', { class: 'dgo-linha' });
      l1.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('conectarDrive'), onclick: function () {
        Nuvem.google.conectar().then(function () { nuvemAviso('Google Drive: OK', 'ok'); })
          .catch(function () { nuvemAviso(t('naoConfigurado'), 'erro'); });
      } }));
      l1.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('conectarOneDrive'), onclick: function () {
        Nuvem.microsoft.conectar().then(function () { nuvemAviso('OneDrive: OK', 'ok'); })
          .catch(function () { nuvemAviso(t('naoConfigurado'), 'erro'); });
      } }));
      raizEl.appendChild(l1);
      var l2 = el('div', { class: 'dgo-linha' });
      l2.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('enviarNuvem'), onclick: function () {
        var p = Nuvem.conectado();
        if (!p) { nuvemAviso(t('naoConfigurado'), 'erro'); return; }
        Nuvem[p === 'google' ? 'google' : 'microsoft'].enviar(dadosApp())
          .then(function () { nuvemAviso('OK  ' + formatarData(new Date(), null, true), 'ok'); })
          .catch(function () { nuvemAviso(t('naoConfigurado'), 'erro'); });
      } }));
      l2.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('baixarNuvem'), onclick: function () {
        var p = Nuvem.conectado();
        if (!p) { nuvemAviso(t('naoConfigurado'), 'erro'); return; }
        Nuvem[p === 'google' ? 'google' : 'microsoft'].baixar().then(function (dd) {
          if (dd && typeof opcoes.aoRestaurar === 'function') opcoes.aoRestaurar(dd);
          else if (dd) API.importarDados(dd);
          nuvemAviso('OK', 'ok');
        }).catch(function () { nuvemAviso(t('naoConfigurado'), 'erro'); });
      } }));
      raizEl.appendChild(l2);
      var l3 = el('div', { class: 'dgo-linha' });
      l3.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('salvarArquivo'), onclick: function () {
        Nuvem.salvarArquivo(dadosApp(), cfg.app + '-' + new Date().toISOString().slice(0, 10) + '.json');
      } }));
      l3.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('abrirArquivo'), onclick: function () {
        Nuvem.abrirArquivo().then(function (dd) {
          if (typeof opcoes.aoRestaurar === 'function') opcoes.aoRestaurar(dd); else API.importarDados(dd);
          nuvemAviso('OK', 'ok');
        }).catch(function () {});
      } }));
      raizEl.appendChild(l3);
      raizEl.appendChild(msgN);
      raizEl.appendChild(el('div', { class: 'dgo-mini', texto: Idioma.atual === 'en'
        ? 'The app only sees its own private folder in your drive.'
        : 'O app so enxerga a pasta privada dele dentro do seu drive.' }));
    }

    if (tem('rede')) {
      raizEl.appendChild(el('h3', { texto: t('redeTitulo') }));
      raizEl.appendChild(el('div', { class: 'dgo-mini', texto: t('redeAgora') + ': ' + Rede.rotuloTipo() +
        (Rede.economia() ? '  ·  ' + (Idioma.atual === 'en' ? 'data saver on' : 'economia de dados ligada') : '') }));
      [['pesado', t('redePesado')], ['ia', t('redeIA')]].forEach(function (par) {
        var sel = el('select');
        [['sempre', t('redeSempre')], ['wifi', t('redeWifi')], ['nunca', t('redeNunca')]].forEach(function (o) {
          var op = el('option', { value: o[0], texto: o[1] });
          if (Rede.preferencia(par[0]) === o[0]) op.selected = true;
          sel.appendChild(op);
        });
        sel.addEventListener('change', function () { Rede.definir(par[0], sel.value); });
        raizEl.appendChild(el('label', { class: 'dgo-campo' }, [el('span', { texto: par[1] }), sel]));
      });
      if (Rede.tipo() === 'desconhecido') {
        raizEl.appendChild(el('div', { class: 'dgo-mini', texto: Idioma.atual === 'en'
          ? 'This browser does not say whether it is on Wi-Fi or data. "Wi-Fi only" then blocks only when the browser asks for data saving.'
          : 'Este navegador não diz se está no Wi-Fi ou em dados. "Só no Wi-Fi" então só bloqueia quando o navegador pede economia de dados.' }));
      }
    }

    if (tem('ia') && cfg.ia.ativo) {
      raizEl.appendChild(el('h3', { texto: t('perguntarIA') }));
      var lIA = el('div', { class: 'dgo-linha' });
      lIA.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('perguntarIA'),
        onclick: abrirIA }));
      lIA.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('cofreChaves'),
        onclick: abrirChaves }));
      raizEl.appendChild(lIA);
      var prontos = IA.provedoresProntos();
      raizEl.appendChild(el('div', { class: 'dgo-mini', texto: prontos.length
        ? (t('qualUsar') + ': ' + PROVEDORES[IA.provedor()].nome)
        : t('semChave') }));
    }

    if (tem('ocr') && cfg.ocr.ativo) {
      raizEl.appendChild(el('h3', { texto: t('escanear') }));
      raizEl.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('usarCamera'),
        onclick: function () { abrirOCR({}); } }));
    }

    if (tem('app')) {
      raizEl.appendChild(el('h3', { texto: nomeApp() }));
      var lApp = el('div', { class: 'dgo-linha' });
      lApp.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('compartilhar'),
        onclick: function () { compartilhar({ titulo: nomeApp() }); } }));
      if (PWA.prompt) {
        lApp.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('instalarApp'),
          onclick: function () { PWA.instalar(); } }));
      } else if (PWA.instalado()) {
        lApp.appendChild(el('div', { class: 'dgo-mini', texto: t('appInstalado') }));
      }
      raizEl.appendChild(lApp);
      raizEl.appendChild(el('div', { class: 'dgo-mini', texto:
        t('versao') + ' ' + (cfg.versaoApp || '-') + '   |   Diretrizes ' + VERSAO +
        '   |   ' + Plataforma.qual() }));
    }

    if (opcoes.destino) {
      var dest = typeof opcoes.destino === 'string' ? $(opcoes.destino) : opcoes.destino;
      if (dest) { dest.innerHTML = ''; dest.appendChild(raizEl); }
    }
    return raizEl;
  }

  function abrirTrocaDeSenha(identificador) {
    var caixa = el('div', { class: 'dgo-caixa' });
    caixa.appendChild(el('h2', { texto: t('trocarSenha') }));
    var cA = campo(t('senhaAtual'), { type: 'password', autocomplete: 'current-password' });
    var cN1 = campo(t('novaSenha'), { type: 'password', autocomplete: 'new-password' });
    var cN2 = campo(t('confirmarNovaSenha'), { type: 'password', autocomplete: 'new-password' });
    [cA, cN1, cN2].forEach(function (x) { caixa.appendChild(x); });
    var msg = el('div');
    caixa.appendChild(el('button', {
      class: 'dgo-b', type: 'button', texto: t('salvar'),
      onclick: function () {
        msg.innerHTML = '';
        if (cN1._input.value !== cN2._input.value) { msg.appendChild(aviso(t('senhasDiferentes'), 'erro')); return; }
        var b = this; b.disabled = true;
        Contas.trocarSenha(identificador, cA._input.value, cN1._input.value)
          .then(function () { msg.appendChild(aviso(t('senhaTrocada'), 'ok')); })
          .catch(function (e) {
            var m = (e && e.message) || '';
            msg.appendChild(aviso(m === 'senha-curta' ? t('senhaCurta') : t('dadosErrados'), 'erro'));
          })
          .then(function () { b.disabled = false; });
      }
    }));
    caixa.appendChild(msg);
    caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('fechar'), onclick: fecharModal }));
    return abrirModal(caixa, function () { abrirTrocaDeSenha(identificador); });
  }

  function abrirConfiguracoes(opcoes) {
    var caixa = el('div', { class: 'dgo-caixa' });
    caixa.appendChild(el('h2', { texto: t('configuracoes') }));
    caixa.appendChild(montarConfiguracoes(opcoes || {}));
    caixa.appendChild(el('div', { class: 'dgo-sep' }));
    caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('fechar'), onclick: fecharModal }));
    return abrirModal(caixa, function () { abrirConfiguracoes(opcoes); });
  }

  /* ------------------------------------------------------------------
     19. PAINEL DO ANUNCIANTE
     ------------------------------------------------------------------ */
  function campanhas() { return Guardar.ler('campanhas', [], true) || []; }
  function gravarCampanhas(l) { Guardar.gravar('campanhas', l, true); }

  function abrirPainelAnunciante() {
    function montar() {
      var caixa = el('div', { class: 'dgo-caixa dgo-larga' });
      caixa.appendChild(el('h2', { texto: t('painelAnunciante') }));
      var tot = Anuncios.totais();
      var res = el('div', { class: 'dgo-linha' });
      [[t('exibicoes'), tot.exibicao], [t('cliques'), tot.clique],
       ['CTR', (tot.exibicao ? ((tot.clique / tot.exibicao) * 100).toFixed(1) : '0.0') + '%']].forEach(function (p) {
        res.appendChild(el('div', { style: { background: '#0b1220', border: '1px solid rgba(255,255,255,.12)',
          borderRadius: '12px', padding: '12px' } }, [
          el('div', { class: 'dgo-mini', texto: p[0] }),
          el('div', { style: { fontSize: '22px', fontWeight: '700', color: '#fff' }, texto: String(p[1]) })
        ]));
      });
      caixa.appendChild(res);

      caixa.appendChild(el('h3', { texto: t('campanhas') }));
      var lista = campanhas();
      if (!lista.length) caixa.appendChild(aviso(t('semCampanhas'), 'info'));
      lista.forEach(function (c, i) {
        var linha = el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center',
          padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.08)' } }, [
          el('div', { style: { flex: '1' } }, [
            el('div', { style: { fontWeight: '600', color: '#e2e8f0' }, texto: c.titulo }),
            el('div', { class: 'dgo-mini', texto: formatarData(c.inicio) + ' ' + t('ate') + ' ' + formatarData(c.fim) })
          ]),
          el('button', { class: 'dgo-b dgo-b2', style: { width: 'auto', minHeight: '34px', marginTop: '0' },
            type: 'button', texto: c.ativa ? t('ativa') : t('pausada'),
            onclick: function () { lista[i].ativa = !lista[i].ativa; gravarCampanhas(lista); redesenhar(); } })
        ]);
        caixa.appendChild(linha);
      });

      caixa.appendChild(el('h3', { texto: t('novaCampanha') }));
      var cT = campo(t('titulo'), { type: 'text' });
      var cL = campo(t('linkDestino'), { type: 'url', placeholder: 'https://' });
      var cI = campo(t('imagemUrl'), { type: 'url', placeholder: 'https://' });
      var cD1 = campo(t('periodo'), { type: 'date' });
      var cD2 = campo(t('ate'), { type: 'date' });
      [cT, cL, cI].forEach(function (x) { caixa.appendChild(x); });
      var lp = el('div', { class: 'dgo-linha' }); lp.appendChild(cD1); lp.appendChild(cD2);
      caixa.appendChild(lp);
      caixa.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('salvar'), onclick: function () {
        if (!cT._input.value.trim()) return;
        var l = campanhas();
        l.push({ titulo: cT._input.value.trim(), link: cL._input.value.trim(), imagem: cI._input.value.trim(),
                 inicio: cD1._input.value, fim: cD2._input.value, ativa: true, criada: new Date().toISOString() });
        gravarCampanhas(l); redesenhar();
      } }));
      caixa.appendChild(el('div', { class: 'dgo-sep' }));
      caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('fechar'), onclick: fecharModal }));
      return caixa;
    }
    function redesenhar() { abrirModal(montar(), abrirPainelAnunciante); }
    redesenhar();
  }

  /* ------------------------------------------------------------------
     19-B. NOTIFICACOES (push)
     ------------------------------------------------------------------
     Funciona em: Chrome, Edge, Firefox e Opera no computador; Chrome e
     Samsung Internet no Android; Safari no Mac; iPhone e iPad a partir do
     iOS 16.4, desde que o app esteja instalado na Tela de Inicio.
     Dentro de um app nativo ou de uma WebView, basta ligar o adaptador
     Plataforma.adaptadores.notificacoes e tudo passa por ele.

     Sem servidor da-se para: pedir permissao, mostrar avisos e agendar
     lembretes que disparam com o app aberto ou na proxima abertura.
     Com servidor (chave VAPID) o aparelho fica inscrito e recebe avisos
     mesmo com o app fechado.
     ------------------------------------------------------------------ */
  function prefLer(chave, padrao) {
    try {
      var v = raiz.localStorage.getItem('dgo:' + cfg.app + ':pref:' + chave);
      return v === null ? padrao : JSON.parse(v);
    } catch (e) { return padrao; }
  }
  function prefGravar(chave, valor) {
    try { raiz.localStorage.setItem('dgo:' + cfg.app + ':pref:' + chave, JSON.stringify(valor)); } catch (e) {}
  }

  function minutosDoDia(hhmm) {
    var p = String(hhmm || '').split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  function base64ParaUint8(base64) {
    var pad = '='.repeat((4 - base64.length % 4) % 4);
    var b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    var bruto = raiz.atob(b64), saida = new Uint8Array(bruto.length), i;
    for (i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
    return saida;
  }

  var Notif = {
    _relogio: null,

    nativo: function () { return Plataforma.adaptadores.notificacoes || null; },

    suporte: function () { return Notif.nativo() ? true : ('Notification' in raiz); },

    ehApple: function () {
      return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
             (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
    },

    precisaInstalar: function () {
      /* no iPhone e no iPad o aviso so chega com o app na Tela de Inicio */
      return !Notif.nativo() && Notif.ehApple() && !PWA.instalado() && !('Notification' in raiz);
    },

    permissao: function () {
      if (Notif.nativo()) return prefLer('notif-permissao-nativa', 'default');
      if (!('Notification' in raiz)) return 'sem-suporte';
      return Notification.permission;            // 'default' | 'granted' | 'denied'
    },

    estado: function () {
      return {
        suporte: Notif.suporte(),
        permissao: Notif.permissao(),
        precisaInstalar: Notif.precisaInstalar(),
        inscrito: !!prefLer('push-inscrito', false),
        plataforma: Plataforma.qual(),
        emSilencio: Notif.emSilencio(),
        tiposLigados: (cfg.notificacoes.tipos || []).filter(function (tp) { return Notif.ligado(tp.id); })
                        .map(function (tp) { return tp.id; })
      };
    },

    /* ---- tipos de aviso, um a um ---- */
    tipos: function () { return cfg.notificacoes.tipos || []; },
    tipo: function (id) {
      var l = Notif.tipos(), i;
      for (i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
      return null;
    },
    ligado: function (id) {
      if (!id) return true;
      var tp = Notif.tipo(id);
      if (!tp) return true;                       // tipo nao declarado: nao bloqueia
      return prefLer('notif:' + id, tp.padrao !== false);
    },
    ligar: function (id, valor) {
      prefGravar('notif:' + id, !!valor);
      d.dispatchEvent(new CustomEvent('dgo:notificacoes', { detail: { tipo: id, ligado: !!valor } }));
      return !!valor;
    },

    /* ---- horario silencioso ---- */
    silencio: function (novo) {
      if (novo) prefGravar('notif-silencio', novo);
      return prefLer('notif-silencio', cfg.notificacoes.horarioSilencioso);
    },
    emSilencio: function (quando) {
      var h = Notif.silencio();
      if (!h || !h.ativo) return false;
      var agora = quando ? new Date(quando) : new Date();
      var m = agora.getHours() * 60 + agora.getMinutes();
      var i = minutosDoDia(h.inicio), f = minutosDoDia(h.fim);
      return (i <= f) ? (m >= i && m < f) : (m >= i || m < f);   // trata a virada da meia-noite
    },

    /* ---- permissao ---- */
    pedirPermissao: function () {
      var nat = Notif.nativo();
      if (nat && nat.pedirPermissao) {
        return Promise.resolve(nat.pedirPermissao()).then(function (r) {
          prefGravar('notif-permissao-nativa', r ? 'granted' : 'denied');
          return r ? 'granted' : 'denied';
        });
      }
      if (!('Notification' in raiz)) return Promise.resolve('sem-suporte');
      if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
      try {
        var r = Notification.requestPermission(function () {});
        return (r && r.then ? r : Promise.resolve(Notification.permission)).then(function (p) {
          prefGravar('notif-pedido-em', new Date().toISOString());
          if (p === 'granted' && cfg.notificacoes.vapidPublicKey) Notif.inscrever().catch(function () {});
          return p;
        });
      } catch (e) { return Promise.resolve(Notification.permission); }
    },

    /* ---- mostrar um aviso agora ---- */
    mostrar: function (tipoId, conteudo) {
      conteudo = conteudo || {};
      if (typeof tipoId === 'object') { conteudo = tipoId; tipoId = conteudo.tipo; }
      if (!cfg.notificacoes.ativo) return Promise.resolve(false);
      if (!Notif.ligado(tipoId)) return Promise.resolve(false);
      if (!conteudo.urgente && Notif.emSilencio()) {
        Notif.guardarNaCaixa(tipoId, conteudo);         // guarda para o fim do silencio
        return Promise.resolve(false);
      }
      var nat = Notif.nativo();
      if (nat && nat.mostrar) return Promise.resolve(nat.mostrar(tipoId, conteudo)).then(function () { return true; });
      if (Notif.permissao() !== 'granted') return Promise.resolve(false);

      var tp = Notif.tipo(tipoId) || {};
      var titulo = conteudo.titulo || (tp.nome ? (tp.nome[Idioma.atual] || tp.nome.pt) : nomeApp());
      var opcoes = {
        body: conteudo.texto || '',
        icon: conteudo.icone || cfg.notificacoes.icone,
        badge: conteudo.distintivo || cfg.notificacoes.distintivo,
        tag: conteudo.tag || tipoId || 'dgo',
        renotify: !!conteudo.repetirAviso,
        requireInteraction: !!conteudo.fixar,
        silent: !!conteudo.mudo,
        lang: Idioma.atual === 'en' ? 'en' : 'pt-BR',
        timestamp: Date.now(),
        data: { url: conteudo.url || raiz.location.href, app: cfg.app, tipo: tipoId || null }
      };
      if (conteudo.acoes) opcoes.actions = conteudo.acoes;

      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        return navigator.serviceWorker.ready
          .then(function (reg) { return reg.showNotification(titulo, opcoes); })
          .then(function () { return true; })
          .catch(function () { return Notif._simples(titulo, opcoes); });
      }
      return Promise.resolve(Notif._simples(titulo, opcoes));
    },

    _simples: function (titulo, opcoes) {
      try {
        var n = new Notification(titulo, opcoes);
        n.onclick = function () { try { raiz.focus(); } catch (e) {} n.close(); };
        return true;
      } catch (e) { return false; }
    },

    /* avisos segurados durante o horario silencioso */
    guardarNaCaixa: function (tipoId, conteudo) {
      var caixa = prefLer('notif-caixa', []);
      caixa.push({ tipo: tipoId, conteudo: conteudo, em: new Date().toISOString() });
      prefGravar('notif-caixa', caixa.slice(-30));
    },
    esvaziarCaixa: function () {
      if (Notif.emSilencio()) return 0;
      var caixa = prefLer('notif-caixa', []);
      if (!caixa.length) return 0;
      prefGravar('notif-caixa', []);
      caixa.forEach(function (item) { Notif.mostrar(item.tipo, item.conteudo); });
      return caixa.length;
    },

    /* ---- lembretes agendados ---- */
    agenda: function () { return prefLer('notif-agenda', []); },
    agendar: function (tipoId, quando, conteudo, repetir) {
      conteudo = conteudo || {};
      var dt = paraData(quando);
      if (!dt) return null;
      var item = {
        id: 'lem_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        tipo: tipoId || null, quando: dt.toISOString(), repetir: repetir || null,
        titulo: conteudo.titulo || '', texto: conteudo.texto || '', url: conteudo.url || ''
      };
      var l = Notif.agenda(); l.push(item); prefGravar('notif-agenda', l);
      var nat = Notif.nativo();
      if (nat && nat.agendar) { try { nat.agendar(item); } catch (e) {} }
      return item.id;
    },
    cancelar: function (id) {
      var l = Notif.agenda().filter(function (x) { return x.id !== id; });
      prefGravar('notif-agenda', l);
      var nat = Notif.nativo();
      if (nat && nat.cancelar) { try { nat.cancelar(id); } catch (e) {} }
      return true;
    },
    verificarAgenda: function () {
      var l = Notif.agenda(), agora = Date.now(), mudou = false, restantes = [];
      l.forEach(function (item) {
        var t0 = new Date(item.quando).getTime();
        if (t0 <= agora) {
          mudou = true;
          Notif.mostrar(item.tipo, { titulo: item.titulo, texto: item.texto, url: item.url });
          if (item.repetir) {
            var prox = new Date(t0);
            if (item.repetir === 'diario') prox.setDate(prox.getDate() + 1);
            else if (item.repetir === 'semanal') prox.setDate(prox.getDate() + 7);
            else if (item.repetir === 'mensal') prox.setMonth(prox.getMonth() + 1);
            while (prox.getTime() <= agora) {
              if (item.repetir === 'diario') prox.setDate(prox.getDate() + 1);
              else if (item.repetir === 'semanal') prox.setDate(prox.getDate() + 7);
              else prox.setMonth(prox.getMonth() + 1);
            }
            item.quando = prox.toISOString();
            restantes.push(item);
          }
        } else { restantes.push(item); }
      });
      if (mudou) prefGravar('notif-agenda', restantes);
      return mudou;
    },

    /* ---- inscricao para receber com o app fechado (precisa de servidor) ---- */
    inscrito: function () { return !!prefLer('push-inscrito', false); },
    inscrever: function () {
      var nat = Notif.nativo();
      if (nat && nat.inscrever) {
        return Promise.resolve(nat.inscrever()).then(function (r) { prefGravar('push-inscrito', true); return r; });
      }
      if (!cfg.notificacoes.vapidPublicKey) return Promise.reject(new Error('sem-vapid'));
      if (!('serviceWorker' in navigator) || !('PushManager' in raiz)) return Promise.reject(new Error('sem-suporte'));
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription().then(function (atual) {
          return atual || reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64ParaUint8(cfg.notificacoes.vapidPublicKey)
          });
        });
      }).then(function (inscricao) {
        prefGravar('push-inscrito', true);
        prefGravar('push-inscricao', JSON.parse(JSON.stringify(inscricao)));
        if (!cfg.notificacoes.endpointInscricao) return inscricao;
        return fetch(cfg.notificacoes.endpointInscricao, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app: cfg.app, idioma: Idioma.atual, plataforma: Plataforma.qual(),
            usuario: (Sessao.usuario && Sessao.usuario.email) || null,
            tipos: Notif.estado().tiposLigados,
            inscricao: inscricao
          })
        }).then(function () { return inscricao; });
      });
    },
    cancelarInscricao: function () {
      prefGravar('push-inscrito', false);
      if (!('serviceWorker' in navigator)) return Promise.resolve(true);
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription();
      }).then(function (s) { return s ? s.unsubscribe() : true; }).catch(function () { return true; });
    },

    /* ---- numerinho no icone do app ---- */
    distintivo: function (quantos) {
      try {
        if (!quantos && navigator.clearAppBadge) return navigator.clearAppBadge();
        if (navigator.setAppBadge) return navigator.setAppBadge(quantos);
      } catch (e) {}
      return Promise.resolve();
    },

    /* ---- relogio interno: confere os lembretes enquanto o app esta aberto ---- */
    iniciar: function () {
      if (!cfg.notificacoes.ativo) return;
      Notif.verificarAgenda();
      Notif.esvaziarCaixa();
      if (Notif._relogio) clearInterval(Notif._relogio);
      Notif._relogio = setInterval(function () {
        Notif.verificarAgenda(); Notif.esvaziarCaixa();
      }, 30000);
      d.addEventListener('visibilitychange', function () {
        if (!d.hidden) { Notif.verificarAgenda(); Notif.esvaziarCaixa(); }
      });
      if ('serviceWorker' in navigator && navigator.serviceWorker.addEventListener) {
        navigator.serviceWorker.addEventListener('message', function (ev) {
          if (ev.data && ev.data.dgo === 'push') {
            d.dispatchEvent(new CustomEvent('dgo:push', { detail: ev.data.dados || {} }));
          }
        });
      }
      if (cfg.notificacoes.pedirNaAbertura && Notif.permissao() === 'default') {
        setTimeout(function () { Notif.pedirPermissao(); }, 4000);
      }
      if (Notif.permissao() === 'granted' && cfg.notificacoes.vapidPublicKey && !Notif.inscrito()) {
        Notif.inscrever().catch(function () {});
      }
    }
  };

  /* ---- painel de notificacoes ---- */
  function montarNotificacoes() {
    var caixa = el('div', { 'data-dgo-ui': '1' });
    var est = Notif.estado();

    if (!est.suporte) {
      caixa.appendChild(aviso(t('notifSemSuporte'), 'erro'));
      return caixa;
    }
    if (est.precisaInstalar || (Notif.ehApple() && !PWA.instalado())) {
      caixa.appendChild(aviso(t('notifIOS'), 'info'));
    }
    if (est.permissao === 'denied') {
      caixa.appendChild(aviso(t('notifBloqueadas'), 'erro'));
    } else if (est.permissao === 'granted') {
      caixa.appendChild(aviso(t('notifAtivas'), 'ok'));
    } else {
      caixa.appendChild(el('button', {
        class: 'dgo-b', type: 'button', texto: t('ativarNotificacoes'),
        onclick: function () { Notif.pedirPermissao().then(function () { abrirNotificacoes(); }); }
      }));
    }

    /* tipos de aviso deste app */
    var tipos = Notif.tipos();
    if (tipos.length) {
      caixa.appendChild(el('h3', { texto: t('avisosDoApp') }));
      tipos.forEach(function (tp) {
        var chk = el('input', { type: 'checkbox', style: { width: '20px', height: '20px', accentColor: cfg.cor } });
        chk.checked = Notif.ligado(tp.id);
        chk.addEventListener('change', function () { Notif.ligar(tp.id, chk.checked); });
        var descricao = tp.descricao ? (tp.descricao[Idioma.atual] || tp.descricao.pt) : '';
        caixa.appendChild(el('label', {
          style: { display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '9px 0',
                   borderBottom: '1px solid rgba(255,255,255,.08)', cursor: 'pointer' }
        }, [
          chk,
          el('div', { style: { flex: '1' } }, [
            el('div', { style: { color: '#e2e8f0', fontSize: '14px', fontWeight: '600' },
                        texto: tp.nome ? (tp.nome[Idioma.atual] || tp.nome.pt) : tp.id }),
            descricao ? el('div', { class: 'dgo-mini', texto: descricao }) : null
          ])
        ]));
      });
    }

    /* horario silencioso */
    var h = Notif.silencio();
    caixa.appendChild(el('h3', { texto: t('horarioSilencioso') }));
    var chkS = el('input', { type: 'checkbox', style: { width: '20px', height: '20px', accentColor: cfg.cor } });
    chkS.checked = !!(h && h.ativo);
    var cIni = campo('', { type: 'time', value: (h && h.inicio) || '22:00' });
    var cFim = campo(t('ate'), { type: 'time', value: (h && h.fim) || '07:00' });
    function gravarSilencio() {
      Notif.silencio({ ativo: chkS.checked, inicio: cIni._input.value, fim: cFim._input.value });
    }
    [chkS, cIni._input, cFim._input].forEach(function (x) { x.addEventListener('change', gravarSilencio); });
    caixa.appendChild(el('label', { style: { display: 'flex', gap: '10px', alignItems: 'center', margin: '6px 0 10px', cursor: 'pointer' } },
      [chkS, el('span', { style: { fontSize: '14px', color: '#e2e8f0' }, texto: t('horarioSilencioso') })]));
    var lh = el('div', { class: 'dgo-linha' }); lh.appendChild(cIni); lh.appendChild(cFim);
    caixa.appendChild(lh);

    /* receber com o app fechado */
    if (cfg.notificacoes.vapidPublicKey) {
      caixa.appendChild(el('h3', { texto: t('comAppFechado') }));
      if (Notif.inscrito()) {
        caixa.appendChild(aviso(t('inscrito'), 'ok'));
        caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('desconectar'),
          onclick: function () { Notif.cancelarInscricao().then(function () { abrirNotificacoes(); }); } }));
      } else {
        caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('comAppFechado'),
          onclick: function () { Notif.inscrever().then(function () { abrirNotificacoes(); }).catch(function () {}); } }));
      }
    }

    /* lembretes agendados */
    var l = Notif.agenda();
    caixa.appendChild(el('h3', { texto: t('lembretes') }));
    if (!l.length) caixa.appendChild(el('div', { class: 'dgo-mini', texto: t('semLembretes') }));
    l.forEach(function (item) {
      caixa.appendChild(el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '7px 0',
        borderBottom: '1px solid rgba(255,255,255,.08)' } }, [
        el('div', { style: { flex: '1' } }, [
          el('div', { style: { color: '#e2e8f0', fontSize: '13.5px' }, texto: item.titulo || item.tipo || '-' }),
          el('div', { class: 'dgo-mini', texto: formatarData(item.quando, null, true) + (item.repetir ? ('  ' + item.repetir) : '') })
        ]),
        el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('remover'),
          style: { width: 'auto', minHeight: '32px', marginTop: '0', padding: '6px 11px' },
          onclick: function () { Notif.cancelar(item.id); abrirNotificacoes(); } })
      ]));
    });

    /* teste */
    caixa.appendChild(el('button', {
      class: 'dgo-b dgo-b2', type: 'button', texto: t('testarAviso'),
      onclick: function () {
        Notif.pedirPermissao().then(function () {
          Notif.mostrar(null, { titulo: t('avisoTesteTitulo'), texto: t('avisoTesteTexto'), urgente: true });
        });
      }
    }));
    return caixa;
  }

  function abrirNotificacoes() {
    var caixa = el('div', { class: 'dgo-caixa' });
    caixa.appendChild(el('h2', { texto: t('notificacoes') }));
    caixa.appendChild(montarNotificacoes());
    caixa.appendChild(el('div', { class: 'dgo-sep' }));
    caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('fechar'), onclick: fecharModal }));
    return abrirModal(caixa, abrirNotificacoes);
  }

  /* ------------------------------------------------------------------
     19-C. MOTOR DE WIZARD
     ------------------------------------------------------------------
     A diretriz e oferecer a capacidade, nao um wizard pronto. Aqui esta
     o que e igual em qualquer wizard: sequencia, avancar e voltar,
     barra de progresso, pular, guardar o que ja foi respondido, retomar
     de onde parou e as duas linguas. Cada app declara os passos.

       DGO.wizard.definir('cadastro', {
         titulo: { pt:'Vamos comecar', en:'Let us start' },
         umaVezSo: true,
         passos: [
           { id:'idade', titulo:{pt:'Para quem e a historia?'},
             campos:[ { id:'faixa', tipo:'escolha', rotulo:{pt:'Idade'},
                        opcoes:[ {valor:'2-5', rotulo:{pt:'2 a 5 anos'}} ] } ] }
         ],
         aoConcluir: function (dados) { ... }
       });
       DGO.wizard.abrir('cadastro');
     ------------------------------------------------------------------ */
  var Wizard = {
    _defs: {},

    definir: function (id, def) {
      Wizard._defs[id] = def || {};
      if (def && def.abrirNaPrimeiraVez && !Wizard.feito(id)) {
        setTimeout(function () { Wizard.abrir(id); }, (def.atraso || 1) * 1000);
      }
      return id;
    },

    def: function (id) { return Wizard._defs[id] || null; },
    feito: function (id) { return !!prefLer('wizard:' + id + ':feito', false); },
    dados: function (id) { return prefLer('wizard:' + id + ':dados', {}) || {}; },
    reiniciar: function (id) {
      prefGravar('wizard:' + id + ':feito', false);
      prefGravar('wizard:' + id + ':dados', {});
      prefGravar('wizard:' + id + ':passo', 0);
    },

    txt: function (v, padrao) {
      if (v === undefined || v === null) return padrao || '';
      if (typeof v === 'string') return v;
      return v[Idioma.atual] || v.pt || padrao || '';
    },

    abrir: function (id, passoInicial) {
      var def = Wizard.def(id);
      if (!def || !def.passos || !def.passos.length) return null;
      if (def.umaVezSo && Wizard.feito(id) && passoInicial === undefined) return null;

      var dados = Wizard.dados(id);
      var i = (passoInicial !== undefined) ? passoInicial : (prefLer('wizard:' + id + ':passo', 0) || 0);
      if (i >= def.passos.length) i = 0;

      function guardar() {
        prefGravar('wizard:' + id + ':dados', dados);
        prefGravar('wizard:' + id + ':passo', i);
      }

      function concluir(pulou) {
        prefGravar('wizard:' + id + ':feito', true);
        prefGravar('wizard:' + id + ':passo', 0);
        guardar();
        fecharModal();
        if (pulou && typeof def.aoPular === 'function') { try { def.aoPular(dados); } catch (e) {} }
        if (!pulou && typeof def.aoConcluir === 'function') { try { def.aoConcluir(dados); } catch (e) {} }
        d.dispatchEvent(new CustomEvent('dgo:wizard', {
          detail: { wizard: id, concluido: !pulou, pulado: !!pulou, dados: dados }
        }));
      }

      function montar() {
        var passo = def.passos[i];
        var caixa = el('div', { class: 'dgo-caixa' });

        /* cabecalho: titulo do wizard + progresso */
        if (def.titulo) caixa.appendChild(el('div', { class: 'dgo-wz-topo', texto: Wizard.txt(def.titulo) }));
        var barra = el('div', { class: 'dgo-wz-barra' });
        def.passos.forEach(function (x, n) {
          barra.appendChild(el('i', { class: n <= i ? 'dgo-on' : '' }));
        });
        caixa.appendChild(barra);
        caixa.appendChild(el('div', { class: 'dgo-mini',
          texto: (i + 1) + ' / ' + def.passos.length }));

        if (passo.titulo) caixa.appendChild(el('h2', { texto: Wizard.txt(passo.titulo) }));
        if (passo.texto) caixa.appendChild(el('p', { texto: Wizard.txt(passo.texto) }));
        if (passo.html) caixa.appendChild(el('div', { html: passo.html }));

        var entradas = [];
        (passo.campos || []).forEach(function (c) {
          var valor = (dados[c.id] !== undefined) ? dados[c.id] : (c.padrao !== undefined ? c.padrao : '');
          var ent;
          if (c.tipo === 'escolha') {
            ent = el('select');
            (c.opcoes || []).forEach(function (o) {
              var op = el('option', { value: o.valor, texto: Wizard.txt(o.rotulo, o.valor) });
              if (String(valor) === String(o.valor)) op.selected = true;
              ent.appendChild(op);
            });
          } else if (c.tipo === 'sim-nao') {
            ent = el('input', { type: 'checkbox' });
            ent.checked = !!valor;
            ent.style.width = '20px'; ent.style.height = '20px'; ent.style.accentColor = cfg.cor;
          } else if (c.tipo === 'texto-longo') {
            ent = el('textarea', { rows: 4 });
            ent.value = valor;
          } else {
            var TIPOS = { texto: 'text', senha: 'password', email: 'email', numero: 'number',
                          data: 'date', hora: 'time', telefone: 'tel', link: 'url', cor: 'color' };
            ent = el('input', { type: TIPOS[c.tipo] || c.tipo || 'text' });
            ent.value = valor;
            if (c.dica) ent.setAttribute('placeholder', Wizard.txt(c.dica));
            if (c.tipo === 'email') ent.setAttribute('inputmode', 'email');
            if (c.tipo === 'numero') ent.setAttribute('inputmode', 'decimal');
          }
          var rotulo = Wizard.txt(c.rotulo, c.id);
          var linha;
          if (c.tipo === 'sim-nao') {
            linha = el('label', { style: { display: 'flex', gap: '10px', alignItems: 'center',
                                           margin: '8px 0', cursor: 'pointer' } },
                       [ent, el('span', { style: { fontSize: '14px', color: '#e2e8f0' }, texto: rotulo })]);
          } else {
            linha = el('label', { class: 'dgo-campo' }, [el('span', { texto: rotulo }), ent]);
          }
          if (c.ajuda) linha.appendChild(el('div', { class: 'dgo-mini', texto: Wizard.txt(c.ajuda) }));
          caixa.appendChild(linha);
          entradas.push({ campo: c, ent: ent });
        });

        var msg = el('div');

        function colher() {
          var faltou = null;
          entradas.forEach(function (x) {
            var v = (x.campo.tipo === 'sim-nao') ? x.ent.checked : x.ent.value;
            if (x.campo.obrigatorio && (v === '' || v === null || v === undefined)) {
              faltou = faltou || Wizard.txt(x.campo.rotulo, x.campo.id);
            }
            dados[x.campo.id] = v;
          });
          return faltou;
        }

        var acoes = el('div', { class: 'dgo-linha' });
        if (i > 0) {
          acoes.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('wzVoltar'),
            onclick: function () { colher(); i--; guardar(); abrirModal(montar(), function () { Wizard.abrir(id, i); }); } }));
        }
        acoes.appendChild(el('button', {
          class: 'dgo-b', type: 'button',
          texto: (i === def.passos.length - 1) ? t('wzConcluir') : t('wzAvancar'),
          onclick: function () {
            var faltou = colher();
            if (faltou) { msg.innerHTML = ''; msg.appendChild(aviso(t('wzObrigatorio') + ' ' + faltou, 'erro')); return; }
            if (typeof passo.aoSair === 'function') { try { passo.aoSair(dados); } catch (e) {} }
            if (i === def.passos.length - 1) { concluir(false); return; }
            i++; guardar();
            abrirModal(montar(), function () { Wizard.abrir(id, i); });
          }
        }));
        caixa.appendChild(acoes);
        caixa.appendChild(msg);

        if (def.pularVisivel !== false) {
          caixa.appendChild(el('button', {
            class: 'dgo-b dgo-b2', type: 'button', texto: t('wzPular'),
            style: { background: 'transparent', border: '0', color: '#94a3b8', minHeight: '36px' },
            onclick: function () { colher(); concluir(true); }
          }));
        }

        if (typeof passo.aoEntrar === 'function') { try { passo.aoEntrar(dados); } catch (e) {} }
        return caixa;
      }

      return abrirModal(montar(), function () { Wizard.abrir(id, i); });
    }
  };

  /* ------------------------------------------------------------------
     19-D. COFRE DE CHAVES E WIDGET DE IA
     ------------------------------------------------------------------
     Os repositórios são publicos: nenhuma chave pode morar no codigo.
     Entao a chave e da pessoa, colada uma vez e guardada no navegador.
     Como os apps moram todos em marceloneco.github.io, o cofre e um so
     e vale para os tres: cola no InvestifyONE, funciona no Contador.

     A chave NAO viaja para lugar nenhum a nao ser para o proprio
     provedor (Google, OpenAI, Anthropic). Nao passa por servidor meu.
     ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
     PROVEDORES DE IA
     ------------------------------------------------------------------
     Quase todos falam o mesmo formato (o da OpenAI): endereco/chat/completions
     com a chave no cabecalho. Entao existe UM adaptador generico com o
     endereco configuravel, e so o Gemini e a Anthropic tem adaptador proprio.
     Provedor novo no futuro = uma entrada nesta lista, ou o "Personalizado"
     com o endereco colado pela pessoa. Nada de codigo novo.

     gratis: tem plano sem pagar (limites conferidos em set/2026 - podem mudar)
     onde:   onde criar a chave
     base:   endereco da API (formato OpenAI), sem barra no fim
     ------------------------------------------------------------------ */
  function lerResposta(r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) {
        var m = (j && (j.error && (j.error.message || j.error.type))) || (j && j.message) || ('HTTP ' + r.status);
        var e = new Error(m); e.status = r.status; throw e;
      }
      return j;
    });
  }

  /* adaptador generico, formato OpenAI */
  function chamarCompativel(base, chave, modelo, sistema, mensagens, extras, limite) {
    var msgs = [];
    if (sistema) msgs.push({ role: 'system', content: sistema });
    mensagens.forEach(function (m) {
      msgs.push({ role: m.papel === 'ia' ? 'assistant' : 'user', content: m.texto });
    });
    var cab = { 'Content-Type': 'application/json' };
    if (chave) cab.Authorization = 'Bearer ' + chave;
    if (extras) for (var k in extras) cab[k] = extras[k];
    return fetch(base + '/chat/completions', {
      method: 'POST', headers: cab,
      body: JSON.stringify({ model: modelo, messages: msgs, max_tokens: limite || 900 })
    }).then(lerResposta).then(function (j) {
      return ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim();
    });
  }
  function listarCompativel(base, chave, extras) {
    var cab = {};
    if (chave) cab.Authorization = 'Bearer ' + chave;
    if (extras) for (var k in extras) cab[k] = extras[k];
    return fetch(base + '/models', { headers: cab }).then(lerResposta).then(function (j) {
      var lista = Array.isArray(j) ? j : (j.data || j.models || []);
      return lista.map(function (m) {
        var id = m.id || m.name || '';
        var gratis = /:free$/.test(id) ||
          (m.pricing && String(m.pricing.prompt) === '0' && String(m.pricing.completion) === '0');
        return { id: id, nome: m.name || id, gratis: !!gratis };
      }).filter(function (m) { return m.id; });
    });
  }

  function cabecalhosOpenRouter() {
    /* a OpenRouter pede para o site se identificar (nao e segredo, e atribuicao) */
    return { 'HTTP-Referer': raiz.location.origin, 'X-Title': nomeApp() };
  }

  var PROVEDORES = {
    openrouter: {
      nome: 'OpenRouter', gratis: true, ordem: 3,
      onde: 'https://openrouter.ai/keys',
      base: 'https://openrouter.ai/api/v1',
      modelo: 'openrouter/free',      /* roteador que escolhe um modelo gratis disponivel */
      nota: { pt: 'Modelos com ":free" no nome. Grátis: 20 pedidos por minuto e 50 por dia (1000 por dia se um dia comprar 10 dólares de crédito). Um cadastro, várias IAs.',
              en: 'Models ending in ":free". Free: 20 requests per minute and 50 per day (1000 per day if you ever buy 10 dollars of credit). One sign-up, many AIs.' },
      chamar: function (chave, modelo, sistema, msgs, limite) { return chamarCompativel(this.base, chave, modelo, sistema, msgs, cabecalhosOpenRouter(), limite); },
      listar: function (chave) { return listarCompativel(this.base, chave, cabecalhosOpenRouter()); }
    },
    groq: {
      nome: 'Groq', gratis: true, ordem: 2,
      onde: 'https://console.groq.com/keys',
      base: 'https://api.groq.com/openai/v1',
      modelo: 'llama-3.3-70b-versatile',
      nota: { pt: 'Muito rápido. Plano grátis com cerca de 30 pedidos por minuto e 1.000 por dia no modelo comum.',
              en: 'Very fast. Free plan around 30 requests per minute and 1,000 per day on the common model.' },
      chamar: function (chave, modelo, sistema, msgs, limite) { return chamarCompativel(this.base, chave, modelo, sistema, msgs, null, limite); },
      listar: function (chave) { return listarCompativel(this.base, chave); }
    },
    gemini: {
      nome: 'Google Gemini', gratis: true, ordem: 1,
      onde: 'https://aistudio.google.com/apikey',
      modelo: 'gemini-2.0-flash',
      nota: { pt: 'Plano grátis com limites que o Google mostra no AI Studio. Confira o aviso de privacidade ao criar a chave.',
              en: 'Free plan with limits shown by Google in AI Studio. Check the privacy notice when creating the key.' },
      chamar: function (chave, modelo, sistema, mensagens, limite) {
        var corpo = {
          contents: mensagens.map(function (m) {
            return { role: m.papel === 'ia' ? 'model' : 'user', parts: [{ text: m.texto }] };
          })
        };
        if (sistema) corpo.systemInstruction = { parts: [{ text: sistema }] };
        if (limite) corpo.generationConfig = { maxOutputTokens: limite };
        return fetch('https://generativelanguage.googleapis.com/v1beta/models/' +
                     encodeURIComponent(modelo) + ':generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
          body: JSON.stringify(corpo)
        }).then(lerResposta).then(function (j) {
          var c = j.candidates && j.candidates[0];
          var partes = c && c.content && c.content.parts;
          return (partes || []).map(function (x) { return x.text || ''; }).join('').trim();
        });
      },
      listar: function (chave) {
        return fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          headers: { 'x-goog-api-key': chave }
        }).then(lerResposta).then(function (j) {
          return (j.models || []).filter(function (m) {
            return (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1;
          }).map(function (m) {
            return { id: String(m.name || '').replace(/^models\//, ''), nome: m.displayName || m.name, gratis: true };
          });
        });
      }
    },
    mistral: {
      nome: 'Mistral', gratis: true, ordem: 4,
      onde: 'https://console.mistral.ai/api-keys',
      base: 'https://api.mistral.ai/v1',
      modelo: 'mistral-small-latest',
      nota: { pt: 'Tem plano grátis com limites apertados; os números aparecem dentro da conta depois de entrar.',
              en: 'Has a free plan with tight limits; the numbers show inside the account after signing in.' },
      chamar: function (chave, modelo, sistema, msgs, limite) { return chamarCompativel(this.base, chave, modelo, sistema, msgs, null, limite); },
      listar: function (chave) { return listarCompativel(this.base, chave); }
    },
    openai: {
      nome: 'OpenAI', gratis: false, ordem: 10,
      onde: 'https://platform.openai.com/api-keys',
      base: 'https://api.openai.com/v1',
      modelo: 'gpt-4o-mini',
      nota: { pt: 'Pago por uso, sem plano grátis.', en: 'Pay per use, no free plan.' },
      chamar: function (chave, modelo, sistema, msgs, limite) { return chamarCompativel(this.base, chave, modelo, sistema, msgs, null, limite); },
      listar: function (chave) { return listarCompativel(this.base, chave); }
    },
    anthropic: {
      nome: 'Anthropic Claude', gratis: false, ordem: 11,
      onde: 'https://console.anthropic.com/settings/keys',
      modelo: 'claude-3-5-haiku-20241022',
      nota: { pt: 'Pago por uso, sem plano grátis.', en: 'Pay per use, no free plan.' },
      chamar: function (chave, modelo, sistema, mensagens, limite) {
        var corpo = {
          model: modelo, max_tokens: limite || 900,
          messages: mensagens.map(function (m) {
            return { role: m.papel === 'ia' ? 'assistant' : 'user', content: m.texto };
          })
        };
        if (sistema) corpo.system = sistema;
        return fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': chave,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify(corpo)
        }).then(lerResposta).then(function (j) {
          return ((j.content || []).map(function (x) { return x.text || ''; }).join('')).trim();
        });
      },
      listar: function (chave) {
        return fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01',
                     'anthropic-dangerous-direct-browser-access': 'true' }
        }).then(lerResposta).then(function (j) {
          return (j.data || []).map(function (m) { return { id: m.id, nome: m.display_name || m.id, gratis: false }; });
        });
      }
    },
    personalizado: {
      nome: 'Outro (formato OpenAI)', gratis: null, ordem: 13,
      onde: '',
      base: '',                          /* a pessoa cola o endereco */
      modelo: '',
      nota: { pt: 'Qualquer serviço que fale o formato da OpenAI: Cerebras, Together, Hugging Face, um Ollama na sua rede… Cole o endereço da API e o nome do modelo.',
              en: 'Any service speaking the OpenAI format: Cerebras, Together, Hugging Face, an Ollama on your network… Paste the API address and the model name.' },
      chamar: function (chave, modelo, sistema, msgs, limite) {
        var base = IA.baseDe('personalizado');
        if (!base) return Promise.reject(new Error('sem-endereco'));
        return chamarCompativel(base, chave, modelo, sistema, msgs, null, limite);
      },
      listar: function (chave) {
        var base = IA.baseDe('personalizado');
        if (!base) return Promise.reject(new Error('sem-endereco'));
        return listarCompativel(base, chave);
      }
    }
  };

  var IA = {
    _conversa: [],
    cofreBackend: null,      /* futuro: { ler(), gravar(obj) } para sincronizar entre aparelhos */

    /* ---- cofre, compartilhado entre os apps (mesma origem) ---- */
    chaves: function () { return Guardar.ler('chaves-ia', {}, true) || {}; },
    chave: function (prov) { return IA.chaves()[prov] || ''; },
    definirChave: function (prov, valor) {
      var c = IA.chaves();
      if (valor) c[prov] = String(valor).trim(); else delete c[prov];
      Guardar.gravar('chaves-ia', c, true);
      if (IA.cofreBackend && IA.cofreBackend.gravar) { try { IA.cofreBackend.gravar(c); } catch (e) {} }
      d.dispatchEvent(new CustomEvent('dgo:ia-chaves', { detail: { provedor: prov, tem: !!valor } }));
      return true;
    },
    temChave: function (prov) {
      prov = prov || IA.provedor();
      if (PROVEDORES[prov] && PROVEDORES[prov].semChave) return true;
      /* um proxy no servidor dispensa chave no navegador */
      if (IA.proxyDe(prov)) return true;
      return !!IA.chave(prov);
    },

    /* ---- provedor e modelo escolhidos (valem para todos os apps) ---- */
    provedor: function () {
      var p = Guardar.ler('ia-provedor', null, true) || cfg.ia.provedorPadrao || 'openrouter';
      if (!PROVEDORES[p]) p = 'openrouter';
      return p;
    },
    definirProvedor: function (p) { if (PROVEDORES[p]) Guardar.gravar('ia-provedor', p, true); },
    modelo: function (prov) {
      prov = prov || IA.provedor();
      var escolhido = (Guardar.ler('ia-modelos', {}, true) || {})[prov];
      return escolhido || (cfg.ia.modelos && cfg.ia.modelos[prov]) || PROVEDORES[prov].modelo || '';
    },
    definirModelo: function (prov, modelo) {
      var m = Guardar.ler('ia-modelos', {}, true) || {};
      if (modelo) m[prov] = modelo; else delete m[prov];
      Guardar.gravar('ia-modelos', m, true);
    },
    baseDe: function (prov) {
      var extras = Guardar.ler('ia-enderecos', {}, true) || {};
      return String(extras[prov] || (cfg.ia.enderecos && cfg.ia.enderecos[prov]) || PROVEDORES[prov].base || '')
        .replace(/\/+$/, '');
    },
    definirBase: function (prov, url) {
      var e = Guardar.ler('ia-enderecos', {}, true) || {};
      if (url) e[prov] = String(url).trim().replace(/\/+$/, ''); else delete e[prov];
      Guardar.gravar('ia-enderecos', e, true);
    },
    /* futuro: um servidor seu que guarda a chave e repassa o pedido */
    proxyDe: function (prov) { return (cfg.ia.proxy && cfg.ia.proxy[prov]) || ''; },

    provedoresProntos: function () {
      completarProvedores();
      return Object.keys(PROVEDORES).filter(function (p) { return !PROVEDORES[p].soVoz && IA.temChave(p); })
        .sort(function (a, b) { return (PROVEDORES[a].ordem || 9) - (PROVEDORES[b].ordem || 9); });
    },
    provedoresOrdenados: function () {
      completarProvedores();
      return Object.keys(PROVEDORES).filter(function (p) { return !PROVEDORES[p].soVoz; }).sort(function (a, b) { return (PROVEDORES[a].ordem || 9) - (PROVEDORES[b].ordem || 9); });
    },

    listarModelos: function (prov) {
      prov = prov || IA.provedor();
      var pr = PROVEDORES[prov];
      if (!pr || !pr.listar) return Promise.resolve([]);
      return pr.listar(IA.chave(prov)).then(function (lista) {
        var cache = Guardar.ler('ia-lista-modelos', {}, true) || {};
        cache[prov] = { em: Date.now(), modelos: lista.slice(0, 400) };
        Guardar.gravar('ia-lista-modelos', cache, true);
        return lista;
      });
    },

    contexto: function () {
      var base = cfg.ia.contexto;
      var texto0 = (typeof base === 'function') ? base() : base;
      texto0 = (texto0 && typeof texto0 === 'object') ? (texto0[Idioma.atual] || texto0.pt) : texto0;
      var idioma = Idioma.atual === 'en'
        ? 'Answer in English, briefly and plainly.'
        : 'Responda em português do Brasil, com frases curtas e sem jargão.';
      return 'Você ajuda dentro do app "' + nomeApp() + '". ' + (texto0 || '') + ' ' + idioma;
    },

    /* ---- uso direto, sem interface ---- */
    perguntar: function (pergunta, opcoes) {
      opcoes = opcoes || {};
      var prov = opcoes.provedor || IA.provedor();
      var pr = PROVEDORES[prov];
      if (!pr) return Promise.reject(new Error('provedor-desconhecido'));
      if (!navigator.onLine) return Promise.reject(new Error('sem-internet'));
      if (!Rede.podeUsarIA()) return Promise.reject(new Error('so-wifi'));
      var msgs = opcoes.historico || [{ papel: 'pessoa', texto: pergunta }];
      var modelo = opcoes.modelo || IA.modelo(prov);
      var sistema = opcoes.contexto || IA.contexto();

      var proxy = IA.proxyDe(prov);
      if (proxy) {
        /* o servidor guarda a chave; o navegador so manda a pergunta */
        return fetch(proxy, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provedor: prov, modelo: modelo, sistema: sistema, mensagens: msgs, app: cfg.app, limite: opcoes.limite || null })
        }).then(lerResposta).then(function (j) { return String(j.texto || j.resposta || '').trim(); });
      }
      var chave = IA.chave(prov);
      if (!chave && prov !== 'personalizado') return Promise.reject(new Error('sem-chave'));
      /* opcoes.limite: tamanho maximo da resposta (textos longos, como termos) */
      return pr.chamar(chave, modelo, sistema, msgs, opcoes.limite);
    },

    limparConversa: function () { IA._conversa = []; }
  };

  /* ------------------------------------------------------------------
     REDE: wifi ou dados moveis? A pessoa decide o que pode baixar onde.
     A API de rede so existe no Chrome/Android; no iPhone e no Firefox a
     resposta e "nao sei" - e nesse caso a regra e nao bloquear, so
     respeitar o modo economia de dados quando o navegador avisa.
     ------------------------------------------------------------------ */
  var Rede = {
    tipo: function () {
      if (navigator.onLine === false) return 'offline';
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c) return 'desconhecido';
      if (c.type === 'wifi' || c.type === 'ethernet') return 'wifi';
      if (c.type === 'cellular') return 'dados';
      if (c.type === 'none') return 'offline';
      return 'desconhecido';
    },
    economia: function () {
      var c = navigator.connection;
      return !!(c && c.saveData);
    },
    preferencia: function (chave) {
      var padrao = cfg.rede && cfg.rede[chave];
      return prefLer('rede:' + chave, padrao || 'sempre');
    },
    definir: function (chave, valor) { prefGravar('rede:' + chave, valor); },

    /* 'sempre' | 'wifi' | 'nunca' -> pode fazer agora? */
    permite: function (chave) {
      var pref = Rede.preferencia(chave);
      var tipo = Rede.tipo();
      if (tipo === 'offline') return false;
      if (pref === 'nunca') return false;
      if (pref === 'sempre') return true;
      /* pref === 'wifi' */
      if (tipo === 'wifi') return true;
      if (tipo === 'dados') return false;
      return !Rede.economia();          /* desconhecido: deixa, a menos que o navegador peca economia */
    },
    podeBaixarPesado: function () { return Rede.permite('pesado'); },
    podeUsarIA: function () { return Rede.permite('ia'); },

    /* pergunta antes de um download grande, quando a preferencia for 'wifi' e a rede for dados */
    pedirPesado: function (descricao, tamanhoMB) {
      if (Rede.podeBaixarPesado()) return Promise.resolve(true);
      if (Rede.tipo() === 'offline') return Promise.resolve(false);
      return new Promise(function (ok) {
        var caixa = el('div', { class: 'dgo-caixa', style: { maxWidth: '380px' } });
        caixa.appendChild(el('h2', { texto: t('redeAviso') }));
        caixa.appendChild(el('p', { texto: (descricao || '') + (tamanhoMB ? ' (' + tamanhoMB + ' MB)' : '') }));
        caixa.appendChild(aviso(t('redeSoWifi'), 'info'));
        caixa.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('redeBaixarAgora'),
          onclick: function () { fecharModal(); ok(true); } }));
        caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('redeEsperarWifi'),
          onclick: function () { fecharModal(); ok(false); } }));
        abrirModal(caixa);
      });
    },

    rotuloTipo: function () {
      var tp = Rede.tipo();
      return tp === 'wifi' ? 'Wi-Fi' : tp === 'dados' ? t('redeDados') : tp === 'offline' ? t('redeOffline') : t('redeDesconhecida');
    }
  };

  /* ---------------- tela do cofre de chaves ---------------- */
  function notaProvedor(pr) {
    if (!pr.nota) return '';
    return (typeof pr.nota === 'string') ? pr.nota : (pr.nota[Idioma.atual] || pr.nota.pt || '');
  }
  function seloProvedor(pr) {
    if (pr.gratis === true) return el('em', { class: 'dgo-selo dgo-selo-ok', texto: t('gratis') });
    if (pr.gratis === false) return el('em', { class: 'dgo-selo dgo-selo-pago', texto: t('pago') });
    return null;
  }

  /* ------------------------------------------------------------------
     GUIA DE CHAVES: o que cada provedor faz, como pegar a chave (passo a
     passo para leigo), limites do plano gratis e teste da chave.
     Cada app herda isto: e o mesmo cofre e o mesmo guia em todos.
     Os passos vem com uma ilustracao desenhada; para trocar por um print
     de verdade, basta por na raiz do app um arquivo guia-<provedor>-<n>.png
     (ex.: guia-groq-2.png) - se existir, ele aparece no lugar do desenho.
     ------------------------------------------------------------------ */
  var CAPS = {
    texto: { icone: '✍️', pt: 'Texto e escrita', en: 'Text and writing',
             expl: { pt: 'Perguntar, escrever, resumir, melhorar textos, sugerir respostas.', en: 'Ask, write, summarise, improve texts, suggest replies.' } },
    stt:   { icone: '🎤', pt: 'Voz → texto', en: 'Speech → text',
             expl: { pt: 'Transcrever áudio e ditado (quando o navegador não devolve o texto).', en: 'Transcribe audio and dictation (when the browser gives no text).' } },
    tts:   { icone: '🔊', pt: 'Texto → voz', en: 'Text → speech',
             expl: { pt: 'Ler histórias, tutoriais e avisos em voz alta com voz natural.', en: 'Read stories, tutorials and notices aloud with a natural voice.' } },
    visao: { icone: '🖼️', pt: 'Imagens e documentos', en: 'Images and documents',
             expl: { pt: 'Entender fotos, rótulos, exames e PDFs (OCR com IA).', en: 'Understand photos, labels, lab results and PDFs (AI OCR).' } }
  };

  /* passos comuns, para nao repetir texto em cada provedor */
  function P(pt, en, ilu) { return { pt: pt, en: en, ilu: ilu || 'site' }; }
  function passosPadrao(nome, botaoConta, botaoChave, rotuloNome, extra) {
    var ps = [
      P('Toque em “Abrir o site”. Ele abre em outra aba; esta tela continua aqui esperando.',
        'Tap “Open the site”. It opens in another tab; this screen stays here waiting.', 'abrir'),
      P('Crie a conta (ou entre): ' + botaoConta + '. Use um e-mail seu; não precisa de cartão.',
        'Create the account (or sign in): ' + botaoConta + '. Use your own e-mail; no card needed.', 'conta'),
      P('Na página de chaves, toque em “' + botaoChave + '”.' + (rotuloNome ? ' Se pedir um nome, escreva “' + rotuloNome + '”.' : ''),
        'On the keys page, tap “' + botaoChave + '”.' + (rotuloNome ? ' If it asks for a name, type “' + rotuloNome + '”.' : ''), 'botao'),
      P('A chave aparece UMA vez. Toque no botão de copiar ao lado dela (não feche antes de copiar).',
        'The key shows ONCE. Tap the copy button next to it (do not close before copying).', 'copiar'),
      P('Volte para esta aba, cole a chave no campo abaixo e toque em “Salvar e testar”.',
        'Come back to this tab, paste the key in the field below and tap “Save and test”.', 'colar')
    ];
    if (extra) ps.splice(2, 0, extra);
    return ps;
  }
  function limiteTxt(pr) { return pr.limite ? (pr.limite[Idioma.atual] || pr.limite.pt) : ''; }

  /* provedores que nao conversam (so voz), mais os que conversam e tambem
     fazem voz - a lista de chat continua sendo os que tem cap 'texto' */
  function completarProvedores() {
    var X = PROVEDORES;
    X.openrouter.cap = ['texto']; X.openrouter.prefixo = 'sk-or-';
    X.openrouter.conta = { pt: 'Google, GitHub ou e-mail', en: 'Google, GitHub or e-mail' };
    X.openrouter.limite = { pt: 'Grátis nos modelos com “:free”: ~20 pedidos por minuto e 50 por dia (1.000/dia se um dia comprar US$ 10 de crédito). Sem cartão.',
                            en: 'Free on “:free” models: ~20 requests per minute and 50 per day (1,000/day if you ever buy US$ 10 of credit). No card.' };
    X.openrouter.passos = passosPadrao('OpenRouter', 'Sign in → Google ou e-mail', 'Create API Key', 'SolverONE');
    X.openrouter.serve = { pt: 'Um cadastro só dá acesso a dezenas de IAs (Llama, Qwen, Gemma, DeepSeek…). Ótimo para começar.', en: 'One sign-up gives access to dozens of AIs (Llama, Qwen, Gemma, DeepSeek…). Great to start.' };

    X.groq.cap = ['texto', 'stt']; X.groq.prefixo = 'gsk_';
    X.groq.conta = { pt: 'Google, GitHub ou e-mail', en: 'Google, GitHub or e-mail' };
    X.groq.limite = { pt: 'Grátis e muito rápido: ~30 pedidos por minuto e até 1.000 por dia no texto; transcrição (Whisper) com ~2 h de áudio por hora. Sem cartão.',
                      en: 'Free and very fast: ~30 requests per minute and up to 1,000 per day for text; transcription (Whisper) with ~2 h of audio per hour. No card.' };
    X.groq.passos = passosPadrao('Groq', 'Google, GitHub ou e-mail', 'Create API Key', 'SolverONE');
    X.groq.serve = { pt: 'Melhor opção grátis para voz → texto (Whisper) e respostas instantâneas.', en: 'Best free option for speech → text (Whisper) and instant answers.' };
    X.groq.stt = { url: 'https://api.groq.com/openai/v1/audio/transcriptions', modelo: 'whisper-large-v3-turbo' };

    X.gemini.cap = ['texto', 'stt', 'tts', 'visao']; X.gemini.prefixo = 'AIza';
    X.gemini.conta = { pt: 'conta Google', en: 'Google account' };
    X.gemini.limite = { pt: 'Grátis (AI Studio): centenas de pedidos por dia no Flash e Flash-Lite; a cota exata aparece na sua conta. Sem cartão. A voz (TTS) e a leitura de imagens também entram no grátis.',
                        en: 'Free (AI Studio): hundreds of requests per day on Flash and Flash-Lite; the exact quota shows in your account. No card. Voice (TTS) and image reading are free too.' };
    X.gemini.passos = passosPadrao('Google AI Studio', 'entrar com a conta Google e aceitar os termos', 'Create API key / Criar chave de API', null,
      P('Se pedir um projeto, toque em “Create API key in new project” (ele cria um projeto para você).',
        'If it asks for a project, tap “Create API key in new project” (it creates one for you).', 'botao'));
    X.gemini.serve = { pt: 'A mais completa grátis: texto, ouvir áudio, falar (voz natural) e ler imagens com uma chave só.', en: 'The most complete free one: text, hearing audio, speaking (natural voice) and reading images with a single key.' };
    X.gemini.tts = { modelo: 'gemini-2.5-flash-preview-tts' };

    X.mistral.cap = ['texto', 'stt', 'visao'];
    X.mistral.conta = { pt: 'e-mail + confirmação por celular', en: 'e-mail + phone verification' };
    X.mistral.limite = { pt: 'Plano “Experiment” grátis (pede número de celular): ~1 pedido por segundo e cota mensal. Sem cartão. Tem transcrição (Voxtral) e OCR.',
                         en: 'Free “Experiment” plan (asks for a phone number): ~1 request per second and a monthly quota. No card. Has transcription (Voxtral) and OCR.' };
    X.mistral.passos = passosPadrao('Mistral', 'e-mail ou Google; depois escolha o plano Experiment (grátis)', 'Nova chave / Create new key', 'SolverONE');
    X.mistral.serve = { pt: 'Boa em português e em ler documentos (OCR).', en: 'Good in Portuguese and at reading documents (OCR).' };
    X.mistral.stt = { url: 'https://api.mistral.ai/v1/audio/transcriptions', modelo: 'voxtral-mini-latest' };

    X.openai.cap = ['texto', 'stt', 'tts', 'visao']; X.openai.prefixo = 'sk-';
    X.openai.conta = { pt: 'e-mail, Google ou Apple + cartão', en: 'e-mail, Google or Apple + card' };
    X.openai.limite = { pt: 'Pago por uso (mínimo US$ 5 de crédito). Sem plano grátis. Tem voz → texto (Whisper), texto → voz e imagens.',
                        en: 'Pay per use (US$ 5 minimum credit). No free plan. Has speech → text (Whisper), text → speech and images.' };
    X.openai.passos = passosPadrao('OpenAI', 'e-mail, Google ou Apple; depois Billing → Add credit (US$ 5)', 'Create new secret key', 'SolverONE');
    X.openai.serve = { pt: 'Tudo numa conta só, com qualidade alta. Custa pouco para uso pessoal.', en: 'Everything in one account, high quality. Cheap for personal use.' };
    X.openai.stt = { url: 'https://api.openai.com/v1/audio/transcriptions', modelo: 'whisper-1' };
    X.openai.tts = { url: 'https://api.openai.com/v1/audio/speech', modelo: 'gpt-4o-mini-tts' };

    X.anthropic.cap = ['texto', 'visao']; X.anthropic.prefixo = 'sk-ant-';
    X.anthropic.conta = { pt: 'e-mail ou Google + cartão', en: 'e-mail or Google + card' };
    X.anthropic.limite = { pt: 'Pago por uso (compra de crédito antes). Sem plano grátis.', en: 'Pay per use (buy credit first). No free plan.' };
    X.anthropic.passos = passosPadrao('Anthropic Console', 'e-mail ou Google; depois Plans & billing → comprar crédito', 'Create Key', 'SolverONE');
    X.anthropic.serve = { pt: 'Claude: muito boa em textos longos e cuidadosos (termos, políticas).', en: 'Claude: very good at long, careful texts (terms, policies).' };

    X.personalizado.cap = ['texto'];
    X.personalizado.limite = { pt: 'Depende do serviço. Serve para Cerebras, Together, Hugging Face, um Ollama na sua rede…', en: 'Depends on the service. For Cerebras, Together, Hugging Face, an Ollama on your network…' };
    X.personalizado.passos = [P('Cole o endereço da API (termina em /v1), a chave e o nome do modelo, como o serviço informa.', 'Paste the API address (ends in /v1), the key and the model name, as the service states.', 'colar')];

    X.cerebras = {
      nome: 'Cerebras', gratis: null, ordem: 9, cap: ['texto'], prefixo: 'csk-',
      onde: 'https://cloud.cerebras.ai/', base: 'https://api.cerebras.ai/v1', modelo: 'llama-3.3-70b',
      conta: { pt: 'e-mail ou Google + cartão (não cobra)', en: 'e-mail or Google + card (not charged)' },
      limite: { pt: 'US$ 5 de crédito por 30 dias, mas pede um cartão para ativar. Muito rápido.', en: 'US$ 5 credit for 30 days, but asks for a card to activate. Very fast.' },
      nota: { pt: 'Crédito inicial de US$ 5 (30 dias); pede cartão.', en: 'US$ 5 starting credit (30 days); asks for a card.' },
      passos: passosPadrao('Cerebras Cloud', 'e-mail ou Google; adicionar cartão em Billing', 'Create API Key', 'SolverONE'),
      serve: { pt: 'Respostas quase instantâneas.', en: 'Near-instant answers.' },
      chamar: function (chave, modelo, sistema, msgs, limite) { return chamarCompativel(this.base, chave, modelo, sistema, msgs, null, limite); },
      listar: function (chave) { return listarCompativel(this.base, chave); }
    };
    X.deepseek = {
      nome: 'DeepSeek', gratis: false, ordem: 12, cap: ['texto'], prefixo: 'sk-',
      onde: 'https://platform.deepseek.com/api_keys', base: 'https://api.deepseek.com/v1', modelo: 'deepseek-chat',
      conta: { pt: 'e-mail ou Google + crédito', en: 'e-mail or Google + credit' },
      limite: { pt: 'Pago, mas muito barato (centavos por milhão de palavras). Sem plano grátis.', en: 'Paid but very cheap (cents per million words). No free plan.' },
      nota: { pt: 'Pago por uso, barato.', en: 'Pay per use, cheap.' },
      passos: passosPadrao('DeepSeek', 'e-mail ou Google; depois Top up (comprar crédito)', 'Create new API key', 'SolverONE'),
      serve: { pt: 'Barata e boa para textos longos.', en: 'Cheap and good for long texts.' },
      chamar: function (chave, modelo, sistema, msgs, limite) { return chamarCompativel(this.base, chave, modelo, sistema, msgs, null, limite); },
      listar: function (chave) { return listarCompativel(this.base, chave); }
    };
    /* so voz: nao entram na lista de chat */
    X.deepgram = {
      nome: 'Deepgram', gratis: true, ordem: 6, cap: ['stt'], soVoz: true,
      onde: 'https://console.deepgram.com/',
      conta: { pt: 'e-mail, Google ou GitHub', en: 'e-mail, Google or GitHub' },
      limite: { pt: 'US$ 200 de crédito ao criar a conta (dá centenas de horas de transcrição). Sem cartão. Depois, pago por minuto.',
                en: 'US$ 200 credit on sign-up (hundreds of hours of transcription). No card. Then pay per minute.' },
      nota: { pt: 'US$ 200 de crédito inicial; sem cartão.', en: 'US$ 200 starting credit; no card.' },
      passos: passosPadrao('Deepgram Console', 'e-mail, Google ou GitHub', 'Create a New API Key', 'SolverONE'),
      serve: { pt: 'Transcrição rápida e precisa, inclusive em tempo real.', en: 'Fast, accurate transcription, including real time.' },
      stt: { url: 'https://api.deepgram.com/v1/listen?model=nova-3&language=pt&smart_format=true', auth: 'Token' },
      testar: function (chave) { return fetch('https://api.deepgram.com/v1/projects', { headers: { Authorization: 'Token ' + chave } }).then(lerResposta); }
    };
    X.assemblyai = {
      nome: 'AssemblyAI', gratis: true, ordem: 7, cap: ['stt'], soVoz: true,
      onde: 'https://www.assemblyai.com/app/api-keys',
      conta: { pt: 'e-mail, Google ou GitHub', en: 'e-mail, Google or GitHub' },
      limite: { pt: 'US$ 50 de crédito ao criar a conta (dezenas de horas). Sem cartão. Depois, pago por hora.',
                en: 'US$ 50 credit on sign-up (tens of hours). No card. Then pay per hour.' },
      nota: { pt: 'US$ 50 de crédito inicial; sem cartão.', en: 'US$ 50 starting credit; no card.' },
      passos: passosPadrao('AssemblyAI', 'e-mail, Google ou GitHub', 'Copy API key', null),
      serve: { pt: 'Transcrição com resumo e identificação de quem fala.', en: 'Transcription with summary and speaker identification.' },
      stt: { url: 'https://api.assemblyai.com/v2', auth: 'plain' },
      testar: function (chave) { return fetch('https://api.assemblyai.com/v2/transcript?limit=1', { headers: { authorization: chave } }).then(lerResposta); }
    };
    X.elevenlabs = {
      nome: 'ElevenLabs', gratis: true, ordem: 8, cap: ['tts'], soVoz: true,
      onde: 'https://elevenlabs.io/app/settings/api-keys',
      conta: { pt: 'e-mail ou Google', en: 'e-mail or Google' },
      limite: { pt: 'Grátis: ~10 mil caracteres por mês (uns 10 minutos de áudio), só para uso pessoal. Planos pagos a partir de US$ 5/mês.',
                en: 'Free: ~10k characters per month (about 10 minutes of audio), personal use only. Paid plans from US$ 5/month.' },
      nota: { pt: '~10 min de áudio por mês grátis.', en: '~10 min of audio per month free.' },
      passos: passosPadrao('ElevenLabs', 'e-mail ou Google', 'Create API Key', 'SolverONE'),
      serve: { pt: 'As vozes mais naturais para ler histórias.', en: 'The most natural voices for reading stories.' },
      tts: { url: 'https://api.elevenlabs.io/v1/text-to-speech', auth: 'xi-api-key' },
      testar: function (chave) { return fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': chave } }).then(lerResposta); }
    };
    X.aparelho = {
      nome: { pt: 'Voz do aparelho', en: 'Device voice' }, gratis: true, ordem: 5, cap: ['tts', 'stt'], soVoz: true, semChave: true,
      onde: '',
      limite: { pt: 'Grátis e sem chave: usa a voz e o reconhecimento que já vêm no celular ou computador. Qualidade varia por aparelho.',
                en: 'Free and no key: uses the voice and recognition built into the phone or computer. Quality varies by device.' },
      passos: [P('Não precisa de chave. Para melhorar a voz no Android: Configurações → Conversão de texto em voz → instalar dados de voz em Português (Brasil).',
                 'No key needed. To improve the voice on Android: Settings → Text-to-speech → install Portuguese (Brazil) voice data.', 'site')],
      serve: { pt: 'Plano B que sempre funciona, até sem internet.', en: 'Plan B that always works, even offline.' }
    };
  }

  /* validacao leve: so o formato, para pegar chave colada pela metade */
  function chaveParece(prov, valor) {
    var pr = PROVEDORES[prov]; valor = String(valor || '').trim();
    if (!valor) return { ok: false, pt: 'Cole a chave.', en: 'Paste the key.' };
    if (/\s/.test(valor)) return { ok: false, pt: 'A chave tem espaço ou quebra de linha no meio: copie de novo, inteira.', en: 'The key has a space or line break inside: copy it again, whole.' };
    if (valor.length < 20) return { ok: false, pt: 'Curta demais: parece que faltou um pedaço.', en: 'Too short: looks like part is missing.' };
    if (pr && pr.prefixo && valor.indexOf(pr.prefixo) !== 0) return { ok: false, pt: 'Chave do ' + nomeProv(pr) + ' começa com “' + pr.prefixo + '”. Confira se copiou do site certo.', en: nomeProv(pr) + ' keys start with “' + pr.prefixo + '”. Check you copied from the right site.' };
    return { ok: true };
  }
  function nomeProv(pr) { return typeof pr.nome === 'string' ? pr.nome : (pr.nome[Idioma.atual] || pr.nome.pt); }
  function testarChave(prov, chave) {
    var pr = PROVEDORES[prov];
    if (pr.semChave) return Promise.resolve({ ok: true });
    if (pr.testar) return pr.testar(chave).then(function () { return { ok: true }; });
    if (pr.listar) return pr.listar(chave).then(function (l) { return { ok: true, modelos: l }; });
    return Promise.resolve({ ok: true, semTeste: true });
  }

  /* escolha por uso: texto continua sendo IA.provedor(); voz tem a sua */
  var PorUso = {
    ler: function () { return Guardar.ler('ia-por-uso', {}, true) || {}; },
    definir: function (cap, prov) { var m = PorUso.ler(); if (prov) m[cap] = prov; else delete m[cap]; Guardar.gravar('ia-por-uso', m, true);
      d.dispatchEvent(new CustomEvent('dgo:ia-uso', { detail: { cap: cap, provedor: prov } })); },
    provedor: function (cap) {
      if (cap === 'texto') return IA.provedor();
      var m = PorUso.ler(), p = m[cap];
      if (p && PROVEDORES[p] && (PROVEDORES[p].semChave || IA.temChave(p))) return p;
      var prontos = Object.keys(PROVEDORES).filter(function (k) { var pr = PROVEDORES[k]; return (pr.cap || []).indexOf(cap) !== -1 && !pr.semChave && IA.temChave(k); })
        .sort(function (a, b) { return (PROVEDORES[a].ordem || 9) - (PROVEDORES[b].ordem || 9); });
      if (prontos.length) return prontos[0];
      return (cap === 'tts' || cap === 'stt') ? 'aparelho' : '';
    },
    chave: function (cap) { var p = PorUso.provedor(cap); return p ? IA.chave(p) : ''; }
  };

  /* ---- ilustracao desenhada de cada passo (SVG), ou o print do app ---- */
  function iluPasso(prov, n, tipo, rotulo) {
    var pr = PROVEDORES[prov], nome = nomeProv(pr);
    var cor = 'var(--dgo-cor)';
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    var miolo = '';
    if (tipo === 'abrir') {
      miolo = '<rect x="20" y="52" width="200" height="44" rx="10" fill="' + cor + '"/><text x="120" y="80" font-size="15" font-weight="700" text-anchor="middle" fill="#04121f">' + esc(t('abrirSite')) + ' ↗</text>' +
        '<text x="120" y="122" font-size="11" text-anchor="middle" fill="#94a3b8">' + esc(nome) + '</text>';
    } else if (tipo === 'conta') {
      miolo = '<rect x="30" y="40" width="180" height="26" rx="6" fill="#0b1220" stroke="#334155"/><text x="40" y="57" font-size="11" fill="#64748b">e-mail</text>' +
        '<rect x="30" y="74" width="180" height="26" rx="6" fill="#0b1220" stroke="#334155"/><text x="40" y="91" font-size="11" fill="#64748b">••••••••</text>' +
        '<rect x="30" y="108" width="180" height="26" rx="6" fill="' + cor + '"/><text x="120" y="125" font-size="12" font-weight="700" text-anchor="middle" fill="#04121f">Sign up / Log in</text>';
    } else if (tipo === 'botao') {
      var r = rotulo || 'Create API Key';
      miolo = '<text x="24" y="52" font-size="12" fill="#94a3b8">API keys</text><line x1="24" y1="60" x2="216" y2="60" stroke="#334155"/>' +
        '<rect x="24" y="72" width="192" height="30" rx="7" fill="' + cor + '"/><text x="120" y="92" font-size="12" font-weight="700" text-anchor="middle" fill="#04121f">+ ' + esc(r) + '</text>' +
        '<circle cx="204" cy="87" r="16" fill="none" stroke="#f59e0b" stroke-width="3"/>';
    } else if (tipo === 'copiar') {
      miolo = '<text x="24" y="50" font-size="11" fill="#94a3b8">' + esc(t('suaChave')) + '</text>' +
        '<rect x="24" y="60" width="150" height="30" rx="7" fill="#0b1220" stroke="#334155"/><text x="34" y="80" font-size="12" font-family="monospace" fill="#e2e8f0">' + esc((pr.prefixo || 'sk-') + '••••••••') + '</text>' +
        '<rect x="182" y="60" width="34" height="30" rx="7" fill="' + cor + '"/><text x="199" y="81" font-size="15" text-anchor="middle" fill="#04121f">⎘</text>' +
        '<circle cx="199" cy="75" r="20" fill="none" stroke="#f59e0b" stroke-width="3"/><text x="120" y="120" font-size="11" text-anchor="middle" fill="#fbbf24">' + esc(t('umaVez')) + '</text>';
    } else if (tipo === 'colar') {
      miolo = '<text x="24" y="50" font-size="11" fill="#94a3b8">' + esc(nomeApp()) + ' → ' + esc(t('cofreChaves')) + '</text>' +
        '<rect x="24" y="60" width="192" height="30" rx="7" fill="#0b1220" stroke="' + cor + '" stroke-width="2"/><text x="34" y="80" font-size="12" font-family="monospace" fill="#e2e8f0">' + esc((pr.prefixo || 'sk-') + '••••••••••••') + '</text>' +
        '<rect x="24" y="100" width="192" height="28" rx="7" fill="' + cor + '"/><text x="120" y="118" font-size="12" font-weight="700" text-anchor="middle" fill="#04121f">' + esc(t('salvarTestar')) + '</text>';
    } else {
      miolo = '<text x="120" y="88" font-size="30" text-anchor="middle">⚙️</text>';
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" role="img" aria-hidden="true">' +
      '<rect x="0" y="0" width="240" height="140" rx="12" fill="#111a2e" stroke="#334155"/>' +
      '<rect x="0" y="0" width="240" height="24" rx="12" fill="#1e293b"/><circle cx="14" cy="12" r="4" fill="#ef4444"/><circle cx="26" cy="12" r="4" fill="#f59e0b"/><circle cx="38" cy="12" r="4" fill="#22c55e"/>' +
      '<text x="120" y="16" font-size="9" text-anchor="middle" fill="#94a3b8">' + esc(tipo === 'colar' ? location.host : (pr.onde || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '')) + '</text>' + miolo + '</svg>';
    var fig = el('figure', { class: 'dgo-guia-ilu' });
    var img = el('img', { src: 'guia-' + prov + '-' + n + '.png', alt: '', loading: 'lazy' });
    img.onerror = function () { fig.innerHTML = svg; };   /* sem print: fica o desenho */
    fig.appendChild(img);
    return fig;
  }

  function abrirChaves(provedorAberto, capInicial) {
    completarProvedores();
    var aberto = provedorAberto || '';
    var filtro = capInicial || Guardar.ler('ia-cofre-filtro', '', true) || '';
    if (aberto && !PROVEDORES[aberto]) aberto = '';

    function selos(pr) {
      var s = [];
      if (pr.gratis === true) s.push(el('em', { class: 'dgo-selo dgo-selo-ok', texto: t('gratis') }));
      else if (pr.gratis === false) s.push(el('em', { class: 'dgo-selo dgo-selo-pago', texto: t('pago') }));
      else if (pr.gratis === null && pr.conta) s.push(el('em', { class: 'dgo-selo', texto: t('pedeCartao') }));
      (pr.cap || []).forEach(function (c) { s.push(el('span', { class: 'dgo-cap', title: CAPS[c][Idioma.atual] || CAPS[c].pt, texto: CAPS[c].icone })); });
      return s;
    }
    function emUsoPara(p) {
      var usos = [];
      if (IA.provedor() === p && IA.temChave(p) && (PROVEDORES[p].cap || []).indexOf('texto') !== -1) usos.push(CAPS.texto.icone);
      ['stt', 'tts'].forEach(function (c) { if ((PROVEDORES[p].cap || []).indexOf(c) !== -1 && PorUso.provedor(c) === p) usos.push(CAPS[c].icone); });
      return usos;
    }
    function reabrir() { abrirModal(montar(), function () { abrirChaves(aberto, filtro); }); }

    function montar() {
      var caixa = el('div', { class: 'dgo-caixa dgo-larga dgo-cofre' });
      caixa.appendChild(el('h2', { texto: '🔑 ' + t('cofreChaves') }));
      caixa.appendChild(el('p', { class: 'dgo-mini', texto: t('cofreExplica') }));

      /* filtro: para que serve */
      var chips = el('div', { class: 'dgo-chips', role: 'tablist' });
      [['', t('tudo')]].concat(Object.keys(CAPS).map(function (c) { return [c, CAPS[c].icone + ' ' + (CAPS[c][Idioma.atual] || CAPS[c].pt)]; })).forEach(function (o) {
        chips.appendChild(el('button', { type: 'button', role: 'tab', class: 'dgo-chip' + (filtro === o[0] ? ' dgo-on' : ''), 'aria-selected': filtro === o[0] ? 'true' : 'false', texto: o[1],
          onclick: function () { filtro = o[0]; Guardar.gravar('ia-cofre-filtro', filtro, true); aberto = ''; reabrir(); } }));
      });
      caixa.appendChild(chips);
      if (filtro && CAPS[filtro]) caixa.appendChild(el('p', { class: 'dgo-mini', texto: CAPS[filtro].expl[Idioma.atual] || CAPS[filtro].expl.pt }));

      /* resumo do que esta em uso */
      var resumo = ['texto', 'stt', 'tts'].map(function (c) {
        var p = PorUso.provedor(c), ok = p && (PROVEDORES[p].semChave || IA.temChave(p));
        return CAPS[c].icone + ' ' + (ok ? nomeProv(PROVEDORES[p]) : '—');
      }).join('   ');
      caixa.appendChild(el('p', { class: 'dgo-mini', texto: t('emUsoAgora') + ': ' + resumo }));

      var lista = Object.keys(PROVEDORES).filter(function (p) { return !filtro || (PROVEDORES[p].cap || []).indexOf(filtro) !== -1; })
        .sort(function (a, b) { return (PROVEDORES[a].ordem || 9) - (PROVEDORES[b].ordem || 9); });

      lista.forEach(function (p) {
        var pr = PROVEDORES[p];
        var tem = pr.semChave || IA.temChave(p);
        var ehAberto = (p === aberto);
        var usos = emUsoPara(p);
        var cab = el('button', { type: 'button', class: 'dgo-prov-cab' + (ehAberto ? ' dgo-on' : ''), 'aria-expanded': ehAberto ? 'true' : 'false',
          onclick: function () { aberto = ehAberto ? '' : p; reabrir(); } }, [
          el('span', { class: 'dgo-prov-nome' }, [d.createTextNode(nomeProv(pr) + ' ')].concat(selos(pr)).concat([
            tem ? el('em', { class: 'dgo-selo dgo-selo-ok', texto: '✓' }) : null,
            usos.length ? el('em', { class: 'dgo-selo', texto: t('emUso') + ' ' + usos.join(' ') }) : null
          ])),
          el('span', { class: 'dgo-mini', texto: ehAberto ? '▴' : '▾' })
        ]);
        caixa.appendChild(cab);
        if (!ehAberto) return;

        var corpo = el('div', { class: 'dgo-prov-corpo' });
        if (pr.serve) corpo.appendChild(el('p', { class: 'dgo-serve', texto: (pr.serve[Idioma.atual] || pr.serve.pt) }));
        if (pr.limite) corpo.appendChild(el('p', { class: 'dgo-mini' }, [el('b', { texto: t('limitesTit') + ': ' }), d.createTextNode(limiteTxt(pr))]));
        if (pr.conta) corpo.appendChild(el('p', { class: 'dgo-mini' }, [el('b', { texto: t('contaTit') + ': ' }), d.createTextNode(pr.conta[Idioma.atual] || pr.conta.pt)]));

        if (pr.onde) {
          corpo.appendChild(el('a', { class: 'dgo-b', href: pr.onde, target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'none' },
            texto: t('abrirSite') + ' ↗ ' + nomeProv(pr) }));
        }

        /* guia passo a passo, aberto quando ainda nao ha chave */
        if (pr.passos && pr.passos.length) {
          var det = el('details', { class: 'dgo-guia' });
          if (!tem) det.open = true;
          det.appendChild(el('summary', { texto: '🧭 ' + t('guiaPasso') + ' (' + pr.passos.length + ')' }));
          var ol = el('ol', { class: 'dgo-guia-lista' });
          pr.passos.forEach(function (ps, i) {
            var rot = null;
            if (ps.ilu === 'botao') { var m = (ps[Idioma.atual] || ps.pt).match(/“([^”]+)”/); rot = m ? m[1].split(' / ')[0] : null; }
            ol.appendChild(el('li', {}, [el('p', { texto: ps[Idioma.atual] || ps.pt }), iluPasso(p, i + 1, ps.ilu, rot)]));
          });
          det.appendChild(ol);
          det.appendChild(el('p', { class: 'dgo-mini', texto: t('guiaPrintDica').replace('{arq}', 'guia-' + p + '-2.png') }));
          corpo.appendChild(det);
        }

        var msg = el('div');
        if (!pr.semChave) {
          if (p === 'personalizado') {
            var cB = campo(t('endereco'), { type: 'url', placeholder: 'https://…/v1', autocapitalize: 'none', spellcheck: 'false' });
            cB._input.value = IA.baseDe(p);
            cB._input.addEventListener('change', function () { IA.definirBase(p, cB._input.value); });
            corpo.appendChild(cB);
          }
          var cK = campo(t('chave') + ' — ' + nomeProv(pr), { type: 'password', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none',
            placeholder: IA.chave(p) ? '••••••••' : (pr.prefixo ? pr.prefixo + '…' : '') });
          cK._input.value = IA.chave(p);
          var olho = el('button', { type: 'button', class: 'dgo-olho', 'aria-label': t('mostrarChave'), texto: '👁', onclick: function () {
            cK._input.type = cK._input.type === 'password' ? 'text' : 'password'; } });
          cK.appendChild(olho);
          corpo.appendChild(cK);

          var cM = null, dl = null;
          if ((pr.cap || []).indexOf('texto') !== -1) {
            cM = campo(t('modelo'), { type: 'text', autocapitalize: 'none', spellcheck: 'false', list: 'dgo-modelos-' + p });
            cM._input.value = IA.modelo(p);
            dl = el('datalist', { id: 'dgo-modelos-' + p });
            var cache = (Guardar.ler('ia-lista-modelos', {}, true) || {})[p];
            (cache && cache.modelos || []).forEach(function (m) { dl.appendChild(el('option', { value: m.id })); });
            cM.appendChild(dl);
            corpo.appendChild(cM);
          }

          var l1 = el('div', { class: 'dgo-linha' });
          l1.appendChild(el('button', { class: 'dgo-b', type: 'button', texto: t('salvarTestar'), onclick: function () {
            var b = this, valor = cK._input.value.trim();
            var chk = chaveParece(p, valor);
            msg.innerHTML = '';
            if (!chk.ok && !(p === 'personalizado' && !valor)) { msg.appendChild(aviso(chk[Idioma.atual] || chk.pt, 'erro')); return; }
            IA.definirChave(p, valor);
            if (cM) IA.definirModelo(p, cM._input.value.trim());
            if ((pr.cap || []).indexOf('texto') !== -1 && IA.temChave(p) && !IA.provedoresProntos().filter(function (x) { return x !== p; }).length) IA.definirProvedor(p);
            b.disabled = true; msg.appendChild(aviso(t('testando'), 'info'));
            testarChave(p, valor).then(function (r) {
              msg.innerHTML = '';
              msg.appendChild(aviso(r.semTeste ? t('chaveSalva') : t('chaveOk'), 'ok'));
              if (r.modelos && dl) {
                var gratis = r.modelos.filter(function (m) { return m.gratis; });
                var usar = (gratis.length && pr.gratis) ? gratis : r.modelos;
                dl.innerHTML = ''; usar.slice(0, 300).forEach(function (m) { dl.appendChild(el('option', { value: m.id })); });
                if (cM && !cM._input.value && usar.length) { cM._input.value = usar[0].id; IA.definirModelo(p, usar[0].id); }
              }
              setTimeout(reabrir, 900);
            }).catch(function (e) {
              msg.innerHTML = '';
              var st = e && e.status;
              var txt = st === 401 || st === 403 ? t('chaveRecusada') : (!st && /fetch|network/i.test(String(e && e.message)) ? t('corsAviso') : t('erroIA') + ' ' + ((e && e.message) || ''));
              msg.appendChild(aviso(txt, st === 401 || st === 403 ? 'erro' : 'info'));
            }).then(function () { b.disabled = false; });
          } }));
          corpo.appendChild(l1);
        }

        /* usar para: texto / voz -> texto / texto -> voz */
        if (tem) {
          var lu = el('div', { class: 'dgo-linha dgo-usar' });
          (pr.cap || []).filter(function (c) { return c !== 'visao'; }).forEach(function (c) {
            var ativo = PorUso.provedor(c) === p;
            lu.appendChild(el('button', { class: 'dgo-b dgo-b2' + (ativo ? ' dgo-on' : ''), type: 'button', 'aria-pressed': ativo ? 'true' : 'false',
              texto: (ativo ? '✓ ' : '') + t('usarPara') + ' ' + CAPS[c].icone + ' ' + (CAPS[c][Idioma.atual] || CAPS[c].pt),
              onclick: function () { if (c === 'texto') IA.definirProvedor(p); else PorUso.definir(c, p); reabrir(); } }));
          });
          if (!pr.semChave) lu.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('remover'), onclick: function () {
            IA.definirChave(p, ''); ['stt', 'tts'].forEach(function (c) { if (PorUso.ler()[c] === p) PorUso.definir(c, ''); }); reabrir(); } }));
          corpo.appendChild(lu);
        }
        corpo.appendChild(msg);
        caixa.appendChild(corpo);
      });

      caixa.appendChild(aviso(t('chaveAvisoCusto') + ' ' + t('chaveNuncaChat'), 'info'));
      caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('fechar'), onclick: fecharModal }));
      return caixa;
    }
    return abrirModal(montar(), function () { abrirChaves(aberto, filtro); });
  }

  /* ---------------- widget de consulta ---------------- */
  function abrirIA() {
    if (cfg.niveis.ativo && cfg.ia.servico && !Niveis.pode(cfg.ia.servico)) {
      return Niveis.convite(cfg.ia.servico);
    }
    if (!IA.provedoresProntos().length) return abrirChaves();

    var caixa = el('div', { class: 'dgo-caixa dgo-larga' });
    caixa.appendChild(el('h2', { texto: '✨ ' + t('perguntarIA') }));

    /* escolha do provedor, como no desenho do BudgetONE */
    var sel = el('select', { 'aria-label': t('provedor') });
    sel.appendChild(el('option', { value: '', texto: t('escolhaProvedor') }));
    IA.provedoresOrdenados().forEach(function (p) {
      var pr = PROVEDORES[p], tem = IA.temChave(p);
      var o = el('option', { value: p, texto: pr.nome + (pr.gratis === true ? ' · ' + t('gratis') : '') + (tem ? '' : ' · ' + t('colarChave')) });
      if (p === IA.provedor() && tem) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      var p = sel.value;
      if (!p) return;
      if (!IA.temChave(p)) { fecharModal(); abrirChaves(p); return; }
      IA.definirProvedor(p); linhaTopo.textContent = rotuloTopo();
    });
    var topo = el('div', { class: 'dgo-linha' });
    topo.appendChild(el('div', { style: { flex: '2' } }, [sel]));
    topo.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('colarChave'),
      style: { marginTop: '0', minHeight: '40px' }, onclick: function () { fecharModal(); abrirChaves(sel.value || IA.provedor()); } }));
    caixa.appendChild(topo);

    function rotuloTopo() { return PROVEDORES[IA.provedor()].nome + ' · ' + (IA.modelo() || '—'); }
    var linhaTopo = el('div', { class: 'dgo-mini', texto: rotuloTopo() });
    caixa.appendChild(linhaTopo);

    var fio = el('div', { class: 'dgo-ia-fio' });
    caixa.appendChild(fio);

    function pintar() {
      fio.innerHTML = '';
      IA._conversa.forEach(function (m) {
        fio.appendChild(el('div', { class: 'dgo-ia-msg dgo-' + (m.papel === 'ia' ? 'ia' : 'eu'), texto: m.texto }));
      });
      fio.scrollTop = fio.scrollHeight;
    }

    var entrada = el('textarea', { rows: 2, class: 'dgo-ia-entrada', placeholder: t('escrevaPergunta') });

    if (!IA._conversa.length) {
      var sugs = cfg.ia.sugestoes || [];
      if (sugs.length) {
        var chips = el('div', { class: 'dgo-ia-chips' });
        sugs.forEach(function (sg) {
          var txt = (typeof sg === 'string') ? sg : (sg[Idioma.atual] || sg.pt);
          chips.appendChild(el('button', { type: 'button', texto: txt, onclick: function () { entrada.value = txt; enviar(); } }));
        });
        fio.appendChild(el('div', { class: 'dgo-mini', texto: t('sugestoes') }));
        fio.appendChild(chips);
      }
    } else { pintar(); }

    var bEnviar = el('button', { class: 'dgo-b', type: 'button', texto: t('perguntar') });

    function enviar() {
      var pergunta = entrada.value.trim();
      if (!pergunta) return;
      entrada.value = '';
      IA._conversa.push({ papel: 'pessoa', texto: pergunta });
      pintar();
      var pensando = el('div', { class: 'dgo-ia-msg dgo-ia dgo-pensando', texto: t('pensando') });
      fio.appendChild(pensando); fio.scrollTop = fio.scrollHeight;
      bEnviar.disabled = true;
      IA.perguntar(pergunta, { historico: IA._conversa.slice(-12) })
        .then(function (resposta) {
          IA._conversa.push({ papel: 'ia', texto: resposta || t('semResposta') });
          pintar();
        })
        .catch(function (e) {
          pensando.remove();
          var m = (e && e.message) || '';
          fio.appendChild(aviso(
            m === 'sem-chave' ? t('semChave') :
            m === 'sem-internet' ? t('semInternet') :
            m === 'so-wifi' ? t('soWifi') :
            m === 'sem-endereco' ? t('semEndereco') : (t('erroIA') + ' ' + m), 'erro'));
          fio.scrollTop = fio.scrollHeight;
        })
        .then(function () { bEnviar.disabled = false; });
    }

    entrada.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
    bEnviar.addEventListener('click', enviar);

    caixa.appendChild(entrada);
    var acoes = el('div', { class: 'dgo-linha' });
    acoes.appendChild(bEnviar);
    acoes.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('limparConversa'),
      onclick: function () { IA.limparConversa(); fecharModal(); abrirIA(); } }));
    caixa.appendChild(acoes);

    /* o que a IA recebe junto com a pergunta - transparencia, como no desenho */
    var det = el('details', { class: 'dgo-mini', style: { margin: '8px 0' } }, [
      el('summary', { texto: t('oQueAIARecebe') }),
      el('div', { style: { marginTop: '6px', whiteSpace: 'pre-wrap' }, texto: IA.contexto() })
    ]);
    caixa.appendChild(det);
    caixa.appendChild(el('div', { class: 'dgo-mini', texto: t('avisoIA') }));
    caixa.appendChild(el('button', { class: 'dgo-b dgo-b2', type: 'button', texto: t('fechar'), onclick: fecharModal }));
    return abrirModal(caixa, abrirIA);
  }


  /* ------------------------------------------------------------------
     20. DICIONARIO BASE  Portugues -> Ingles
         Para acrescentar palavras do seu app, use:
         DGO.iniciar({ traducoes: { 'Minha palavra': 'My word' } })
     ------------------------------------------------------------------ */
  var BASE_PT_EN = {
    /* geral */
    'Início': 'Home', 'Inicio': 'Home', 'Página inicial': 'Home page', 'Voltar': 'Back', 'Avançar': 'Next',
    'Próximo': 'Next', 'Anterior': 'Previous', 'Buscar': 'Search', 'Pesquisar': 'Search', 'Procurar': 'Search',
    'Filtrar': 'Filter', 'Filtros': 'Filters', 'Limpar': 'Clear', 'Limpar filtros': 'Clear filters',
    'Salvar': 'Save', 'Salvo': 'Saved', 'Cancelar': 'Cancel', 'Fechar': 'Close', 'Abrir': 'Open',
    'Editar': 'Edit', 'Excluir': 'Delete', 'Apagar': 'Delete', 'Remover': 'Remove', 'Adicionar': 'Add',
    'Novo': 'New', 'Nova': 'New', 'Criar': 'Create', 'Confirmar': 'Confirm', 'Enviar': 'Send',
    'Baixar': 'Download', 'Carregar': 'Upload', 'Importar': 'Import', 'Exportar': 'Export',
    'Atualizar': 'Refresh', 'Recarregar': 'Reload', 'Configurações': 'Settings', 'Ajustes': 'Settings',
    'Opções': 'Options', 'Ajuda': 'Help', 'Sobre': 'About', 'Sair': 'Sign out', 'Entrar': 'Sign in',
    'Menu': 'Menu', 'Voltar ao topo': 'Back to top', 'Ver mais': 'See more', 'Ver menos': 'See less',
    'Mostrar': 'Show', 'Ocultar': 'Hide', 'Todos': 'All', 'Todas': 'All', 'Nenhum': 'None', 'Nenhuma': 'None',
    'Sim': 'Yes', 'Não': 'No', 'Ativo': 'Active', 'Inativo': 'Inactive', 'Ligado': 'On', 'Desligado': 'Off',
    'Data': 'Date', 'Hoje': 'Today', 'Ontem': 'Yesterday', 'Amanhã': 'Tomorrow', 'Hora': 'Time',
    'Dia': 'Day', 'Dias': 'Days', 'Semana': 'Week', 'Mês': 'Month', 'Meses': 'Months', 'Ano': 'Year', 'Anos': 'Years',
    'Nome': 'Name', 'Descrição': 'Description', 'Título': 'Title', 'Tipo': 'Type', 'Categoria': 'Category',
    'Categorias': 'Categories', 'Total': 'Total', 'Subtotal': 'Subtotal', 'Valor': 'Amount', 'Quantidade': 'Quantity',
    'Status': 'Status', 'Observações': 'Notes', 'Detalhes': 'Details', 'Resumo': 'Summary',
    'Carregando': 'Loading', 'Carregando...': 'Loading...', 'Aguarde': 'Please wait',
    'Erro': 'Error', 'Aviso': 'Notice', 'Sucesso': 'Success', 'Atenção': 'Attention',
    'Compartilhar': 'Share', 'Copiar': 'Copy', 'Copiado': 'Copied', 'Imprimir': 'Print',
    'Modo escuro': 'Dark mode', 'Modo claro': 'Light mode', 'Tema': 'Theme', 'Idioma': 'Language',
    'Favoritos': 'Favorites', 'Favorito': 'Favorite', 'Histórico': 'History', 'Recentes': 'Recent',
    'Versão': 'Version', 'Atualizado em': 'Updated on', 'Última atualização': 'Last update',
    'Uso pessoal': 'Personal use', 'Aviso legal': 'Legal notice', 'Privacidade': 'Privacy',
    'Termos de uso': 'Terms of use', 'Contato': 'Contact', 'Rodapé': 'Footer', 'Publicidade': 'Advertisement',
    'Anuncie aqui': 'Advertise here', 'Anúncio': 'Ad', 'Anúncios': 'Ads', 'Visitante': 'Guest',
    'Assinante': 'Subscriber', 'Anunciante': 'Advertiser', 'Conta': 'Account', 'Senha': 'Password',
    'E-mail': 'E-mail', 'Usuário': 'User', 'Perfil': 'Profile', 'Biometria': 'Biometrics',
    'Nuvem': 'Cloud', 'Backup': 'Backup', 'Restaurar': 'Restore', 'Sincronizar': 'Sync',
    'Câmera': 'Camera', 'Foto': 'Photo', 'Imagem': 'Image', 'Escanear': 'Scan', 'Digitalizar': 'Scan',
    'Instalar': 'Install', 'Gráfico': 'Chart', 'Gráficos': 'Charts', 'Relatório': 'Report',
    'Relatórios': 'Reports', 'Painel': 'Dashboard', 'Notícias': 'News', 'Glossário': 'Glossary',
    'Pendente': 'Pending', 'Concluído': 'Done', 'Em andamento': 'In progress',

    /* dinheiro / financas  (MoneyTrio, BudgetONE, InvestifyONE, TaxONE) */
    'Receita': 'Income', 'Receitas': 'Income', 'Renda': 'Income', 'Rendimentos': 'Earnings',
    'Despesa': 'Expense', 'Despesas': 'Expenses', 'Gasto': 'Spending', 'Gastos': 'Spending',
    'Custo': 'Cost', 'Custos': 'Costs', 'Custos fixos': 'Fixed costs', 'Custos recorrentes': 'Recurring costs',
    'Saldo': 'Balance', 'Saldo do mês': 'Month balance', 'Saldo acumulado': 'Accumulated balance',
    'Patrimônio': 'Net worth', 'Carteira': 'Portfolio', 'Investimento': 'Investment',
    'Investimentos': 'Investments', 'Ativo financeiro': 'Asset', 'Ações': 'Stocks', 'Fundos': 'Funds',
    'Renda fixa': 'Fixed income', 'Renda variável': 'Variable income', 'Previdência': 'Pension',
    'Cotação': 'Quote', 'Cotações': 'Quotes', 'Rentabilidade': 'Return', 'Rendimento': 'Yield',
    'Aporte': 'Contribution', 'Meta': 'Goal', 'Metas': 'Goals', 'Projeção': 'Projection',
    'Juros compostos': 'Compound interest', 'Inflação': 'Inflation', 'Câmbio': 'Exchange rate',
    'Dólar': 'Dollar', 'Real': 'Real', 'Corretora': 'Broker', 'Conta corrente': 'Checking account',
    'Cartão de crédito': 'Credit card', 'Crédito': 'Credit', 'Débito': 'Debit', 'Dinheiro': 'Cash',
    'Orçamento': 'Budget', 'Imposto de renda': 'Income tax', 'Imposto': 'Tax', 'Impostos': 'Taxes',
    'Declaração': 'Tax return', 'Dedução': 'Deduction', 'Nota fiscal': 'Receipt', 'Recibo': 'Receipt',
    'Vencimento': 'Due date', 'A vencer': 'Due soon', 'Pago': 'Paid', 'Em aberto': 'Open',
    'Mensal': 'Monthly', 'Anual': 'Yearly', 'Periodicidade': 'Frequency', 'Parcela': 'Installment',
    'Aluguel': 'Rent', 'Salário': 'Salary', 'Moradia': 'Housing', 'Habitação': 'Housing',
    'Lazer': 'Leisure', 'Saúde': 'Health', 'Transporte': 'Transport', 'Veículo': 'Vehicle',
    'Alimentação': 'Food', 'Educação': 'Education', 'Pessoal': 'Personal', 'Dependentes': 'Dependents',
    'Bancários': 'Banking', 'Simulador': 'Simulator', 'Alocação': 'Allocation', 'Risco': 'Risk',

    /* historias (contador de historias) */
    'História': 'Story', 'Histórias': 'Stories', 'Nova história': 'New story', 'Contar história': 'Tell a story',
    'Acervo': 'Library', 'Capítulo': 'Chapter', 'Capítulos': 'Chapters', 'Série': 'Series', 'Séries': 'Series',
    'Personagem': 'Character', 'Personagens': 'Characters', 'Tema': 'Topic', 'Temas': 'Topics',
    'Idade': 'Age', 'Faixa etária': 'Age range', 'Voz': 'Voice', 'Ler em voz alta': 'Read aloud',
    'Ouvir': 'Listen', 'Pausar': 'Pause', 'Continuar': 'Continue', 'Continuar ouvindo': 'Keep listening',
    'Efeitos sonoros': 'Sound effects', 'Narração': 'Narration', 'Aprovar': 'Approve',
    'Gerar história': 'Generate story', 'Sortear': 'Shuffle', 'Boa noite': 'Good night', 'Dormir': 'Sleep',

    /* cifras de violao */
    'Cifra': 'Chord chart', 'Cifras': 'Chord charts', 'Acorde': 'Chord', 'Acordes': 'Chords',
    'Tom': 'Key', 'Mudar o tom': 'Change key', 'Transpor': 'Transpose', 'Capotraste': 'Capo',
    'Afinador': 'Tuner', 'Violão': 'Guitar', 'Música': 'Song', 'Músicas': 'Songs', 'Artista': 'Artist',
    'Letra': 'Lyrics', 'Rolagem automática': 'Auto scroll', 'Velocidade': 'Speed',
    'Tamanho da letra': 'Font size', 'Dicionário de acordes': 'Chord dictionary', 'Repertório': 'Repertoire',
    'Playlist': 'Playlist', 'Tocar': 'Play', 'Parar': 'Stop'
  };

  /* ------------------------------------------------------------------
     21. API PUBLICA
     ------------------------------------------------------------------ */
  var API = {
    __carregado: true,
    versao: VERSAO,
    cfg: cfg,

    iniciar: function (opcoes) {
      fundir(cfg, opcoes || {});
      Idioma.montarDicionario();

      var guardado = Guardar.ler('idioma', null, !!cfg.idiomaCompartilhado);
      var doNavegador = (navigator.language || 'pt').toLowerCase().indexOf('en') === 0 ? 'en' : 'pt';
      Idioma.atual = guardado || cfg.idiomaPadrao || doNavegador;
      d.documentElement.setAttribute('lang', Idioma.atual === 'en' ? 'en' : 'pt-BR');
      d.documentElement.setAttribute('data-dgo-idioma', Idioma.atual);

      function arrancar() {
        injetarEstilo();
        garantirMeta();
        Sessao.carregar();
        (cfg.seletoresTopoFixo || []).forEach(function (sel) {
          Array.prototype.forEach.call(d.querySelectorAll(sel), function (n) {
            if (n.dataset.dgoTopoOriginal === undefined) {
              n.dataset.dgoTopoOriginal = raiz.getComputedStyle(n).top || '0px';
            }
          });
        });
        marcarIgnorados();
        Niveis.carregarArquivo().then(function () { Niveis.revisar(); });
        montarFaixa();
        montarBarraAdmin();
        Anuncios.carregarArquivo();
        vigiarTelaCheia();
        Popup.agendar();                 /* 'antes' se ninguem entrou; 'depois' se ja entrou */
        raiz.addEventListener('resize', function () {
          ajustarTopo(faixaEl ? faixaEl.offsetHeight : 0);
        });
        raiz.addEventListener('orientationchange', function () {
          raiz.setTimeout(function () { ajustarTopo(faixaEl ? faixaEl.offsetHeight : 0); }, 250);
        });
        montarSeletorIdioma();
        PWA.preparar();
        if (cfg.login.biometria) Biometria.verificarAparelho();
        Notif.iniciar();
        var con = navigator.connection;
        if (con && con.addEventListener) {
          con.addEventListener('change', function () { d.dispatchEvent(new CustomEvent('dgo:rede', { detail: { tipo: Rede.tipo() } })); });
        }
        Varredura.iniciar();
        if (cfg.login.ativo && cfg.login.exigirNaAbertura && !Sessao.tipo) abrirLogin();
        d.dispatchEvent(new CustomEvent('dgo:pronto', { detail: API.sessao() }));
      }

      if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', arrancar);
      else arrancar();
      return API;
    },

    /* idioma e datas */
    idioma: function () { return Idioma.atual; },
    trocarIdioma: function (novo) { Idioma.definir(novo || (Idioma.atual === 'pt' ? 'en' : 'pt')); return Idioma.atual; },
    formatarData: formatarData,
    traduzir: function (s) { return Idioma.traduzir(s); },
    adicionarTraducoes: function (obj) { fundir(cfg.traducoes, obj || {}); Idioma.montarDicionario(); Varredura.tudo(); },
    revarrer: function (no) { marcarIgnorados(); Varredura.ramo(no || d.body); },
    ignorar: function (sel) {
      (Array.isArray(sel) ? sel : [sel]).forEach(function (x) {
        if (cfg.ignorar.indexOf(x) === -1) cfg.ignorar.push(x);
      });
      marcarIgnorados();
    },
    t: t,

    /* acesso */
    abrirLogin: abrirLogin,
    sessao: function () { return Sessao.resumo(); },
    entrarComoVisitante: function () { return Sessao.entrar('visitante', { nome: t('visitante') }); },
    sair: function () { Sessao.sair(); },
    auth: {
      contas: Contas,
      biometria: Biometria,
      google: Google,
      abrirRecuperacao: function (aba) { return abrirRecuperacao(aba || 'pagante'); },
      trocarSenha: function (ident, atual, nova) { return Contas.trocarSenha(ident, atual, nova); },
      redefinirComCodigo: function (ident, codigo, nova) { return Contas.redefinirComCodigo(ident, codigo, nova); },
      set backend(b) { Sessao.backend = b; },
      get backend() { return Sessao.backend; }
    },

    /* anuncios */
    anuncios: {
      mostrar: function () { FlagAnuncio.reabrir(); montarFaixa(); },
      esconder: function () { FlagAnuncio.fechar(); montarFaixa(); },
      lista: function () { return Anuncios.lista(); },
      definirLista: function (l) { cfg.anuncios.lista = l || []; Anuncios._lista = null; montarFaixa(); },
      metricas: Anuncios.totais,
      popup: function (anuncio, momento) { return Popup.abrir(anuncio, momento); },
      agendarPopup: function (momento) { Popup.agendar(momento); },
      painel: abrirPainelAnunciante
    },

    /* OCR */
    ocr: {
      abrir: abrirOCR,
      ler: OCR.ler,
      lerArquivo: OCR.lerArquivo,
      extrair: OCR.extrair,
      preAquecer: function () {
        return OCR.temLocal().then(function (l) { return l ? true : OCR.motor(function () {}); });
      },
      ondeEsta: function () { return OCR.ondeEsta(); },
      temLocal: function () { return OCR.temLocal(); }
    },

    /* notificacoes */
    notificacoes: {
      estado: function () { return Notif.estado(); },
      pedirPermissao: function () { return Notif.pedirPermissao(); },
      mostrar: function (tipo, conteudo) { return Notif.mostrar(tipo, conteudo); },
      agendar: function (tipo, quando, conteudo, repetir) { return Notif.agendar(tipo, quando, conteudo, repetir); },
      cancelar: function (id) { return Notif.cancelar(id); },
      agenda: function () { return Notif.agenda(); },
      ligado: function (id) { return Notif.ligado(id); },
      ligar: function (id, v) { return Notif.ligar(id, v); },
      silencio: function (novo) { return Notif.silencio(novo); },
      emSilencio: function () { return Notif.emSilencio(); },
      inscrever: function () { return Notif.inscrever(); },
      cancelarInscricao: function () { return Notif.cancelarInscricao(); },
      inscrito: function () { return Notif.inscrito(); },
      distintivo: function (n) { return Notif.distintivo(n); },
      abrirPainel: abrirNotificacoes,
      montarPainel: montarNotificacoes
    },

    /* IA */
    ia: {
      abrir: abrirIA,
      chaves: abrirChaves,
      perguntar: function (p, o) { return IA.perguntar(p, o); },
      temChave: function (prov) { return IA.temChave(prov); },
      definirChave: function (prov, k) { return IA.definirChave(prov, k); },
      provedor: function () { return IA.provedor(); },
      definirProvedor: function (p) { return IA.definirProvedor(p); },
      provedores: function (cap) {
        completarProvedores();
        return Object.keys(PROVEDORES).filter(function (p) { return cap ? (PROVEDORES[p].cap || []).indexOf(cap) !== -1 : !PROVEDORES[p].soVoz; })
          .sort(function (a, b) { return (PROVEDORES[a].ordem || 9) - (PROVEDORES[b].ordem || 9); }).map(function (p) {
          var pr = PROVEDORES[p];
          return { id: p, nome: nomeProv(pr), gratis: pr.gratis, onde: pr.onde, cap: pr.cap || [], temChave: IA.temChave(p), modelo: IA.modelo(p),
                   stt: pr.stt || null, tts: pr.tts || null, semChave: !!pr.semChave };
        });
      },
      /* por uso: 'texto' | 'stt' | 'tts' | 'visao' - o app pergunta qual provedor e qual chave usar */
      capacidades: function () { return Object.keys(CAPS).map(function (c) { return { id: c, icone: CAPS[c].icone, nome: CAPS[c][Idioma.atual] || CAPS[c].pt }; }); },
      provedorPara: function (cap) { completarProvedores(); return PorUso.provedor(cap); },
      chavePara: function (cap) { completarProvedores(); return PorUso.chave(cap); },
      definirPara: function (cap, prov) { if (cap === 'texto') IA.definirProvedor(prov); else PorUso.definir(cap, prov); },
      guia: function (prov, cap) { return abrirChaves(prov, cap); },
      provedoresProntos: function () { return IA.provedoresProntos(); },
      modelo: function (prov) { return IA.modelo(prov); },
      definirModelo: function (prov, m) { return IA.definirModelo(prov, m); },
      listarModelos: function (prov) { return IA.listarModelos(prov); },
      definirEndereco: function (prov, url) { return IA.definirBase(prov, url); },
      limpar: function () { return IA.limparConversa(); },
      set cofreBackend(b2) { IA.cofreBackend = b2; },
      get cofreBackend() { return IA.cofreBackend; }
    },

    /* rede: wifi ou dados */
    rede: {
      tipo: function () { return Rede.tipo(); },
      economia: function () { return Rede.economia(); },
      preferencia: function (c) { return Rede.preferencia(c); },
      definir: function (c, v) { return Rede.definir(c, v); },
      podeBaixarPesado: function () { return Rede.podeBaixarPesado(); },
      podeUsarIA: function () { return Rede.podeUsarIA(); },
      pedirPesado: function (desc, mb) { return Rede.pedirPesado(desc, mb); }
    },

    /* wizard */
    wizard: {
      definir: function (id, def) { return Wizard.definir(id, def); },
      abrir: function (id, passo) { return Wizard.abrir(id, passo); },
      feito: function (id) { return Wizard.feito(id); },
      dados: function (id) { return Wizard.dados(id); },
      reiniciar: function (id) { return Wizard.reiniciar(id); }
    },

    /* niveis de acesso */
    pode: function (id) { return Niveis.pode(id); },
    exigir: function (id, acao, opcoes) { return Niveis.exigir(id, acao, opcoes); },
    nivel: function () { return Niveis.atual(); },
    niveis: {
      pode: function (id) { return Niveis.pode(id); },
      exigir: function (id, a2, o) { return Niveis.exigir(id, a2, o); },
      atual: function () { return Niveis.atual(); },
      servicos: function () { return Niveis.servicos(); },
      definir: function (id, n) { return Niveis.definirNivelDoServico(id, n); },
      marcar: function (sel, id) { return Niveis.marcar(sel, id); },
      revisar: function () { return Niveis.revisar(); },
      convite: function (id, o) { return Niveis.convite(id, o); },
      set backend(b2) { Niveis.backend = b2; },
      get backend() { return Niveis.backend; }
    },
    admin: {
      ehAdmin: function () { return Niveis.ehAdmin(); },
      abrir: abrirAdmin,
      simular: function (n) {
        if (n) Guardar.gravar('admin-simular', n); else Guardar.apagar('admin-simular');
        montarFaixa(); Niveis.revisar(); montarBarraAdmin();
        return Niveis.atual();
      }
    },

    /* e-mail */
    email: Email,

    /* nuvem e arquivos */
    nuvem: Nuvem,
    compartilhar: compartilhar,

    /* configuracoes */
    abrirConfiguracoes: abrirConfiguracoes,
    montarConfiguracoes: montarConfiguracoes,

    /* app instalavel / plataforma */
    pwa: PWA,
    plataforma: Plataforma,

    /* dados do app: sobrescreva estes dois se o seu app guardar em outro lugar */
    exportarDados: function () {
      var saida = { app: cfg.app, versao: cfg.versaoApp, em: new Date().toISOString(), dados: {} };
      try {
        var p = 'dgo:' + cfg.app + ':', i, c;
        for (i = 0; i < raiz.localStorage.length; i++) {
          c = raiz.localStorage.key(i);
          if (c && c.indexOf(p) === 0 && c.indexOf(':conta:') === -1) saida.dados[c] = raiz.localStorage.getItem(c);
        }
      } catch (e) {}
      return saida;
    },
    importarDados: function (obj) {
      if (!obj || !obj.dados) return false;
      try {
        Object.keys(obj.dados).forEach(function (c) { raiz.localStorage.setItem(c, obj.dados[c]); });
        return true;
      } catch (e) { return false; }
    },

    /* utilidades internas expostas por conveniencia */
    guardar: Guardar,
    modal: { abrir: abrirModal, fechar: fecharModal, caixa: function (props, filhos) { return el('div', props, filhos); } }
  };

  raiz.DGO = API;
  raiz.Diretrizes = API;

})(typeof window !== 'undefined' ? window : this);
