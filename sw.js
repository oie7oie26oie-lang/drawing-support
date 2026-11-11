/* オフラインでも開けるようにするための Service Worker。
   アプリ本体（HTML / CSS / JS / アイコン）だけを端末に置いておく。入力データや画像には触れない。
   アプリを更新したときは VERSION を上げると、古い控えが消える。 */
const VERSION = 'v1';
const CACHE = 'drawing-support-' + VERSION;
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/colors.js',
  'js/store.js',
  'js/logic.js',
  'js/sampling.js',
  'js/datacard.js',
  'js/ui.js',
  'js/view-subject.js',
  'js/view-main.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('drawing-support-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// まず通信で最新を取りにいき、つながらないときだけ端末の控えを使う
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
