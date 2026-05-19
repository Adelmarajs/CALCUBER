/**
 * Corrida Fácil — Service Worker
 * Cache-first para assets, network-first para navegação.
 */

var CACHE = 'corrida-facil-v1';
var ASSETS = [
  '/', '/index.html', '/dashboard.html', '/app.js', '/style.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  if (url.hostname.indexOf('googleapis') !== -1 || url.hostname.indexOf('gstatic') !== -1) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function (r) {
        return caches.open(CACHE).then(function (c) { c.put(e.request, r.clone()); return r; });
      }).catch(function () {
        return caches.match(e.request).then(function (r) { return r || caches.match('/index.html'); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (r) {
      return r || fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function () { return new Response('', { status: 200 }); });
    })
  );
});
