const CACHE_NAME = 'apex-planner-v1';
const ASSETS = [
  './index.html',
  './config.js',
  './api.js',
  './app.js',
  './auth.js',
  './sheet.js',
  './screens_home.js',
  './screens_plan.js',
  './screens_timer.js',
  './screens_questions.js',
  './screens_stats.js',
  './screens_profile.js',
  './screens_admin.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // فقط فایل‌های خودِ اپ (همین دامنه) کش می‌شن. درخواست‌های API به بکند
  // (دامنه‌ی دیگه، مثل Railway) همیشه مستقیم از شبکه می‌رن تا داده همیشه
  // تازه باشه — کش کردن جواب‌های API باعث دیدن داده‌ی قدیمی می‌شه.
  if (!event.request.url.startsWith(self.location.origin)) {
    return; // بدون respondWith یعنی مرورگر خودش عادی fetch می‌کنه
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResp) => {
          if (networkResp && networkResp.status === 200) {
            const clone = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
