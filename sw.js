/* Shelf service worker: offline app shell + Android share target */
importScripts('db.js');
var CACHE = 'shelf-v2';
var SHELL = ['./', './index.html', './db.js', './marked.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function decode(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (e) { try { return new TextDecoder('shift_jis').decode(buf); } catch (e2) { return new TextDecoder().decode(buf); } }
}

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async function () {
      var added = 0, lastId = '';
      try {
        var form = await e.request.formData();
        var files = form.getAll('files');
        for (var i = 0; i < files.length; i++) {
          var f = files[i];
          if (!f || typeof f === 'string') continue;
          var r = await ShelfDB.addText(f.name, decode(await f.arrayBuffer()));
          added++; lastId = r.rec.id;
        }
        var text = form.get('text');
        if (!added && text && String(text).trim()) {
          var title = String(form.get('title') || '').trim() || ('共有 ' + new Date().toLocaleString('ja-JP'));
          var r2 = await ShelfDB.addText(title, String(text));
          added++; lastId = r2.rec.id;
        }
      } catch (err) { /* fall through to the app with a count of 0 */ }
      var to = new URL('./', self.registration.scope);
      to.searchParams.set('shared', String(added));
      if (added === 1) to.searchParams.set('open', lastId);
      return Response.redirect(to.href, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () { return caches.match('./index.html'); });
  }));
});
