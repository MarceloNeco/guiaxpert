/* Service worker — faz o site abrir mesmo sem internet e permite instalar
   como app no celular e no computador.
   Ao publicar uma versao nova do seu site, troque o numero de VERSAO
   abaixo (ex.: 'v1' -> 'v2') para o aparelho pegar os arquivos novos. */
var VERSAO = 'guiaxpert-v1.5.6';
/* Todos os apps moram no mesmo endereco (marceloneco.github.io) e dividem
   os caches. Por isso o nome leva a pasta do app: assim um app nunca apaga
   o modo sem internet de outro. A pasta vem do proprio endereco, entao este
   arquivo continua identico em todos os apps. */
var APP = (self.registration && self.registration.scope || '')
  .replace(/^https?:\/\/[^/]+\/?/, '').replace(/\/+$/, '').replace(/[^a-z0-9-]+/gi, '-') || 'raiz';
var PREFIXO = 'dgo-' + APP + '-';
var CACHE = PREFIXO + VERSAO;

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(['./', './index.html', './diretrizes.js']).catch(function () {});
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.map(function (n) {
      /* so apaga versoes antigas DESTE app */
      return (n.indexOf(PREFIXO) === 0 && n !== CACHE) ? caches.delete(n) : null;
    }));
  }).then(function () { return self.clients.claim(); }));
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
  var codigo = req.mode === 'navigate' || /\.(js|css|json|html)$/i.test(url.pathname) || /\/$/.test(url.pathname);
  if (codigo) {
    e.respondWith(new Promise(function (ok) {
      var feito = false;
      function reserva() {
        if (feito) return; feito = true;
        caches.match(req).then(function (r) {
          ok(r || (req.mode === 'navigate' ? caches.match('./index.html') : fetch(req)));
        });
      }
      var prazo = setTimeout(reserva, 4000);
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
