/* Service worker — faz o site abrir mesmo sem internet e permite instalar
   como app no celular e no computador.
   Ao publicar uma versao nova do seu site, troque o numero de VERSAO
   abaixo (ex.: 'v1' -> 'v2') para o aparelho pegar os arquivos novos. */
var VERSAO = 'guiaxpert-v1.6.3';
/* Todos os apps moram no mesmo endereco (marceloneco.github.io) e dividem
   os caches. Por isso o nome leva a pasta do app: assim um app nunca apaga
   o modo sem internet de outro. A pasta vem do proprio endereco, entao este
   arquivo continua identico em todos os apps. */
var APP = (self.registration && self.registration.scope || '')
  .replace(/^https?:\/\/[^/]+\/?/, '').replace(/\/+$/, '').replace(/[^a-z0-9-]+/gi, '-') || 'raiz';
var PREFIXO = 'dgo-' + APP + '-';
var CACHE = PREFIXO + VERSAO;

/* Ao instalar uma versao nova, guarda o app INTEIRO de uma vez: a pagina e todos os .js/.css que ela chama
   (lidos do proprio index.html, entao serve para qualquer app). Arquivo que nao chegar pela rede (sinal fraco)
   e copiado da versao anterior, que so e apagada depois. Antes, o cache novo nascia quase vazio e, com sinal
   fraco, um .js podia faltar e derrubar uma tela (GuiaXpert, 21/Nov/2026: "Clima is not defined"). */
/* fetch com prazo: com sinal fraco, a instalacao nao pode ficar pendurada para sempre */
function buscarComPrazo(u, ms) {
  var ctl = self.AbortController ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 15000) : null;
  return fetch(u, ctl ? { cache: 'no-cache', signal: ctl.signal } : { cache: 'no-cache' }).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
}
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    function guardar(u) {
      return buscarComPrazo(u).then(function (r) { if (!r || r.status !== 200 || r.redirected) throw new Error(u); return c.put(u, r); })
        .catch(function () { return caches.match(u).then(function (v) { return v ? c.put(u, v) : null; }); });
    }
    return buscarComPrazo('./index.html').then(function (r) { return r.text(); }).catch(function () {
      return caches.match('./index.html').then(function (v) { return v ? v.text() : ''; });
    }).then(function (html) {
      var lista = ['./', './index.html', './manifest.json'], m, re = /(?:src|href)="([^"#:?]+\.(?:js|css|json|png|svg|webp))"/g;
      while ((m = re.exec(html))) if (lista.indexOf('./' + m[1]) < 0 && lista.indexOf(m[1]) < 0) lista.push(m[1].indexOf('./') === 0 ? m[1] : './' + m[1]);
      return Promise.all(lista.map(guardar));
    }).then(function () {
      /* bibliotecas e fotos já guardadas (mapa, leitor de PDF, QR, fotos) passam para a versão nova sem baixar de novo */
      return caches.keys().then(function (nomes) {
        return Promise.all(nomes.filter(function (n) { return n.indexOf(PREFIXO) === 0 && n !== CACHE && n.indexOf('compartilhado') < 0; }).map(function (n) {
          return caches.open(n).then(function (velho) {
            return velho.keys().then(function (reqs) {
              return Promise.all(reqs.filter(function (r) { return /\/(vendor|img)\/|\.(png|webp|svg|jpg)$/i.test(new URL(r.url).pathname); }).map(function (r) {
                return c.match(r).then(function (ja) { return ja ? null : velho.match(r).then(function (resp) { return resp ? c.put(r, resp) : null; }); });
              }));
            });
          });
        }));
      });
    }).catch(function () {});
  }));
});

self.addEventListener('activate', function (e) {
  /* so apaga as versoes antigas DESTE app quando a nova ja tem a pagina e o app.js (senao, sem internet, nada abriria) */
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all([c.match('./index.html'), c.match('./js/app.js'), c.match('./styles.css')]);
  }).then(function (tem) {
    if (!tem[0] || !tem[1] || !tem[2]) return null;
    return caches.keys().then(function (nomes) {
      return Promise.all(nomes.map(function (n) {
        return (n.indexOf(PREFIXO) === 0 && n !== CACHE && n.indexOf('compartilhado') < 0) ? caches.delete(n) : null;
      }));
    });
  }).then(function () { return self.clients.claim(); }));
});
/* pagina simples quando nao ha internet E nenhuma copia guardada (melhor que o erro do navegador) */
function paginaSemCopia() {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>GuiaXpert</title><body style="font:18px/1.4 system-ui,sans-serif;background:#101517;color:#e7edeb;display:grid;place-items:center;min-height:90vh;margin:0;padding:1.5rem;text-align:center">' +
    '<div><p style="font-size:2.4rem;margin:0">📶</p><h1 style="font-size:1.3rem">Sem internet</h1><p>Abra o GuiaXpert uma vez com sinal para ele ficar guardado neste celular.</p>' +
    '<p style="color:#a0b0ab;font-size:.95rem">No internet. Open GuiaXpert once online to save it on this phone.</p>' +
    '<button onclick="location.reload()" style="font:inherit;padding:.7rem 1.4rem;border-radius:14px;border:0;background:#93cbb3;color:#10261d;font-weight:700">Tentar de novo</button></div>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
/* a pagina guardada: nesta versao ou em qualquer copia anterior deste app */
function paginaGuardada(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || caches.match('./index.html') || null;
  }).then(function (r) {
    if (r) return r;
    return caches.keys().then(function (nomes) {
      return nomes.filter(function (n) { return n.indexOf(PREFIXO) === 0; }).reduce(function (p, n) {
        return p.then(function (achou) { return achou || caches.open(n).then(function (c) { return c.match('./index.html').then(function (x) { return x || c.match('./'); }); }); });
      }, Promise.resolve(null));
    });
  });
}

/* "Compartilhar" do celular (manifest share_target, POST): foto, PDF ou texto vindos de outro app (ex.: WhatsApp).
   Guarda os arquivos num cache temporario e abre o app com ?compartilhado=...; o app le e apaga. Generico para os apps. */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'POST' || !/\/compartilhar\/?$/.test(new URL(req.url).pathname)) return;
  e.respondWith(req.formData().then(function (fd) {
    var arqs = fd.getAll('arquivos').filter(function (f) { return f && f.size; }).slice(0, 10);
    var cacheNome = PREFIXO + 'compartilhado';
    return caches.delete(cacheNome).then(function () { return caches.open(cacheNome); }).then(function (c) {
      return Promise.all(arqs.map(function (f, i) {
        return c.put('./__compartilhado/' + i, new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Nome': encodeURIComponent(f.name || ('arquivo-' + i)) } }));
      }));
    }).then(function () {
      var q = new URLSearchParams();
      ['title', 'text', 'url'].forEach(function (k) { var v = fd.get(k); if (v) q.set(k, String(v).slice(0, 4000)); });
      if (arqs.length) q.set('compartilhado', String(arqs.length));
      return Response.redirect('./index.html?' + q.toString(), 303);
    });
  }).catch(function () { return Response.redirect('./index.html', 303); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // nao mexe em API externa
  if (req.headers.get('range') || /\.pmtiles$/i.test(url.pathname)) return;   // arquivos grandes lidos por pedacos: o app guarda por conta propria

  /* Codigo do app (pagina, .js, .css, .json): REDE PRIMEIRO, conferindo com o
     servidor (cache: 'no-cache' evita o cache de ate 10 min do GitHub Pages).
     Assim, com sinal, sempre roda a versao nova inteira; sem sinal (ou se a
     rede demorar mais de 4 s), usa a copia guardada. Antes, pagina nova com
     .js antigo podia rodar misturada no primeiro recarregar depois de um release. */
  /* .js e .css: a cópia guardada DESTA versão primeiro (abre na hora, até com sinal fraco). Cada versão nova vem
     inteira pela instalação do service worker novo (sw.js mudou), nunca misturada (21/Nov/2026: "demorou muito para carregar"). */
  if (/\.(js|css)$/i.test(url.pathname) && url.pathname.indexOf('/sw.js') < 0) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (r) {
        if (r) return r;
        return fetch(req, { cache: 'no-cache' }).then(function (rr) {
          if (rr && rr.status === 200) c.put(req, rr.clone());
          return rr;
        }).catch(function () { return caches.match(req, { ignoreSearch: true }).then(function (v) { return v || Response.error(); }); });
      });
    }));
    return;
  }
  var codigo = req.mode === 'navigate' || /\.(json|html)$/i.test(url.pathname) || /\/$/.test(url.pathname);
  if (codigo) {
    e.respondWith(new Promise(function (ok) {
      var feito = false;
      function reserva() {
        if (feito) return; feito = true;
        if (req.mode === 'navigate') { paginaGuardada(req).then(function (r) { ok(r || paginaSemCopia()); }); return; }
        caches.match(req, { ignoreSearch: true }).then(function (r) { ok(r || fetch(req)); });
      }
      /* abrir rápido: a página espera a rede no máximo 2,5 s (os outros arquivos, 4 s); a conferência de versão nova vem logo depois */
      var prazo = setTimeout(reserva, req.mode === 'navigate' ? 1500 : 3000);
      fetch(req, { cache: 'no-cache' }).then(function (r) {
        clearTimeout(prazo);
        if (r && r.status === 200) {
          var copia = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copia); });
        }
        if (!feito) { feito = true; ok(r); }
      }).catch(function () { clearTimeout(prazo); reserva(); });
    }));
    return;
  }

  /* arquivos pesados (imagens, sons, motor de OCR): cache primeiro, atualizando por tras */
  e.respondWith(
    caches.match(req).then(function (cacheado) {
      var rede = fetch(req).then(function (r) {
        if (r && r.status === 200) {
          var copia = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copia); });
        }
        return r;
      }).catch(function () { return cacheado; });
      return cacheado || rede;
    })
  );
});

/* ====================================================================
   NOTIFICACOES
   Esta parte recebe os avisos enviados pelo servidor (push), mostra o
   aviso na tela e leva a pessoa para o lugar certo quando ela toca nele.
   Funciona mesmo com o site fechado, desde que o aparelho tenha
   permissao e o servidor esteja configurado com a chave VAPID.
   ==================================================================== */

self.addEventListener('push', function (e) {
  var dados = {};
  try { dados = e.data ? e.data.json() : {}; }
  catch (err) { dados = { titulo: 'Aviso', texto: e.data ? e.data.text() : '' }; }

  var titulo = dados.titulo || dados.title || 'Aviso';
  var opcoes = {
    body: dados.texto || dados.body || '',
    icon: dados.icone || dados.icon || 'icone-192.png',
    badge: dados.distintivo || dados.badge || 'icone-192.png',
    tag: dados.tag || dados.tipo || 'dgo',
    renotify: !!dados.repetirAviso,
    requireInteraction: !!dados.fixar,
    data: { url: dados.url || './', tipo: dados.tipo || null },
    actions: dados.acoes || dados.actions || undefined
  };

  e.waitUntil(
    self.registration.showNotification(titulo, opcoes).then(function () {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function (lista) {
      lista.forEach(function (c) { c.postMessage({ dgo: 'push', dados: dados }); });
    })
  );
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var destino = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      for (var i = 0; i < lista.length; i++) {
        var c = lista[i];
        if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
          c.postMessage({ dgo: 'notificacao-clicada', url: destino, acao: e.action || null });
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })
  );
});

self.addEventListener('notificationclose', function (e) {
  /* ponto de encaixe para contar avisos ignorados, quando houver servidor */
});

/* Se um dia a inscricao do aparelho for renovada pelo navegador, o
   servidor precisa saber. Preencha o endereco abaixo quando existir. */
var ENDERECO_INSCRICAO = '';
self.addEventListener('pushsubscriptionchange', function (e) {
  if (!ENDERECO_INSCRICAO) return;
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription.options).then(function (nova) {
      return fetch(ENDERECO_INSCRICAO, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renovacao: true, inscricao: nova })
      });
    }).catch(function () {})
  );
});
