var CACHE = 'corrida-facil-v4';
var BASE = '/CALCUBER/';
var ASSETS = [
  BASE + 'index.html', BASE + 'dashboard.html', BASE + 'app.js', BASE + 'style.css',
  BASE + 'manifest.json', BASE + 'icons/icon-192x192.png', BASE + 'icons/icon-512x512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(
        ASSETS.map(function (url) {
          return c.add(url).catch(function () { return true; });
        })
      );
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
        return caches.match(e.request).then(function (r) { return r || caches.match(BASE + 'index.html'); });
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
