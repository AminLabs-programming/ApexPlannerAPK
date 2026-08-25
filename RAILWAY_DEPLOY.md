# راهنمای دیپلوی روی Railway

این پروژه اکنون شامل **بات تلگرام** و **اپلیکیشن وب** در یک سرویس واحد است که روی Railway دیپلوی می‌شود.

## ساختار پروژه

```
/workspace
├── main.py              # فایل اصلی (بات + سرور وب Flask)
├── local_db.py          # ماژول دیتابیس SQLite
├── requirements.txt     # وابستگی‌های Python
├── Procfile            # دستور اجرای Railway
├── .gitignore          # فایل‌های نادیده گرفته شده
├── index.html          # اپلیکیشن وب
├── app.js              # منطق اپلیکیشن
├── ...                 # سایر فایل‌های فرانت‌اند
└── bot.db              # دیتابیس (توسط Railway ساخته می‌شود)
```

## مراحل دیپلوی روی Railway

### ۱. آماده‌سازی ریپازیتوری GitHub

ابتدا تمام فایل‌ها را به ریپازیتوری GitHub خود پوش کنید:

```bash
git add .
git commit -m "Add Telegram bot + web app integration"
git push origin main
```

### ۲. ایجاد پروژه جدید در Railway

1. به [railway.app](https://railway.app) بروید
2. وارد حساب کاربری شوید
3. روی **"New Project"** کلیک کنید
4. گزینه **"Deploy from GitHub repo"** را انتخاب کنید
5. ریپازیتوری مورد نظر را انتخاب کنید

### ۳. تنظیم متغیرهای محیطی (Environment Variables)

در پنل Railway، به بخش **"Variables"** بروید و متغیرهای زیر را اضافه کنید:

#### متغیرهای ضروری:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
NOTION_TOKEN=your_notion_token_here
NOTION_PLAN_DATABASE_ID=your_database_id_here
TIMEZONE=Asia/Tehran
```

#### متغیرهای اختیاری:
```
NOTION_REPORT_DATABASE_ID=your_report_db_id
NOTION_WEEKLY_META_DATABASE_ID=your_weekly_meta_db_id
NOTION_DAILY_META_DATABASE_ID=your_daily_meta_db_id
INVITE_CODE=your_invite_code
PORT=5000
```

### ۴. دریافت مقادیر متغیرها

#### TELEGRAM_BOT_TOKEN:
- در تلگرام با @BotFather صحبت کنید
- دستور `/newbot` را بفرستید
- نام و یوزرنیم بات را وارد کنید
- توکن دریافتی را کپی کنید

#### TELEGRAM_CHAT_ID:
- در تلگرام با @userinfobot صحبت کنید
- یا از @RawDataBot استفاده کنید
- Chat ID عددی خود را دریافت کنید

#### NOTION_TOKEN:
- به [my.notion.so](https://www.notion.so/my-integrations) بروید
- روی **"+ New integration"** کلیک کنید
- نام، لوگو و توضیحات را وارد کنید
- توکن Internal Integration Token را کپی کنید

#### NOTION_PLAN_DATABASE_ID:
- به صفحه دیتابیس Notion خود بروید
- URL را کپی کنید (بخش بعد از `/` و قبل از `?`)
- مثال: `https://notion.so/abc123...` → `abc123...`
- در Notion، به دیتابیس رفته و Integration خود را اضافه کنید (Share → Add connections)

### ۵. دیپلوی نهایی

1. پس از تنظیم متغیرها، Railway به‌طور خودکار شروع به بیلد می‌کند
2. صبر کنید تا فرآیند تکمیل شود (حدود ۲-۵ دقیقه)
3. پس از اتمام، یک دامنه عمومی به شما داده می‌شود
4. برای دسترسی به اپلیکیشن وب، روی دامنه کلیک کنید
5. برای تست بات، به تلگرام رفته و بات را استارت کنید

### ۶. بررسی لاگ‌ها

اگر مشکلی پیش آمد:
1. به بخش **"Deployments"** در Railway بروید
2. روی آخرین deployment کلیک کنید
3. لاگ‌ها را بررسی کنید

## نکات مهم

### امنیت
- هرگز توکن‌ها را در کد قرار ندهید
- فقط از Environment Variables استفاده کنید
- فایل `.env` را در git commit نکنید

### دیتابیس
- دیتابیس SQLite (`bot.db`) به‌صورت خودکار ساخته می‌شود
- برای پایداری بیشتر، می‌توانید از PostgreSQL Railway استفاده کنید

### آپدیت پروژه
برای آپدیت پروژه بعد از تغییرات:
```bash
git add .
git commit -m "Update description"
git push origin main
```
Railway به‌طور خودکار تغییرات را تشخیص داده و دیپلوی می‌کند.

### محدودیت‌های Railway رایگان
- ۵۰۰ ساعت اجرا در ماه
- ۱ گیگابایت رم
- ممکن است پس از عدم فعالیت، سرویس غیرفعال شود

## عیب‌یابی

### بات تلگرام کار نمی‌کند
- توکن را بررسی کنید
- Chat ID صحیح است؟
- لاگ‌های Railway را چک کنید

### اپلیکیشن وب لود نمی‌شود
- مطمئن شوید `index.html` در ریشه پروژه است
- خطاهای کنسول مرورگر را بررسی کنید

### خطای Database
- مطمئن شوید `local_db.py` دسترسی نوشتن دارد
- در Railway، فایل‌ها موقتی هستند؛ برای داده‌های دائمی از PostgreSQL استفاده کنید

## پشتیبانی

اگر سوالی دارید، مستندات Railway را مطالعه کنید:
- https://docs.railway.app/
