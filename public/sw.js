// =========================================================================
// Service Worker — نسخه‌ی سازگار با خروجی Vite (فایل‌های build شده hash دار
// هستن، پس به‌جای لیست ثابت فایل‌ها، از یک استراتژی Network-First پویا
// استفاده می‌کنیم؛ همون منطق اصلی app.js: همیشه اول شبکه، کش فقط برای
// حالت آفلاین/قطعی شبکه).
// =========================================================================

const CACHE_NAME = "apex-planner-v5";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // فقط فایل‌های خودِ اپ (همین دامنه) هندل می‌شن. درخواست‌های API به بکند
  // (دامنه‌ی دیگه، مثل Railway) همیشه مستقیم از شبکه می‌رن.
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResp) => {
        if (networkResp && networkResp.status === 200) {
          const clone = networkResp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResp;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
  );
});
