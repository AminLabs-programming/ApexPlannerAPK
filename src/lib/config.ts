/* =========================================================================
   تنظیمات اتصال به بکند
   ⚠️ این آدرس باید دامنه‌ی سرویس FastAPI (بکند) باشه، نه دامنه‌ی همین سرویس
   فرانت‌اند. مقدار پیش‌فرض از پروژه‌ی اصلی (config.js) کپی شده؛ در صورت
   نیاز از طریق متغیر محیطی VITE_BACKEND_URL هم قابل override هست.
   ========================================================================= */

const FALLBACK_BACKEND_URL = "https://apexplannerbackend-production.up.railway.app";

export const APEX_CONFIG = {
  BACKEND_URL:
    (import.meta as any).env?.VITE_BACKEND_URL || FALLBACK_BACKEND_URL,
};

if (typeof window !== "undefined") {
  try {
    const backendOrigin = new URL(APEX_CONFIG.BACKEND_URL).origin;
    if (backendOrigin === window.location.origin) {
      // eslint-disable-next-line no-console
      console.error(
        "[اپکس پلنر] BACKEND_URL روی همون دامنه‌ی فرانت‌اند تنظیم شده! " +
          "این یعنی آدرس سرویس بکند (FastAPI) رو با آدرس همین فرانت‌اند اشتباه گرفتی."
      );
    }
  } catch {
    // eslint-disable-next-line no-console
    console.error("[اپکس پلنر] مقدار BACKEND_URL معتبر نیست: " + APEX_CONFIG.BACKEND_URL);
  }
}
