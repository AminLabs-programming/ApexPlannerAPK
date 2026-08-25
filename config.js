/* =========================================================================
   تنظیمات اتصال به بکند
   بعد از اینکه بکند رو روی Railway دیپلوی کردی، فقط همین یک خط رو با
   آدرس واقعی سرویس‌ت عوض کن — هیچ فایل دیگه‌ای نیازی به تغییر نداره.
   مثال آدرس واقعی: https://apex-backend-production.up.railway.app
   ========================================================================= */
const APEX_CONFIG = {
  BACKEND_URL: "https://diplomatic-prosperity-production.up.railway.app/",
};
if (typeof window !== 'undefined') window.APEX_CONFIG = APEX_CONFIG;
