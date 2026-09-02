# اپکس پلنر — فرانت‌اند جدید (React + TypeScript + Vite)

این پروژه جایگزین فرانت‌اند قدیمی (vanilla-JS، پوشه‌ی `ApexPlannerAPK`) شده و
دقیقاً همون UI‌ای هست که توی `frontend-fixed.zip` طراحی شده بود — اما الان
کامل به بک‌اند شما (FastAPI روی Railway) وصله و آماده‌ی دیپلوی هست.

## چی عوض شده نسبت به `frontend-fixed.zip` خام؟

فایل‌های React/TypeScript خودشون از قبل ۱:۱ با `api.js` و منطق آفلاین/سینک
پروژه‌ی اصلی (`app.js`) هماهنگ بودن — همون endpoint ها، همون شکل داده، همون
منطق صف آفلاین (outbox). چیزی که کم بود و اضافه شد:

1. **PWA assets** — از پروژه‌ی قدیمی پورت شدن به `public/`:
   - `manifest.json`, آیکون‌ها (`icon-*.png`, `apple-touch-icon.png`, `favicon-32.png`, `logo.png`)
   - `.well-known/assetlinks.json` (برای اپ اندرویدِ TWA/PWABuilder)
   - `sw.js` — بازنویسی شد چون Vite فایل‌های build شده رو hash دار می‌کنه؛
     دیگه لیست ثابت فایل نداره، ولی همون استراتژی Network-First قدیمی رو حفظ کرده.
2. **`index.html`** — تگ‌های manifest/آیکون/فونت Vazirmatn و ثبت service worker اضافه شد.
3. **حذف صفحه‌ی `ConceptGallery`** — این صفحه فقط برای نمایش ۴ کانسپت طراحی
   توی مرحله‌ی طراحی بود (نه بخشی از اپ واقعی) و لینکش از صفحه‌ی ورود حذف شد
   تا باندل تمیز و سبک بمونه.
4. **دو باگ کوچیک TypeScript** رفع شد (یه mismatch نوع در `refresh()` و
   رفرنس باقی‌مونده به صفحه‌ی حذف‌شده‌ی concepts).
5. **`railway.json`** اضافه شد برای دیپلوی مستقیم (build با npm، سرو با `serve -s dist`).

## تنظیم آدرس بک‌اند

آدرس پیش‌فرض بک‌اند توی `src/lib/config.ts` همون آدرس قدیمیه:
```
https://apexplannerbackend-production.up.railway.app
```
اگه می‌خوای عوضش کنی، یه متغیر محیطی `VITE_BACKEND_URL` روی سرویس Railway
فرانت‌اند ست کن (نیازی به تغییر کد نیست).

## دیپلوی روی Railway

این پروژه بر خلاف قبلی build step داره:
- **Build command:** `npm install && npm run build`
- **Start command:** `npx serve -s dist -l $PORT`

این تنظیمات از قبل توی `railway.json` هست، پس با Railpack به‌صورت خودکار تشخیص داده می‌شن.

## اجرای لوکال

```bash
npm install
npm run dev      # سرور توسعه
npm run build    # خروجی نهایی توی dist/
npm run preview  # پیش‌نمایش خروجی build شده
```

## ساختار صفحات (همه‌شون کامل پیاده‌سازی شدن)

Splash → Login/Register/Forgot → Home → Plan → Timer → Questions → Stats
→ Analysis Bank (لیست + جزئیات با PDF viewer) → Profile (با تنظیمات ظاهری:
تم/حالت روشن‌وتاریک/سطح شیشه‌ای) → Admin Panel (فقط برای ادمین گروه).

هویت بصری «ایران باستان» (طلای پارسی، نماد فروهر، پس‌زمینه‌ی هندسی ظریف)
طبق بریف طراحی (`apex-planner-brief.md`) در همه‌ی صفحات اعمال شده.
