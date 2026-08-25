"""
ربات تلگرام پیگیری برنامه کنکور - متصل به Notion

این ربات کاری که انجام می‌دهد:
1. صبح‌ها کل چک‌لیست امروز را با دکمه "انجام شد" می‌فرستد.
2. سه بار در روز (صبح، ظهر، شب) چک‌این می‌کند: چقدر از برنامه را انجام داده‌ای؟
3. یک منوی دکمه‌ای دائمی زیر چت دارد (Reply Keyboard) که همه امکانات از آنجا در دسترس است.
4. گزارش کار درسی: برای هر پارت درسی که انجام می‌دهی، دقیقه مطالعه و تعداد تست را می‌پرسد
   و در نهایت یک فرم استاندارد می‌سازد که می‌توانی برای مشاورت بفرستی. این فرم ساعت ۱ بامداد
   هم به‌صورت خودکار فرستاده می‌شود.
5. تاریخ‌ها به‌صورت خودکار از میلادی (فرمت Notion) به شمسی تبدیل می‌شوند.
"""

import os
import logging
from datetime import datetime, time as dtime, timedelta
import pytz
import jdatetime

from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    KeyboardButton,
)
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    JobQueue,
    filters,
)
from notion_client import Client as NotionClient
import local_db

# ---------------------------------------------------------------------------
# تنظیمات - اینها را از متغیرهای محیطی (Environment Variables) می‌خوانیم
# ---------------------------------------------------------------------------

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]
NOTION_TOKEN = os.environ["NOTION_TOKEN"]
NOTION_PLAN_DATABASE_ID = os.environ["NOTION_PLAN_DATABASE_ID"]
NOTION_REPORT_DATABASE_ID = os.environ.get("NOTION_REPORT_DATABASE_ID", "")  # اختیاری
# دیتابیس کوچیک و اختیاری Notion برای «هدف درسی هفته / Level Up / نوت پایان هفته».
# هر رکورد این دیتابیس یک هفته رو نشون می‌ده؛ پراپرتی‌های موردنیاز:
#   WeekStart (Date) - تاریخ میلادی شروع هفته (شنبه)
#   StudyGoal (Rich text)
#   LevelUp   (Rich text) - هر آیتم تو یک خط جدا
#   Note      (Rich text)
# اگه این دیتابیس تنظیم نشه، یا رکورد اون هفته خالی/غایب باشه، بات همون‌جا تو چت می‌پرسه.
NOTION_WEEKLY_META_DATABASE_ID = os.environ.get("NOTION_WEEKLY_META_DATABASE_ID", "")
# مثل بالا ولی برای «اولویت‌های امروز / اهداف امروز» تو قالب روزانه (اختیاری).
# پراپرتی‌های موردنیاز: Date (Date), Priorities (Rich text، هر آیتم یک خط جدا), Goals (Rich text)
NOTION_DAILY_META_DATABASE_ID = os.environ.get("NOTION_DAILY_META_DATABASE_ID", "")
TIMEZONE = os.environ.get("TIMEZONE", "Asia/Tehran")
INVITE_CODE = os.environ.get("INVITE_CODE", "")  # کد دعوت برای ثبت‌نام کاربران جدید (بدون Notion)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

notion = NotionClient(auth=NOTION_TOKEN)
tz = pytz.timezone(TIMEZONE)

_reminded_today: set[str] = set()
_last_reset_date: str = ""

# متن دکمه‌های منوی ثابت (Reply Keyboard) - اینها به‌عنوان "متن پیام" از طرف کاربر می‌آیند
BTN_CHECKLIST = "🎯 چک‌لیست امروز"
BTN_TODAY = "🗓 برنامه امروز"
BTN_STUDY_REPORT = "🧾 گزارش کار درسی"
BTN_DAILY_REPORT = "📈 گزارش کلی"
BTN_WEEKLY_STATS = "📊 آمار هفتگی"
BTN_ADD_PLAN = "📝 ثبت برنامه هفته"
BTN_WEEKLY_TEMPLATE = "🗓 قالب هفتگی"
BTN_DAILY_TEMPLATE = "📆 قالب روزانه"


def build_main_menu(chat_id: int) -> ReplyKeyboardMarkup:
    """منوی پایین چت را می‌سازد. برای کاربران بدون Notion، دکمه‌ی «ثبت برنامه هفته» هم اضافه می‌شود.
    دکمه‌های «قالب هفتگی/روزانه» فقط برای کاربر Notion نمایش داده می‌شوند (طبق تصمیم قبلی)."""
    rows = [
        [KeyboardButton(BTN_CHECKLIST), KeyboardButton(BTN_TODAY)],
        [KeyboardButton(BTN_STUDY_REPORT), KeyboardButton(BTN_DAILY_REPORT)],
        [KeyboardButton(BTN_WEEKLY_STATS)],
    ]
    if _is_notion_user(chat_id):
        rows.append([KeyboardButton(BTN_WEEKLY_TEMPLATE), KeyboardButton(BTN_DAILY_TEMPLATE)])
    if not _is_notion_user(chat_id):
        rows.append([KeyboardButton(BTN_ADD_PLAN)])
    return ReplyKeyboardMarkup(rows, resize_keyboard=True)


# نسخه‌ی ایستا برای جاهایی که هنوز chat_id در دسترس نیست (فقط برای کاربر Notion استفاده شود)
MAIN_MENU = ReplyKeyboardMarkup(
    [
        [KeyboardButton(BTN_CHECKLIST), KeyboardButton(BTN_TODAY)],
        [KeyboardButton(BTN_STUDY_REPORT), KeyboardButton(BTN_DAILY_REPORT)],
        [KeyboardButton(BTN_WEEKLY_STATS)],
    ],
    resize_keyboard=True,
)

# وضعیت مکالمه‌ی «گزارش کار درسی»: وقتی منتظر جواب کاربر (دقیقه یا تست) هستیم
# ساختار: {"stage": "await_minutes" | "await_tests", "page_id": ..., "title": ...}
_study_report_state: dict = {}

# وضعیت مکالمه‌ی «ثبت برنامه هفته» برای کاربرانی که Notion ندارند
# ساختار: {"stage": "await_day"|"await_part_name"|"await_more_parts"|"await_more_days",
#           "date": "YYYY-MM-DD"}
_plan_entry_state: dict = {}

# وضعیت مکالمه‌ی «تکمیل اطلاعات قالب هفتگی» (وقتی هدف درسی/Level Up/نوت تو Notion خالیه)
# ساختار: {"stage": "await_goal"|"await_levelup"|"await_note", "week_start":..., "week_end":...,
#           "day_texts": {...}, "goal": None|str, "levelup": None|list, "note": None|str}
_template_meta_state: dict = {}

# وضعیت مکالمه‌ی «گزارش کار روز دیگر»: منتظر تایپ تاریخ شمسی هستیم
_other_day_report_state: set = set()

# وضعیت مکالمه‌ی «ویرایش پارت»: چه فیلدی از کدوم پارت در حال ویرایش است
# ساختار: {"stage": "await_new_minutes"|"await_new_tests", "item_id": ..., "chat_id_of_owner": ...}
_edit_item_state: dict = {}



# کاربرانی که /start زدند ولی هنوز کد دعوت درست نفرستادند
_pending_invite: set = set()


# ---------------------------------------------------------------------------
# توابع کمکی تاریخ
# ---------------------------------------------------------------------------

def gregorian_to_jalali_str(date_str: str) -> str:
    """تاریخ میلادی مثل 2026-08-08 را به شمسی مثل ۱۴۰۵/۰۵/۱۷ تبدیل می‌کند."""
    try:
        y, m, d = map(int, date_str.split("-")[:3])
        j = jdatetime.date.fromgregorian(year=y, month=m, day=d)
        return j.strftime("%Y/%m/%d")
    except Exception:
        return date_str


def jalali_str_to_gregorian(jalali_str: str) -> str:
    """تاریخ شمسی مثل ۱۴۰۵/۰۵/۱۷ یا 1405-05-17 را به میلادی YYYY-MM-DD تبدیل می‌کند.
    اگر تاریخ نامعتبر باشد، ValueError می‌دهد."""
    # تبدیل اعداد فارسی به انگلیسی و یکسان‌سازی جداکننده
    fa_digits = "۰۱۲۳۴۵۶۷۸۹"
    en_digits = "0123456789"
    table = str.maketrans(fa_digits, en_digits)
    normalized = jalali_str.strip().translate(table).replace("-", "/")
    y, m, d = map(int, normalized.split("/")[:3])
    g = jdatetime.date(year=y, month=m, day=d).togregorian()
    return g.strftime("%Y-%m-%d")


def today_gregorian_str() -> str:
    return datetime.now(tz).strftime("%Y-%m-%d")


def get_jalali_week_range(reference_date=None):
    """بازه‌ی هفته‌ی شمسی (شنبه تا جمعه) شامل reference_date را برمی‌گرداند.
    خروجی: (start_gregorian_date, end_gregorian_date) هر دو از نوع datetime.date"""
    if reference_date is None:
        reference_date = datetime.now(tz).date()

    j_today = jdatetime.date.fromgregorian(date=reference_date)
    days_since_saturday = j_today.weekday()  # شنبه=۰ ... جمعه=۶
    j_start = j_today - jdatetime.timedelta(days=days_since_saturday)
    j_end = j_start + jdatetime.timedelta(days=6)

    return j_start.togregorian(), j_end.togregorian()


def get_weekly_stats_range(reference_date=None):
    """بازه‌ی مخصوص «آمار هفتگی»: از پنجشنبه (روز/قبل از reference_date) تا پایان
    پنجشنبه‌ی بعد - یعنی ۸ روز، با پنجشنبه در هر دو سر بازه (طبق درخواست کاربر).
    توجه: چون هر دو پنجشنبه‌ی مرزی حساب می‌شن، پنجشنبه‌ی مشترک بین دو هفته‌ی
    پشت‌سرهم هم در «آمار هفته‌ی قبل» (به‌عنوان روز آخر) و هم در «آمار هفته‌ی جاری»
    (به‌عنوان روز اول) شمرده می‌شه - این هم‌پوشانی عمدیه، نه باگ.
    خروجی: (start_gregorian_date, end_gregorian_date)"""
    if reference_date is None:
        reference_date = datetime.now(tz).date()

    j_today = jdatetime.date.fromgregorian(date=reference_date)
    THURSDAY_INDEX = 5  # شنبه=۰ ... پنجشنبه=۵ ... جمعه=۶
    days_since_thursday = (j_today.weekday() - THURSDAY_INDEX) % 7
    j_start = j_today - jdatetime.timedelta(days=days_since_thursday)
    j_end = j_start + jdatetime.timedelta(days=7)  # پنجشنبه‌ی بعد (۸ روز کامل)

    return j_start.togregorian(), j_end.togregorian()


def today_jalali_str() -> str:
    return gregorian_to_jalali_str(today_gregorian_str())


def format_minutes(total_minutes: int) -> str:
    """دقیقه را به فرمت 'X ساعت و Y دقیقه' تبدیل می‌کند."""
    hours = total_minutes // 60
    minutes = total_minutes % 60
    if hours and minutes:
        return f"{hours} ساعت و {minutes} دقیقه"
    if hours:
        return f"{hours} ساعت"
    return f"{minutes} دقیقه"


# ---------------------------------------------------------------------------
# توابع کمکی برای کار با Notion
# ---------------------------------------------------------------------------

def _reset_daily_state_if_needed():
    global _last_reset_date
    today = today_gregorian_str()
    if today != _last_reset_date:
        _reminded_today.clear()
        _last_reset_date = today
        logger.info("وضعیت روزانه ریست شد برای تاریخ %s", today)


def _is_notion_user(chat_id: int) -> bool:
    """فقط کاربر اصلی (محمدامین) از Notion استفاده می‌کند. بقیه از دیتابیس محلی."""
    return str(chat_id) == str(TELEGRAM_CHAT_ID)


def _notion_page_to_dict(page) -> dict:
    """یک page خام Notion را به همان فرمت ساده‌ی دیکشنری تبدیل می‌کند که SQLite برمی‌گرداند."""
    date_prop = page["properties"].get("Date", {}).get("date")
    date_str = date_prop["start"][:10] if date_prop and date_prop.get("start") else ""
    return {
        "id": page["id"],
        "name": _get_text_prop(page, "Name", "بدون‌نام"),
        "date": date_str,
        "category": _get_select_prop(page, "Category", ""),
        "status": 1 if _get_checkbox_prop(page, "Status") else 0,
        "study_minutes": _get_number_prop(page, "StudyMinutes", 0),
        "test_count": _get_number_prop(page, "TestCount", 0),
        # پراپرتی اختیاری Notion برای بازه/ساعتِ دلخواه هر پارت (مثلاً "8:00-9:30").
        # اگه تو دیتابیس Notion این پراپرتی رو نساخته باشید، همیشه رشته‌ی خالی برمی‌گرده
        # (نه خطا)، چون _get_text_prop برای پراپرتی‌ای که وجود نداره مقدار پیش‌فرض می‌ده.
        "time_label": _get_text_prop(page, "Time", ""),
        "_raw_notion_page": page,  # برای مواردی که هنوز به page خام Notion نیاز است (مثل create_makeup_item)
    }


def get_today_plan_items(chat_id: int):
    """همه آیتم‌های برنامه امروز کاربر را برمی‌گرداند (دیکشنری ساده، مستقل از منبع داده)."""
    today = today_gregorian_str()
    if _is_notion_user(chat_id):
        response = notion.databases.query(
            database_id=NOTION_PLAN_DATABASE_ID,
            filter={"property": "Date", "date": {"equals": today}},
        )
        return [_notion_page_to_dict(p) for p in response.get("results", [])]
    else:
        return local_db.get_items_for_date(chat_id, today)


def _get_text_prop(page, prop_name, default=""):
    # اگه دیکشنری ساده (خروجی SQLite یا _notion_page_to_dict) باشه، مستقیم بخون
    if "properties" not in page:
        key_map = {"Name": "name"}
        return page.get(key_map.get(prop_name, prop_name.lower()), default)

    prop = page["properties"].get(prop_name, {})
    prop_type = prop.get("type")
    if prop_type == "title":
        arr = prop.get("title", [])
    elif prop_type == "rich_text":
        arr = prop.get("rich_text", [])
    else:
        return default
    return arr[0]["plain_text"] if arr else default


def _get_select_prop(page, prop_name, default=""):
    if "properties" not in page:
        key_map = {"Category": "category"}
        return page.get(key_map.get(prop_name, prop_name.lower()), default)

    prop = page["properties"].get(prop_name, {})
    sel = prop.get("select")
    return sel["name"] if sel else default


def _get_checkbox_prop(page, prop_name, default=False):
    if "properties" not in page:
        key_map = {"Status": "status"}
        val = page.get(key_map.get(prop_name, prop_name.lower()))
        return bool(val) if val is not None else default

    prop = page["properties"].get(prop_name, {})
    val = prop.get("checkbox")
    return val if val is not None else default


def _get_date_prop(page, default="") -> str:
    """تاریخ را چه از Notion page خام، چه از دیکشنری ساده (SQLite) می‌خواند."""
    if "properties" not in page:
        return page.get("date", default)
    date_prop = page["properties"].get("Date", {}).get("date")
    return date_prop["start"][:10] if date_prop and date_prop.get("start") else default


def _get_number_prop(page, prop_name, default=0):
    if "properties" not in page:
        key_map = {"StudyMinutes": "study_minutes", "TestCount": "test_count"}
        val = page.get(key_map.get(prop_name, prop_name.lower()))
        return val if val is not None else default

    prop = page["properties"].get(prop_name, {})
    val = prop.get("number")
    return val if val is not None else default


def get_plan_items_between(chat_id: int, start_date: str, end_date: str):
    """همه آیتم‌های برنامه‌ی کاربر بین دو تاریخ (شامل هر دو سر بازه) را برمی‌گرداند."""
    if _is_notion_user(chat_id):
        response = notion.databases.query(
            database_id=NOTION_PLAN_DATABASE_ID,
            filter={
                "and": [
                    {"property": "Date", "date": {"on_or_after": start_date}},
                    {"property": "Date", "date": {"on_or_before": end_date}},
                ]
            },
        )
        return [_notion_page_to_dict(p) for p in response.get("results", [])]
    else:
        return local_db.get_items_between(chat_id, start_date, end_date)


def mark_item_done(chat_id: int, item_id: str, done: bool = True):
    if _is_notion_user(chat_id):
        notion.pages.update(page_id=item_id, properties={"Status": {"checkbox": done}})
    else:
        local_db.mark_item_done(item_id, done)


def save_study_data(chat_id: int, item_id: str, minutes: int, tests: int, mark_done: bool = True):
    """دقیقه مطالعه و تعداد تست یک پارت درسی را ذخیره می‌کند.
    اگر mark_done=True باشد (یعنی کامل انجام شده)، Status هم تیک می‌خورد.
    اگر mark_done=False باشد (یعنی ناقص)، Status دست‌نخورده می‌ماند."""
    if _is_notion_user(chat_id):
        properties = {
            "StudyMinutes": {"number": minutes},
            "TestCount": {"number": tests},
        }
        if mark_done:
            properties["Status"] = {"checkbox": True}
        notion.pages.update(page_id=item_id, properties=properties)
    else:
        local_db.save_study_data(item_id, minutes, tests, mark_done)


def get_item_by_id(chat_id: int, item_id: str) -> dict:
    """یک پارت مشخص را با شناسه‌اش برمی‌گرداند (دیکشنری ساده، مستقل از منبع داده)."""
    if _is_notion_user(chat_id):
        page = notion.pages.retrieve(page_id=item_id)
        return _notion_page_to_dict(page)
    else:
        return local_db.get_item_by_id(item_id)


def delete_item(chat_id: int, item_id: str):
    """یک پارت را کامل حذف می‌کند (چه از برنامه، چه از گزارش کار)."""
    if _is_notion_user(chat_id):
        notion.pages.update(page_id=item_id, archived=True)
    else:
        local_db.delete_item(item_id)


def update_item_full(chat_id: int, item_id: str, status: bool = None, minutes: int = None, tests: int = None):
    """فیلدهای دلخواه یک پارت را آپدیت می‌کند (برای ویرایش گزارش روزهای قبل)."""
    if _is_notion_user(chat_id):
        properties = {}
        if status is not None:
            properties["Status"] = {"checkbox": status}
        if minutes is not None:
            properties["StudyMinutes"] = {"number": minutes}
        if tests is not None:
            properties["TestCount"] = {"number": tests}
        if properties:
            notion.pages.update(page_id=item_id, properties=properties)
    else:
        local_db.update_item_full(item_id, status=status, minutes=minutes, tests=tests)


def create_makeup_item(chat_id: int, original_item: dict, tomorrow_date: str):
    """برای پارت ناقص/انجام‌نشده، یک کپی جدید با عنوان «(جبرانی)» برای فردا می‌سازد."""
    if _is_notion_user(chat_id):
        title = original_item["name"]
        category = original_item.get("category", "درسی")
        new_title = title if "(جبرانی)" in title else f"{title} (جبرانی)"
        notion.pages.create(
            parent={"database_id": NOTION_PLAN_DATABASE_ID},
            properties={
                "Name": {"title": [{"text": {"content": new_title}}]},
                "Date": {"date": {"start": tomorrow_date}},
                "Category": {"select": {"name": category}},
                "Status": {"checkbox": False},
            },
        )
    else:
        local_db.create_makeup_item(original_item, tomorrow_date)


def create_report_entry(summary: str, done_percent: int):
    if not NOTION_REPORT_DATABASE_ID:
        return
    today = today_gregorian_str()
    notion.pages.create(
        parent={"database_id": NOTION_REPORT_DATABASE_ID},
        properties={
            "Name": {"title": [{"text": {"content": f"گزارش {today}"}}]},
            "Date": {"date": {"start": today}},
            "Progress": {"number": done_percent},
            "Notes": {"rich_text": [{"text": {"content": summary}}]},
        },
    )


def get_weekly_meta_from_notion(week_start_str: str):
    """هدف درسی هفته/Level Up/نوت پایان هفته را از دیتابیس WeeklyMeta می‌خواند (اگه تنظیم شده باشه).
    خروجی: {"goal": str|None, "levelup": list[str]|None, "note": str|None}
    هر فیلدی که تو Notion خالی/غایب باشه، None برمی‌گرده تا بات بعداً تو چت بپرسه."""
    empty = {"goal": None, "levelup": None, "note": None}
    if not NOTION_WEEKLY_META_DATABASE_ID:
        return empty
    try:
        response = notion.databases.query(
            database_id=NOTION_WEEKLY_META_DATABASE_ID,
            filter={"property": "WeekStart", "date": {"equals": week_start_str}},
        )
    except Exception as e:
        logger.error("خطا در خوندن WeeklyMeta از Notion: %s", e)
        return empty

    results = response.get("results", [])
    if not results:
        return empty
    page = results[0]

    def _rich_text(prop_name):
        prop = page["properties"].get(prop_name, {})
        arr = prop.get("rich_text", [])
        text = "".join(t.get("plain_text", "") for t in arr).strip()
        return text or None

    goal = _rich_text("StudyGoal")
    note = _rich_text("Note")
    levelup_raw = _rich_text("LevelUp")
    levelup = [ln.strip() for ln in levelup_raw.split("\n") if ln.strip()] if levelup_raw else None
    return {"goal": goal, "levelup": levelup, "note": note}


def get_daily_meta_from_notion(date_str: str):
    """اولویت‌های امروز/اهداف امروز را از دیتابیس DailyMeta می‌خواند (اگه تنظیم شده باشه).
    خروجی: {"priorities": list[str]|None, "goals": str|None}"""
    empty = {"priorities": None, "goals": None}
    if not NOTION_DAILY_META_DATABASE_ID:
        return empty
    try:
        response = notion.databases.query(
            database_id=NOTION_DAILY_META_DATABASE_ID,
            filter={"property": "Date", "date": {"equals": date_str}},
        )
    except Exception as e:
        logger.error("خطا در خوندن DailyMeta از Notion: %s", e)
        return empty

    results = response.get("results", [])
    if not results:
        return empty
    page = results[0]

    def _rich_text(prop_name):
        prop = page["properties"].get(prop_name, {})
        arr = prop.get("rich_text", [])
        text = "".join(t.get("plain_text", "") for t in arr).strip()
        return text or None

    goals = _rich_text("Goals")
    pr_raw = _rich_text("Priorities")
    priorities = [ln.strip() for ln in pr_raw.split("\n") if ln.strip()][:5] if pr_raw else None
    return {"priorities": priorities, "goals": goals}


# ---------------------------------------------------------------------------
# چک‌لیست صبحگاهی
# ---------------------------------------------------------------------------

_NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]


def _number_label(i: int) -> str:
    return _NUMBER_EMOJIS[i] if i < len(_NUMBER_EMOJIS) else str(i + 1)


async def send_today_checklist_for(context: ContextTypes.DEFAULT_TYPE, chat_id: int):
    """چک‌لیست امروز را برای یک کاربر مشخص، به‌صورت یک پیام واحد و جمع‌وجور می‌فرستد."""
    try:
        items = get_today_plan_items(chat_id)
    except Exception as e:
        logger.error("خطا در خواندن برنامه برای %s: %s", chat_id, e)
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"⚠️ نتونستم برنامه امروز رو بخونم. خطا: {e}",
        )
        return

    if not items:
        await context.bot.send_message(
            chat_id=chat_id,
            text="🗓 برای امروز هیچ برنامه‌ای ثبت نکردی. برو برنامه رو وارد کن!",
            reply_markup=build_main_menu(chat_id),
        )
        return

    await send_checklist_message(context, chat_id, items)


async def build_checklist_text_and_keyboard(items: list) -> tuple:
    """از لیست آیتم‌ها، متن لیست شماره‌دار و کیبورد شیشه‌ای دکمه‌های شماره‌دار می‌سازد."""
    lines = [f"🎯 برنامه امروز ({today_jalali_str()}) — {len(items)} پارت\n"]
    buttons_row = []
    all_done = True

    for i, page in enumerate(items):
        title = _get_text_prop(page, "Name", "بدون‌نام")
        done = _get_checkbox_prop(page, "Status")
        emoji = "✅" if done else "⏳"
        if not done:
            all_done = False
        lines.append(f"{_number_label(i)} {emoji} {title}")

        if not done:
            page_id = page["id"]
            buttons_row.append(
                InlineKeyboardButton(_number_label(i), callback_data=f"chk|{page_id}")
            )

    text = "\n".join(lines)

    if all_done:
        text += "\n\n🎉 همه‌چیز انجام شده!"
        return text, None

    # دکمه‌ها را در ردیف‌های ۵تایی بچین تا شلوغ نشه
    keyboard_rows = [buttons_row[i:i + 5] for i in range(0, len(buttons_row), 5)]
    keyboard = InlineKeyboardMarkup(keyboard_rows)
    return text, keyboard


async def send_checklist_message(context: ContextTypes.DEFAULT_TYPE, chat_id: int, items: list):
    text, keyboard = await build_checklist_text_and_keyboard(items)
    await context.bot.send_message(
        chat_id=chat_id, text=text, reply_markup=keyboard or build_main_menu(chat_id)
    )


async def send_today_checklist(context: ContextTypes.DEFAULT_TYPE):
    """Job زمان‌بندی‌شده: چک‌لیست صبح را برای همه‌ی کاربران (محمدامین + کاربران محلی) می‌فرستد."""
    _reset_daily_state_if_needed()
    all_chat_ids = [int(TELEGRAM_CHAT_ID)] + local_db.get_all_local_chat_ids()
    for cid in all_chat_ids:
        await send_today_checklist_for(context, cid)


# ---------------------------------------------------------------------------
# چک‌این‌های سه‌گانه
# ---------------------------------------------------------------------------

async def send_checkin(context: ContextTypes.DEFAULT_TYPE, label: str):
    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("0-25٪", callback_data="checkin|25"),
                InlineKeyboardButton("25-50٪", callback_data="checkin|50"),
            ],
            [
                InlineKeyboardButton("50-75٪", callback_data="checkin|75"),
                InlineKeyboardButton("75-100٪", callback_data="checkin|100"),
            ],
        ]
    )
    all_chat_ids = [int(TELEGRAM_CHAT_ID)] + local_db.get_all_local_chat_ids()
    for cid in all_chat_ids:
        await context.bot.send_message(
            chat_id=cid,
            text=f"🔎 چک‌این {label}\n\nتا الان چقدر از برنامه امروزت رو انجام دادی؟",
            reply_markup=keyboard,
        )


async def morning_checkin(context: ContextTypes.DEFAULT_TYPE):
    await send_checkin(context, "صبح")


async def noon_checkin(context: ContextTypes.DEFAULT_TYPE):
    await send_checkin(context, "ظهر")


async def night_checkin(context: ContextTypes.DEFAULT_TYPE):
    await send_checkin(context, "شب")


# ---------------------------------------------------------------------------
# گزارش کلی پایان شب (قدیمی) - برای مشاور، خلاصه انجام‌شده/نشده
# ---------------------------------------------------------------------------

async def auto_carry_over_unfinished_for(context: ContextTypes.DEFAULT_TYPE, chat_id: int):
    """آخر شب: هر پارتی که تا حالا تیک نخورده، خودکار برای فردا کپی می‌شود."""
    try:
        items = get_today_plan_items(chat_id)
    except Exception as e:
        logger.error("خطا در carry-over برای %s: %s", chat_id, e)
        return

    tomorrow = (datetime.now(tz).date() + timedelta(days=1)).strftime("%Y-%m-%d")
    count = 0
    for item in items:
        if not _get_checkbox_prop(item, "Status"):
            try:
                create_makeup_item(chat_id, item, tomorrow)
                count += 1
            except Exception as e:
                logger.error("خطا در ساخت پارت جبرانی برای %s: %s", chat_id, e)

    if count:
        await context.bot.send_message(
            chat_id=chat_id, text=f"🔁 {count} پارت مونده امروز، خودکار برای فردا منتقل شد."
        )


async def auto_carry_over_unfinished(context: ContextTypes.DEFAULT_TYPE):
    all_chat_ids = [int(TELEGRAM_CHAT_ID)] + local_db.get_all_local_chat_ids()
    for cid in all_chat_ids:
        await auto_carry_over_unfinished_for(context, cid)


async def send_daily_report_for(context: ContextTypes.DEFAULT_TYPE, chat_id: int):
    try:
        items = get_today_plan_items(chat_id)
    except Exception as e:
        logger.error("خطا در ساخت گزارش برای %s: %s", chat_id, e)
        return

    done_items = []
    missed_items = []

    for page in items:
        title = _get_text_prop(page, "Name", "بدون‌نام")
        category = _get_select_prop(page, "Category", "")
        done = _get_checkbox_prop(page, "Status")
        line = f"• {title}" + (f" ({category})" if category else "")
        if done:
            done_items.append(line)
        else:
            missed_items.append(line)

    total = len(items)
    done_count = len(done_items)
    percent = round((done_count / total) * 100) if total else 0

    report_lines = [f"📊 گزارش روز {today_jalali_str()}", ""]
    report_lines.append(f"انجام‌شده: {done_count} از {total} ({percent}٪)")
    report_lines.append("")

    if done_items:
        report_lines.append("✅ انجام‌شده:")
        report_lines.extend(done_items)
        report_lines.append("")

    if missed_items:
        report_lines.append("❌ انجام‌نشده:")
        report_lines.extend(missed_items)

    report_text = "\n".join(report_lines)

    await context.bot.send_message(
        chat_id=chat_id,
        text=report_text + "\n\n💬 این گزارش رو می‌تونی مستقیم برای مشاورت فوروارد کنی.",
        reply_markup=build_main_menu(chat_id),
    )

    if _is_notion_user(chat_id):
        try:
            create_report_entry(report_text, percent)
        except Exception as e:
            logger.error("خطا در ذخیره گزارش در Notion: %s", e)


async def send_daily_report(context: ContextTypes.DEFAULT_TYPE):
    """Job زمان‌بندی‌شده: گزارش کلی شب را برای همه‌ی کاربران می‌فرستد."""
    all_chat_ids = [int(TELEGRAM_CHAT_ID)] + local_db.get_all_local_chat_ids()
    for cid in all_chat_ids:
        await send_daily_report_for(context, cid)


# ---------------------------------------------------------------------------
# گزارش کار درسی: فرم استاندارد بر اساس پارت‌های Category=درسی
# ---------------------------------------------------------------------------

async def build_study_report_text_for_date(chat_id: int, date_str: str) -> str:
    """گزارش کار درسی رسمی (به نام خدا / تاریخ / ...) را برای یک تاریخ مشخص می‌سازد."""
    items = get_plan_items_between(chat_id, date_str, date_str)

    lesson_items = [p for p in items if _get_select_prop(p, "Category") == "درسی"]

    studied_titles = []
    partial_titles = []
    missed_titles = []
    total_minutes = 0
    total_tests = 0

    for page in lesson_items:
        title = _get_text_prop(page, "Name", "بدون‌نام")
        done = _get_checkbox_prop(page, "Status")
        minutes = _get_number_prop(page, "StudyMinutes", 0)
        tests = _get_number_prop(page, "TestCount", 0)

        if done:
            studied_titles.append(title)
            total_minutes += minutes
            total_tests += tests
        elif minutes > 0 or tests > 0:
            # ناقص: کاری روش شده ولی کامل نشده - جزو ساعت مطالعه حساب میشه ولی جدا لیست میشه
            partial_titles.append(f"{title} ({minutes} دقیقه، {tests} تست)")
            total_minutes += minutes
            total_tests += tests
        else:
            missed_titles.append(title)

    lines = [
        "به نام خدا",
        f"تاریخ: {gregorian_to_jalali_str(date_str)}",
        f"درس‌های مطالعه‌شده: {'، '.join(studied_titles) if studied_titles else 'ندارد'}",
        f"ساعت مطالعه: {format_minutes(total_minutes) if total_minutes else '۰ دقیقه'}",
        f"تعداد تست: {total_tests}",
        f"پارت‌های ناقص: {'، '.join(partial_titles) if partial_titles else 'ندارد'}",
        f"پارت‌های انجام‌نشده: {'، '.join(missed_titles) if missed_titles else 'ندارد'}",
    ]
    return "\n".join(lines)


async def build_study_report_text(chat_id: int) -> str:
    return await build_study_report_text_for_date(chat_id, today_gregorian_str())


async def send_study_report_for(context: ContextTypes.DEFAULT_TYPE, chat_id: int):
    try:
        text = await build_study_report_text(chat_id)
    except Exception as e:
        logger.error("خطا در ساخت گزارش کار درسی برای %s: %s", chat_id, e)
        await context.bot.send_message(
            chat_id=chat_id, text=f"⚠️ خطا در ساخت گزارش کار درسی: {e}"
        )
        return

    await context.bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=build_main_menu(chat_id),
    )


async def send_study_report(context: ContextTypes.DEFAULT_TYPE):
    """Job زمان‌بندی‌شده: گزارش کار درسی ساعت ۱ بامداد را برای همه‌ی کاربران می‌فرستد."""
    all_chat_ids = [int(TELEGRAM_CHAT_ID)] + local_db.get_all_local_chat_ids()
    for cid in all_chat_ids:
        await send_study_report_for(context, cid)


# ---------------------------------------------------------------------------
# آمار هفتگی: جمع ساعت مطالعه و میانگین روزانه‌ی ۷ روز اخیر
# ---------------------------------------------------------------------------

async def build_weekly_stats_text(chat_id: int, week_start, week_end) -> str:
    """متن آماری خلاصه برای نمایش inline در تلگرام - بر اساس بازه‌ی هفته‌ی شمسی داده‌شده."""
    items = get_plan_items_between(chat_id, week_start.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d"))
    lesson_items = [p for p in items if _get_select_prop(p, "Category") == "درسی"]

    per_day_minutes: dict[str, int] = {}
    total_minutes = 0
    total_tests = 0
    studied_days = set()

    for page in lesson_items:
        done = _get_checkbox_prop(page, "Status")
        minutes = _get_number_prop(page, "StudyMinutes", 0)
        tests = _get_number_prop(page, "TestCount", 0)

        # همون معیار build_weekly_pdf_data: پارت‌های «ناقص انجام‌شده» (دقیقه/تست ثبت‌شده
        # ولی تیک Status نخورده) هم باید حساب بشن، وگرنه جمع ساعت/تست توی پیام متنی
        # با عدد داخل PDF فرق می‌کنه (باگی که قبلاً اینجا بود).
        if not done and minutes <= 0 and tests <= 0:
            continue

        page_date = _get_date_prop(page) or None
        total_minutes += minutes
        total_tests += tests
        if page_date:
            per_day_minutes[page_date] = per_day_minutes.get(page_date, 0) + minutes
            if minutes > 0:
                studied_days.add(page_date)

    days_with_study = len(studied_days) if studied_days else 1
    avg_minutes = round(total_minutes / days_with_study)

    lines = [
        f"📊 آمار هفتگی ({gregorian_to_jalali_str(week_start.strftime('%Y-%m-%d'))} تا {gregorian_to_jalali_str(week_end.strftime('%Y-%m-%d'))})",
        "",
        f"⏱ جمع ساعت مطالعه هفته: {format_minutes(total_minutes)}",
        f"📈 میانگین روزانه (روزهایی که خوندی): {format_minutes(avg_minutes)}",
        f"📝 جمع تست‌های هفته: {total_tests}",
        "",
        "📄 نمودار و جزئیات کامل توی PDF زیره...",
    ]

    return "\n".join(lines)


def _extract_subject_name(title: str) -> str:
    """اولین کلمه‌ی عنوان پارت را به‌عنوان نام درس در نظر می‌گیرد (مثلاً «ریاضی» از «ریاضی جلسه یک کرمی")."""
    return title.split()[0] if title.split() else "نامشخص"


async def build_weekly_pdf_data(chat_id: int, week_start, week_end) -> dict:
    """تمام داده‌های لازم برای ساخت PDF گزارش هفتگی را جمع‌آوری و محاسبه می‌کند."""
    items = get_plan_items_between(chat_id, week_start.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d"))
    lesson_items = [p for p in items if _get_select_prop(p, "Category") == "درسی"]

    per_day_minutes: dict[str, int] = {}
    total_minutes = 0
    total_tests = 0
    studied_days = set()
    completed_count = 0
    partial_count = 0
    missed_count = 0
    missed_items: list[str] = []
    partial_items: list[str] = []

    # آمار به‌تفکیک درس: {"ریاضی": {"minutes": ..., "tests": ..., "total": ..., "done": ...}}
    subject_stats: dict[str, dict] = {}

    for page in lesson_items:
        title = _get_text_prop(page, "Name", "بدون‌نام")
        done = _get_checkbox_prop(page, "Status")
        minutes = _get_number_prop(page, "StudyMinutes", 0)
        tests = _get_number_prop(page, "TestCount", 0)
        page_date = _get_date_prop(page) or None

        subject = _extract_subject_name(title)
        if subject not in subject_stats:
            subject_stats[subject] = {"minutes": 0, "tests": 0, "total": 0, "done": 0}
        subject_stats[subject]["total"] += 1

        if done:
            completed_count += 1
            subject_stats[subject]["done"] += 1
            subject_stats[subject]["minutes"] += minutes
            subject_stats[subject]["tests"] += tests
            total_minutes += minutes
            total_tests += tests
            if page_date:
                per_day_minutes[page_date] = per_day_minutes.get(page_date, 0) + minutes
                if minutes > 0:
                    studied_days.add(page_date)
        elif minutes > 0 or tests > 0:
            partial_count += 1
            partial_items.append(f"{title} «{minutes} دقیقه، {tests} تست»")
            subject_stats[subject]["minutes"] += minutes
            subject_stats[subject]["tests"] += tests
            total_minutes += minutes
            total_tests += tests
            if page_date:
                per_day_minutes[page_date] = per_day_minutes.get(page_date, 0) + minutes
                if minutes > 0:
                    studied_days.add(page_date)
        else:
            missed_count += 1
            missed_items.append(title)

    days_with_study = len(studied_days) if studied_days else 1
    avg_minutes = round(total_minutes / days_with_study)

    weekday_labels_fa = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"]
    day_labels = []
    day_hours = []
    d = week_start
    while d <= week_end:
        d_str = d.strftime("%Y-%m-%d")
        minutes = per_day_minutes.get(d_str, 0)
        day_hours.append(round(minutes / 60, 1))
        # برچسب روز رو بر اساس تاریخ واقعی محاسبه می‌کنیم، نه بر اساس ایندکس ثابت،
        # چون بازه‌ی «آمار هفتگی» ممکنه ۷ روزه نباشه (مثلاً پنجشنبه تا پنجشنبه = ۸ روز)
        # و در این حالت روز اول و آخر هر دو پنجشنبه‌ان.
        weekday_idx = jdatetime.date.fromgregorian(date=d).weekday()
        day_labels.append(weekday_labels_fa[weekday_idx])
        d += timedelta(days=1)

    # بهترین/بدترین روز
    if any(h > 0 for h in day_hours):
        best_idx = day_hours.index(max(day_hours))
        # بدترین روز: کمترین ساعت (شامل صفر) - جالب‌تر اینه کمترین غیرصفر رو نشون بدیم اگه همه صفر نبودن
        worst_idx = day_hours.index(min(day_hours))
    else:
        best_idx = worst_idx = 0

    best_day = day_labels[best_idx]
    best_day_hours = day_hours[best_idx]
    worst_day = day_labels[worst_idx]
    worst_day_hours = day_hours[worst_idx]

    # بیشترین تست در یک روز
    per_day_tests: dict[str, int] = {}
    for page in lesson_items:
        page_date = _get_date_prop(page) or None
        tests = _get_number_prop(page, "TestCount", 0)
        if page_date and tests:
            per_day_tests[page_date] = per_day_tests.get(page_date, 0) + tests

    if per_day_tests:
        most_tests_date = max(per_day_tests, key=per_day_tests.get)
        most_tests_count = per_day_tests[most_tests_date]
        most_tests_idx = (datetime.strptime(most_tests_date, "%Y-%m-%d").date() - week_start).days
        most_tests_day = day_labels[most_tests_idx] if 0 <= most_tests_idx < len(day_labels) else "-"
    else:
        most_tests_day = "-"
        most_tests_count = 0

    subjects = [
        {
            "name": name,
            "minutes": stats["minutes"],
            "tests": stats["tests"],
            "percent": round((stats["done"] / stats["total"]) * 100) if stats["total"] else 0,
        }
        for name, stats in subject_stats.items()
    ]
    # مرتب‌سازی بر اساس بیشترین دقیقه مطالعه
    subjects.sort(key=lambda s: s["minutes"], reverse=True)

    return {
        "total_minutes": total_minutes,
        "avg_minutes_per_studied_day": avg_minutes,
        "studied_days_count": len(studied_days),
        "total_tests": total_tests,
        "completed_count": completed_count,
        "partial_count": partial_count,
        "missed_count": missed_count,
        "missed_items": missed_items,
        "partial_items": partial_items,
        "day_labels": day_labels,
        "day_hours": day_hours,
        "subjects": subjects,
        "best_day": best_day,
        "best_day_hours": best_day_hours,
        "worst_day": worst_day,
        "worst_day_hours": worst_day_hours,
        "most_tests_day": most_tests_day,
        "most_tests_count": most_tests_count,
    }


async def generate_and_send_weekly_pdf(bot, chat_id, week_start, week_end, student_name: str = None):
    """داده‌ها را جمع می‌کند، PDF می‌سازد و برای کاربر می‌فرستد."""
    from pdf_report import generate_weekly_pdf
    import os as _os

    data = await build_weekly_pdf_data(chat_id, week_start, week_end)

    if not student_name:
        student_name = "محمدامین عبدالکریمی" if _is_notion_user(chat_id) else local_db.get_user_name(chat_id)

    output_dir = "/tmp"
    output_path = _os.path.join(
        output_dir, f"weekly_report_{chat_id}_{week_start.strftime('%Y%m%d')}.pdf"
    )

    pdf_kwargs = dict(
        output_path=output_path,
        student_name=student_name,
        week_start_jalali=gregorian_to_jalali_str(week_start.strftime("%Y-%m-%d")),
        week_end_jalali=gregorian_to_jalali_str(week_end.strftime("%Y-%m-%d")),
        generated_at_jalali=today_jalali_str(),
        total_minutes=data["total_minutes"],
        avg_minutes_per_studied_day=data["avg_minutes_per_studied_day"],
        studied_days_count=data["studied_days_count"],
        total_tests=data["total_tests"],
        completed_count=data["completed_count"],
        partial_count=data["partial_count"],
        missed_count=data["missed_count"],
        day_labels=data["day_labels"],
        day_hours=data["day_hours"],
        subjects=data["subjects"],
        best_day=data["best_day"],
        best_day_hours=data["best_day_hours"],
        worst_day=data["worst_day"],
        worst_day_hours=data["worst_day_hours"],
        most_tests_day=data["most_tests_day"],
        most_tests_count=data["most_tests_count"],
    )
    try:
        # اگه pdf_report.py آپدیت‌شده و این دو پارامتر رو قبول می‌کنه (صفحه‌ی دوم:
        # لیست پارت‌های ناقص/انجام‌نشده)، استفاده می‌شه. وگرنه بدون این دو پارامتر
        # صدا زده می‌شه تا با نسخه‌ی فعلی pdf_report.py هم کار کنه.
        generate_weekly_pdf(
            missed_items=data["missed_items"],
            partial_items=data["partial_items"],
            **pdf_kwargs,
        )
    except TypeError:
        generate_weekly_pdf(**pdf_kwargs)

    with open(output_path, "rb") as f:
        await bot.send_document(
            chat_id=chat_id,
            document=f,
            filename=f"گزارش-هفتگی-{gregorian_to_jalali_str(week_start.strftime('%Y-%m-%d')).replace('/', '-')}.pdf",
            caption="📄 گزارش هفتگی آماده‌ست — می‌تونی مستقیم برای مشاورت بفرستیش.",
        )

    if _os.path.exists(output_path):
        _os.remove(output_path)


async def send_weekly_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    await send_weekly_stats_for_offset(update.message, context, chat_id, week_offset=0)


async def send_weekly_stats_for_offset(message_or_query, context: ContextTypes.DEFAULT_TYPE, chat_id: int, week_offset: int):
    """آمار هفتگی را برای N هفته قبل از هفته‌ی جاری می‌فرستد (week_offset=0 یعنی هفته‌ی جاری)."""
    ref_date = datetime.now(tz).date() - timedelta(weeks=week_offset)
    week_start, week_end = get_weekly_stats_range(reference_date=ref_date)

    try:
        text = await build_weekly_stats_text(chat_id, week_start, week_end)
    except Exception as e:
        await context.bot.send_message(chat_id=chat_id, text=f"⚠️ خطا در ساخت آمار هفتگی: {e}")
        return

    nav_keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("⬅️ هفته قبل", callback_data=f"weekstat|{week_offset + 1}"),
                InlineKeyboardButton("هفته بعد ➡️", callback_data=f"weekstat|{week_offset - 1}"),
            ]
        ]
        if week_offset > 0
        else [[InlineKeyboardButton("⬅️ هفته قبل", callback_data=f"weekstat|{week_offset + 1}")]]
    )
    await context.bot.send_message(chat_id=chat_id, text=text, reply_markup=nav_keyboard)

    try:
        await generate_and_send_weekly_pdf(context.bot, chat_id, week_start, week_end)
    except Exception as e:
        await context.bot.send_message(chat_id=chat_id, text=f"⚠️ خطا در ساخت PDF: {e}")


async def auto_send_weekly_report_for(context: ContextTypes.DEFAULT_TYPE, chat_id: int):
    week_start, week_end = get_weekly_stats_range()

    try:
        text = await build_weekly_stats_text(chat_id, week_start, week_end)
        await context.bot.send_message(chat_id=chat_id, text=text, reply_markup=build_main_menu(chat_id))
    except Exception as e:
        logger.error("خطا در ساخت آمار هفتگی خودکار برای %s: %s", chat_id, e)
        return

    try:
        await generate_and_send_weekly_pdf(context.bot, chat_id, week_start, week_end)
    except Exception as e:
        logger.error("خطا در ساخت PDF هفتگی خودکار برای %s: %s", chat_id, e)


# ---------------------------------------------------------------------------
# قالب‌های عکسی هفتگی/روزانه (فقط برای کاربر Notion)
# ---------------------------------------------------------------------------

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")


def _weekday_index_saturday_zero(d) -> int:
    """۰=شنبه ... ۶=جمعه برای یک datetime.date."""
    jd = jdatetime.date.fromgregorian(date=d)
    return jd.weekday()


def _item_display_text(item: dict, include_category: bool = True) -> str:
    category = item.get("category") or ""
    name = item.get("name") or ""
    if include_category and category and name:
        return f"{category}: {name}"
    return name or category or "بدون‌نام"


async def _build_weekly_day_texts(chat_id: int, week_start, week_end) -> dict:
    """آیتم‌های Notion بین week_start و week_end رو می‌گیره و بر اساس روز هفته (۰=شنبه) دسته می‌کنه."""
    items = get_plan_items_between(chat_id, week_start.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d"))
    day_texts = {i: [] for i in range(7)}
    for item in items:
        date_str = _get_date_prop(item)
        if not date_str:
            continue
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            continue
        idx = _weekday_index_saturday_zero(d)
        day_texts[idx].append(_item_display_text(item, include_category=False))
    return day_texts


async def _finish_weekly_template(context: ContextTypes.DEFAULT_TYPE, chat_id: int, state: dict):
    """وقتی هدف/لول‌آپ/نوت کامل شدن (چه از Notion چه از چت)، عکس رو می‌سازه و می‌فرسته.
    فیلدهایی که از چت (نه Notion) پر شدن، تو کش محلی ذخیره می‌شن برای دفعه‌ی بعد همین هفته."""
    from templates.template_render import render_weekly_image

    week_start, week_end = state["week_start"], state["week_end"]
    week_start_str = week_start.strftime("%Y-%m-%d")
    week_label = (
        f"{gregorian_to_jalali_str(week_start_str)} "
        f"تا {gregorian_to_jalali_str(week_end.strftime('%Y-%m-%d'))}"
    )
    output_path = os.path.join("/tmp", f"weekly_template_{chat_id}_{week_start.strftime('%Y%m%d')}.png")
    try:
        render_weekly_image(
            week_range_label=week_label,
            day_texts=state["day_texts"],
            goal_text=state.get("goal") or "",
            levelup_items=state.get("levelup") or [],
            note_text=state.get("note") or "",
            output_path=output_path,
        )
        with open(output_path, "rb") as f:
            await context.bot.send_photo(
                chat_id=chat_id,
                photo=f,
                caption=f"🗓 قالب هفتگی — {week_label}",
                reply_markup=build_main_menu(chat_id),
            )
        # فقط فیلدهایی که از چت پر شدن (نه از Notion) رو کش می‌کنیم
        notion_fields = state.get("notion_fields", set())
        cache_data = {f: state.get(f) for f in ("goal", "levelup", "note") if f not in notion_fields}
        if cache_data:
            local_db.save_template_meta_cache(chat_id, "weekly", week_start_str, cache_data)
    except Exception as e:
        logger.error("خطا در ساخت قالب هفتگی: %s", e)
        await context.bot.send_message(chat_id=chat_id, text=f"⚠️ خطا در ساخت قالب هفتگی: {e}")
    finally:
        if os.path.exists(output_path):
            os.remove(output_path)
        _template_meta_state.pop(chat_id, None)


async def _advance_weekly_template_flow(update_or_context, context: ContextTypes.DEFAULT_TYPE, chat_id: int):
    """می‌بینه کدوم فیلد (هدف/لول‌آپ/نوت) هنوز خالیه و یا سوال بعدی رو می‌پرسه، یا اگه همه پر شدن رندر می‌کنه."""
    state = _template_meta_state[chat_id]
    editing = state.get("editing", False)
    cached = state.get("_cached") or {}

    if state.get("goal") is None:
        state["stage"] = "await_goal"
        prev = cached.get("goal") if editing else None
        hint = f"\n\nقبلی: «{prev}»\nهمین رو می‌خوای نگه‌داری؟ بنویس «-»، وگرنه متن جدید رو بفرست." if prev else ""
        await context.bot.send_message(chat_id=chat_id, text=f"🎯 هدف درسی این هفته چیه؟{hint}")
        return
    if state.get("levelup") is None:
        state["stage"] = "await_levelup"
        prev = cached.get("levelup") if editing else None
        hint = ("\n\nقبلی:\n" + "\n".join(prev) + "\n\nهمینا رو می‌خوای نگه‌داری؟ بنویس «-»، وگرنه از نو بفرست."
                ) if prev else ""
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"⭐ برای Level Up این هفته چی می‌نویسیم؟ (هر آیتم تو یه خط جدا، حداکثر ۳ تا){hint}",
        )
        return
    if state.get("note") is None:
        state["stage"] = "await_note"
        prev = cached.get("note") if editing else None
        if prev:
            await context.bot.send_message(
                chat_id=chat_id,
                text=f"📝 نوت پایان هفته؟\n\nقبلی: «{prev}»\nنگه‌داشتنش رو بنویس «-»، وگرنه متن جدید رو بفرست.",
            )
        else:
            await context.bot.send_message(chat_id=chat_id, text="📝 نوتی برای پایان هفته داری؟ اگه نه، بنویس «-»")
        return
    await _finish_weekly_template(context, chat_id, state)


async def handle_template_meta_text(update: Update, context: ContextTypes.DEFAULT_TYPE, state: dict):
    """جواب کاربر به سوالات متنی هدف/لول‌آپ/نوت (هفتگی) یا اولویت/اهداف (روزانه) رو پردازش می‌کنه."""
    chat_id = update.effective_chat.id
    text = update.message.text.strip()
    stage = state.get("stage")
    editing = state.get("editing", False)
    cached = state.get("_cached") or {}

    if state.get("kind") == "daily":
        await handle_daily_meta_text(update, context, state)
        return

    if stage == "await_goal":
        if text == "-" and editing and cached.get("goal"):
            state["goal"] = cached["goal"]
        else:
            state["goal"] = text
    elif stage == "await_levelup":
        if text == "-" and editing and cached.get("levelup"):
            state["levelup"] = cached["levelup"]
        else:
            state["levelup"] = [ln.strip() for ln in text.split("\n") if ln.strip()][:3]
    elif stage == "await_note":
        if text == "-" and editing and cached.get("note"):
            state["note"] = cached["note"]
        else:
            state["note"] = "" if text == "-" else text

    await _advance_weekly_template_flow(update, context, chat_id)


async def send_weekly_template(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """دکمه‌ی «قالب هفتگی»: داده‌ها رو از Notion جمع می‌کنه؛ اگه هدف/لول‌آپ/نوت خالی بود، تو چت می‌پرسه
    (یا اگه از قبل همین هفته یه‌بار پر شده بودن، بین نگه‌داشتن/ویرایش/نوشتن‌از‌نو یکی رو انتخاب می‌کنه)."""
    chat_id = update.effective_chat.id
    if not _is_notion_user(chat_id):
        await update.message.reply_text("این قابلیت فعلاً فقط برای حساب متصل به Notion فعاله.")
        return

    week_start, week_end = get_jalali_week_range()  # شنبه تا جمعه - طبق تصمیم قبلی، جدا از آمار هفتگی
    week_start_str = week_start.strftime("%Y-%m-%d")
    await update.message.reply_text("⏳ در حال جمع‌آوری برنامه‌ی این هفته از Notion...")

    day_texts = await _build_weekly_day_texts(chat_id, week_start, week_end)
    meta = get_weekly_meta_from_notion(week_start_str)
    cached = local_db.get_template_meta_cache(chat_id, "weekly", week_start_str) or {}

    state = {
        "kind": "weekly",
        "week_start": week_start,
        "week_end": week_end,
        "day_texts": day_texts,
        "goal": meta["goal"],
        "levelup": meta["levelup"],
        "note": meta["note"],
        "notion_fields": {f for f in ("goal", "levelup", "note") if meta[f] is not None},
        "_cached": cached,
    }
    _template_meta_state[chat_id] = state

    chat_needed = [f for f in ("goal", "levelup", "note") if state[f] is None]
    has_cache_for_needed = any(cached.get(f) for f in chat_needed)

    if chat_needed and has_cache_for_needed:
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ همینا رو نگه‌دار و بساز", callback_data="wtplreuse|keep")],
            [InlineKeyboardButton("✏️ ویرایششون کنم", callback_data="wtplreuse|edit")],
            [InlineKeyboardButton("🆕 از نو بنویسم", callback_data="wtplreuse|restart")],
        ])
        await update.message.reply_text(
            "به‌نظر می‌رسه برای این هفته قبلاً یه‌بار هدف/Level Up/نوت رو نوشته بودی. چیکار کنم؟",
            reply_markup=keyboard,
        )
        return

    await _advance_weekly_template_flow(update, context, chat_id)


async def handle_weekly_template_reuse_choice(query, chat_id: int, choice: str, context: ContextTypes.DEFAULT_TYPE):
    state = _template_meta_state.get(chat_id)
    if not state:
        await query.edit_message_text("این درخواست منقضی شده؛ دوباره دکمه‌ی «قالب هفتگی» رو بزن.")
        return
    cached = state.get("_cached") or {}
    chat_needed = [f for f in ("goal", "levelup", "note") if state.get(f) is None]

    if choice == "keep":
        for f in chat_needed:
            if cached.get(f):
                state[f] = cached[f]
        await query.edit_message_text("✅ باشه، از همون قبلیا استفاده می‌کنم...")
        await _advance_weekly_template_flow(query, context, chat_id)
    elif choice == "edit":
        state["editing"] = True
        await query.edit_message_text("✏️ باشه، بریم یکی‌یکی مرور کنیم:")
        await _advance_weekly_template_flow(query, context, chat_id)
    else:  # restart
        state["editing"] = False
        state["_cached"] = {}
        await query.edit_message_text("🆕 باشه، از نو می‌پرسم:")
        await _advance_weekly_template_flow(query, context, chat_id)


# ---------------------------------------------------------------------------
# قالب روزانه: اولویت/اهداف (از Notion یا چت) + Level Up (تیک تعاملی)
# ---------------------------------------------------------------------------

DAILY_LEVELUP_KEYS = ["book", "video", "workout"]
DAILY_LEVELUP_LABELS = {"book": "📖 مطالعه‌ی کتاب", "video": "🎬 ویدیوی آموزشی", "workout": "🏋️ ورزش"}


def _daily_levelup_keyboard(done_keys: set) -> InlineKeyboardMarkup:
    rows = []
    for key in DAILY_LEVELUP_KEYS:
        mark = "✅" if key in done_keys else "⬜"
        rows.append([InlineKeyboardButton(f"{mark} {DAILY_LEVELUP_LABELS[key]}", callback_data=f"dtpllu|{key}")])
    rows.append([InlineKeyboardButton("تایید ✔️", callback_data="dtpllu|confirm")])
    return InlineKeyboardMarkup(rows)


async def _finish_daily_template(context: ContextTypes.DEFAULT_TYPE, chat_id: int, state: dict):
    from templates.template_render import render_daily_image

    today = state["date"]
    today_str = today.strftime("%Y-%m-%d")
    date_label = gregorian_to_jalali_str(today_str)
    output_path = os.path.join("/tmp", f"daily_template_{chat_id}_{today.strftime('%Y%m%d')}.png")
    try:
        render_daily_image(
            date_label=date_label,
            weekday_index=_weekday_index_saturday_zero(today),
            table_rows=state["table_rows"],
            priorities=state.get("priorities") or [],
            goals_text=state.get("goals") or "",
            levelup_done=state.get("levelup_done") or [],
            output_path=output_path,
        )
        with open(output_path, "rb") as f:
            await context.bot.send_photo(
                chat_id=chat_id,
                photo=f,
                caption=f"📆 قالب روزانه — {date_label}",
                reply_markup=build_main_menu(chat_id),
            )
        notion_fields = state.get("notion_fields", set())
        cache_data = {f: state.get(f) for f in ("priorities", "goals") if f not in notion_fields}
        cache_data["levelup_done"] = state.get("levelup_done") or []
        local_db.save_template_meta_cache(chat_id, "daily", today_str, cache_data)
    except Exception as e:
        logger.error("خطا در ساخت قالب روزانه: %s", e)
        await context.bot.send_message(chat_id=chat_id, text=f"⚠️ خطا در ساخت قالب روزانه: {e}")
    finally:
        if os.path.exists(output_path):
            os.remove(output_path)
        _template_meta_state.pop(chat_id, None)


async def _advance_daily_template_flow(context: ContextTypes.DEFAULT_TYPE, chat_id: int):
    state = _template_meta_state[chat_id]
    editing = state.get("editing", False)
    cached = state.get("_cached") or {}

    if state.get("priorities") is None:
        state["stage"] = "await_priorities"
        prev = cached.get("priorities") if editing else None
        hint = ("\n\nقبلی:\n" + "\n".join(prev) + "\n\nنگه‌داشتنشون رو بنویس «-»، وگرنه از نو بفرست."
                ) if prev else ""
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"🎯 اولویت‌های امروزت چیان؟ (هر کدوم تو یه خط جدا، حداکثر ۵ تا){hint}",
        )
        return
    if state.get("goals") is None:
        state["stage"] = "await_goals"
        prev = cached.get("goals") if editing else None
        hint = f"\n\nقبلی: «{prev}»\nنگه‌داشتنش رو بنویس «-»، وگرنه متن جدید رو بفرست." if prev else ""
        await context.bot.send_message(chat_id=chat_id, text=f"🏁 اهداف امروزت چیه؟{hint}")
        return
    if state.get("levelup_done") is None:
        state["stage"] = "await_levelup_toggle"
        state["levelup_done"] = []
        await context.bot.send_message(
            chat_id=chat_id,
            text="⭐ کدوم‌ها رو امروز قصد داری انجام بدی؟ (بزن، بعد تایید رو بزن)",
            reply_markup=_daily_levelup_keyboard(set()),
        )
        return
    await _finish_daily_template(context, chat_id, state)


async def handle_daily_meta_text(update: Update, context: ContextTypes.DEFAULT_TYPE, state: dict):
    chat_id = update.effective_chat.id
    text = update.message.text.strip()
    stage = state.get("stage")
    editing = state.get("editing", False)
    cached = state.get("_cached") or {}

    if stage == "await_priorities":
        if text == "-" and editing and cached.get("priorities"):
            state["priorities"] = cached["priorities"]
        else:
            state["priorities"] = [ln.strip() for ln in text.split("\n") if ln.strip()][:5]
    elif stage == "await_goals":
        if text == "-" and editing and cached.get("goals"):
            state["goals"] = cached["goals"]
        else:
            state["goals"] = "" if text == "-" else text

    await _advance_daily_template_flow(context, chat_id)


async def handle_daily_levelup_toggle(query, chat_id: int, key: str, context: ContextTypes.DEFAULT_TYPE):
    state = _template_meta_state.get(chat_id)
    if not state:
        await query.edit_message_text("این درخواست منقضی شده؛ دوباره دکمه‌ی «قالب روزانه» رو بزن.")
        return
    done = set(state.get("levelup_done") or [])
    if key == "confirm":
        state["levelup_done"] = list(done)
        await query.edit_message_reply_markup(reply_markup=None)
        await _advance_daily_template_flow(context, chat_id)
        return
    if key in done:
        done.remove(key)
    else:
        done.add(key)
    state["levelup_done"] = list(done)
    await query.edit_message_reply_markup(reply_markup=_daily_levelup_keyboard(done))


async def send_daily_template(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """دکمه‌ی «قالب روزانه»: جدول از Notion پر می‌شه؛ اولویت/اهداف از Notion یا چت گرفته می‌شن؛
    Level Up با یه چک‌لیست تعاملی مشخص می‌شه (نه اینکه خالی برای دست‌نویسی بمونه)."""
    chat_id = update.effective_chat.id
    if not _is_notion_user(chat_id):
        await update.message.reply_text("این قابلیت فعلاً فقط برای حساب متصل به Notion فعاله.")
        return

    today = datetime.now(tz).date()
    today_str = today.strftime("%Y-%m-%d")
    items = get_today_plan_items(chat_id)
    table_rows = [(item.get("time_label", ""), _item_display_text(item)) for item in items]

    meta = get_daily_meta_from_notion(today_str)
    cached = local_db.get_template_meta_cache(chat_id, "daily", today_str) or {}

    state = {
        "kind": "daily",
        "date": today,
        "table_rows": table_rows,
        "priorities": meta["priorities"],
        "goals": meta["goals"],
        "levelup_done": None,  # همیشه چت/دکمه‌محوره؛ کش‌شده رو به‌عنوان پیش‌فرض می‌ذاریم نه مقدار قطعی
        "notion_fields": {f for f in ("priorities", "goals") if meta[f] is not None},
        "_cached": cached,
    }
    _template_meta_state[chat_id] = state

    chat_needed = [f for f in ("priorities", "goals") if state[f] is None]
    has_cache_for_needed = any(cached.get(f) for f in chat_needed) or cached.get("levelup_done")

    if has_cache_for_needed:
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ همینا رو نگه‌دار و بساز", callback_data="dtplreuse|keep")],
            [InlineKeyboardButton("✏️ ویرایششون کنم", callback_data="dtplreuse|edit")],
            [InlineKeyboardButton("🆕 از نو بنویسم", callback_data="dtplreuse|restart")],
        ])
        await update.message.reply_text(
            "برای امروز قبلاً یه‌بار اولویت/اهداف/Level Up رو ثبت کرده بودی. چیکار کنم؟",
            reply_markup=keyboard,
        )
        return

    await _advance_daily_template_flow(context, chat_id)


async def handle_daily_template_reuse_choice(query, chat_id: int, choice: str, context: ContextTypes.DEFAULT_TYPE):
    state = _template_meta_state.get(chat_id)
    if not state:
        await query.edit_message_text("این درخواست منقضی شده؛ دوباره دکمه‌ی «قالب روزانه» رو بزن.")
        return
    cached = state.get("_cached") or {}
    chat_needed = [f for f in ("priorities", "goals") if state.get(f) is None]

    if choice == "keep":
        for f in chat_needed:
            if cached.get(f):
                state[f] = cached[f]
        state["levelup_done"] = cached.get("levelup_done") or []
        await query.edit_message_text("✅ باشه، از همون قبلیا استفاده می‌کنم...")
        await _advance_daily_template_flow(context, chat_id)
    elif choice == "edit":
        state["editing"] = True
        await query.edit_message_text("✏️ باشه، بریم یکی‌یکی مرور کنیم:")
        await _advance_daily_template_flow(context, chat_id)
    else:  # restart
        state["editing"] = False
        state["_cached"] = {}
        await query.edit_message_text("🆕 باشه، از نو می‌پرسم:")
        await _advance_daily_template_flow(context, chat_id)


async def auto_send_weekly_report(context: ContextTypes.DEFAULT_TYPE):
    """Job زمان‌بندی‌شده: جمعه ساعت ۱۶ خودکار اجرا می‌شود، برای همه‌ی کاربران متن آمار و PDF می‌فرستد."""
    all_chat_ids = [int(TELEGRAM_CHAT_ID)] + local_db.get_all_local_chat_ids()
    for cid in all_chat_ids:
        await auto_send_weekly_report_for(context, cid)


# ---------------------------------------------------------------------------
# فرم مرحله‌ای «ثبت برنامه هفته» - فقط برای کاربران بدون Notion (local_db)
# ---------------------------------------------------------------------------

_WEEKDAY_LABELS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"]


def _weekday_dates_for_current_week() -> dict:
    """نگاشت اسم روز -> تاریخ میلادی (YYYY-MM-DD) برای هفته‌ی شمسی جاری (شنبه تا جمعه)."""
    week_start, _ = get_jalali_week_range()
    return {
        label: (week_start + timedelta(days=i)).strftime("%Y-%m-%d")
        for i, label in enumerate(_WEEKDAY_LABELS)
    }


async def start_plan_entry_flow(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """اولین قدم: از کاربر می‌پرسد برای کدوم روز هفته می‌خواهد برنامه وارد کند."""
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton(day, callback_data=f"planday|{day}")] for day in _WEEKDAY_LABELS]
    )
    await update.message.reply_text(
        "برای کدوم روز هفته می‌خوای برنامه وارد کنی؟", reply_markup=keyboard
    )


async def handle_plan_day_choice(query, chat_id: int, day_label: str):
    """کاربر روی یکی از دکمه‌های روز هفته زده - وارد مرحله‌ی تایپ اسم پارت می‌شویم."""
    dates = _weekday_dates_for_current_week()
    date_str = dates.get(day_label)

    _plan_entry_state[chat_id] = {
        "stage": "await_part_name",
        "day_label": day_label,
        "date": date_str,
        "added_count": 0,
    }
    await query.edit_message_text(
        f"📅 {day_label}\n\nاسم پارت درسی رو بنویس (مثلاً «ریاضی فصل ۳»):"
    )


async def handle_plan_entry_text(update: Update, context: ContextTypes.DEFAULT_TYPE, state: dict):
    """پیام متنی کاربر را در مرحله‌ی «await_part_name» پردازش می‌کند (اسم پارت)."""
    chat_id = update.effective_chat.id
    text = update.message.text.strip()

    if state["stage"] != "await_part_name":
        return

    local_db.add_plan_item(chat_id, text, state["date"], category="درسی")
    state["added_count"] += 1
    state["stage"] = "await_more_parts"
    _plan_entry_state[chat_id] = state

    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("➕ بله، یکی دیگه", callback_data="planmore|yes")],
            [InlineKeyboardButton("✅ نه، تمومه", callback_data="planmore|no")],
        ]
    )
    await update.message.reply_text(
        f"✅ «{text}» برای {state['day_label']} ثبت شد.\n\nپارت دیگه‌ای هم برای همین روز داری؟",
        reply_markup=keyboard,
    )


async def handle_plan_more_choice(query, chat_id: int, choice: str):
    """پاسخ به «پارت دیگه‌ای هم داری؟» را پردازش می‌کند."""
    state = _plan_entry_state.get(chat_id)
    if not state:
        await query.edit_message_text("جلسه‌ی ثبت برنامه پیدا نشد، از منو دوباره شروع کن.")
        return

    if choice == "yes":
        state["stage"] = "await_part_name"
        _plan_entry_state[chat_id] = state
        await query.edit_message_text(
            f"📅 {state['day_label']}\n\nاسم پارت بعدی رو بنویس:"
        )
        return

    # choice == "no" -> بپرس روز دیگه‌ای هم می‌خواد یا تمومه
    day_label = state["day_label"]
    added_count = state["added_count"]
    _plan_entry_state.pop(chat_id, None)

    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📅 بله، روز دیگه", callback_data="planday_more|yes")],
            [InlineKeyboardButton("🏁 نه، تمومه", callback_data="planday_more|no")],
        ]
    )
    await query.edit_message_text(
        f"عالی، {added_count} پارت برای {day_label} ثبت شد.\n\nبرای روز دیگه‌ای هم برنامه داری؟",
        reply_markup=keyboard,
    )


async def handle_plan_day_more_choice(query, chat_id: int, choice: str):
    """پاسخ به «روز دیگه‌ای هم داری؟» را پردازش می‌کند."""
    if choice == "yes":
        keyboard = InlineKeyboardMarkup(
            [[InlineKeyboardButton(day, callback_data=f"planday|{day}")] for day in _WEEKDAY_LABELS]
        )
        await query.edit_message_text("برای کدوم روز؟", reply_markup=keyboard)
    else:
        await query.edit_message_text(
            "🎉 برنامه‌ات ثبت شد! از منوی پایین صفحه می‌تونی چک‌لیست و بقیه‌ی امکانات رو ببینی."
        )

async def start_study_report_flow(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """وقتی کاربر «گزارش کار درسی» را از منو می‌زند: اول می‌پرسد امروز یا روز دیگر."""
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📅 امروز", callback_data="rptday|today")],
            [InlineKeyboardButton("🗓 روز دیگه (ویرایش گزارش قبلی)", callback_data="rptday|other")],
        ]
    )
    await update.message.reply_text("گزارش کار کدوم روز رو می‌خوای ببینی یا ثبت کنی؟", reply_markup=keyboard)


async def show_today_study_report_flow(update_or_query, context, chat_id: int, is_callback: bool = False):
    """لیست پارت‌های درسی امروز که هنوز ثبت نشده‌اند را با دکمه نشان می‌دهد (منطق قدیمی send)."""
    try:
        items = get_today_plan_items(chat_id)
    except Exception as e:
        await context.bot.send_message(chat_id=chat_id, text=f"خطا در خواندن برنامه: {e}")
        return

    lesson_items = [p for p in items if _get_select_prop(p, "Category") == "درسی"]
    pending = [p for p in lesson_items if not _get_checkbox_prop(p, "Status")]

    if not pending:
        text = await build_study_report_text(chat_id)
        await context.bot.send_message(
            chat_id=chat_id,
            text="🎉 همه پارت‌های درسی امروز ثبت شده‌اند\n\nفرم فعلی:\n\n" + text,
            reply_markup=build_main_menu(chat_id),
        )
        return

    # اول خلاصه‌ی وضعیت فعلی (چیزی که تا الان ثبت شده) را بفرست
    summary_text = await build_study_report_text(chat_id)
    await context.bot.send_message(chat_id=chat_id, text="📋 وضعیت فعلی گزارش کار امروز:\n\n" + summary_text)

    # بعد لیست پارت‌های باقی‌مانده را با دکمه نشان بده
    await context.bot.send_message(
        chat_id=chat_id,
        text=f"باقی‌مونده: {len(pending)} پارت. روی دکمه‌ی زیر همون پارت بزن تا وضعیتش رو ثبت کنیم:",
    )

    for page in pending:
        page_id = page["id"]
        title = _get_text_prop(page, "Name", "بدون‌نام")
        keyboard = InlineKeyboardMarkup(
            [[InlineKeyboardButton("✍️ ثبت همین پارت", callback_data=f"study|{page_id}")]]
        )
        await context.bot.send_message(chat_id=chat_id, text=f"🔹 {title}", reply_markup=keyboard)


# ---------------------------------------------------------------------------
# گزارش کار و ویرایش روزهای گذشته
# ---------------------------------------------------------------------------

async def ask_other_day_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """از کاربر می‌خواهد تاریخ شمسی روز موردنظر را تایپ کند."""
    chat_id = update.effective_chat.id
    _other_day_report_state.add(chat_id)
    await update.message.reply_text(
        "تاریخ اون روز رو به فرمت شمسی بنویس (مثلاً ۱۴۰۵/۰۵/۲۰ یا 1405/05/20):"
    )


async def handle_other_day_date_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """پیام متنی تاریخ را پردازش کرده و لیست پارت‌های آن روز را نشان می‌دهد."""
    chat_id = update.effective_chat.id
    _other_day_report_state.discard(chat_id)

    try:
        date_str = jalali_str_to_gregorian(update.message.text)
    except Exception:
        await update.message.reply_text(
            "این تاریخ رو نفهمیدم. لطفاً به فرمت ۱۴۰۵/۰۵/۲۰ بنویس و از منو دوباره امتحان کن.",
            reply_markup=build_main_menu(chat_id),
        )
        return

    await show_day_report_with_edit_options(update, context, chat_id, date_str)


async def show_day_report_with_edit_options(update_or_context_bot, context, chat_id: int, date_str: str):
    """پارت‌های یک روز مشخص را نشان می‌دهد: اول گزارش رسمی، بعد لیست شماره‌دار برای ویرایش."""
    try:
        items = get_plan_items_between(chat_id, date_str, date_str)
    except Exception as e:
        await context.bot.send_message(chat_id=chat_id, text=f"خطا در خواندن برنامه: {e}")
        return

    jalali_date = gregorian_to_jalali_str(date_str)

    if not items:
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"برای {jalali_date} هیچ پارتی ثبت نشده.",
            reply_markup=build_main_menu(chat_id),
        )
        return

    # اول گزارش رسمی همون روز (به همون فرمتی که برای امروز داریم) رو بفرست
    report_text = await build_study_report_text_for_date(chat_id, date_str)
    await context.bot.send_message(chat_id=chat_id, text="📋 گزارش کار همین روز:\n\n" + report_text)

    # بعد لیست شماره‌دار برای ویرایش
    await send_day_edit_list(context, chat_id, date_str)


async def send_day_edit_list(context: ContextTypes.DEFAULT_TYPE, chat_id: int, date_str: str):
    """لیست شماره‌دار پارت‌های یک روز را (برای ویرایش) دوباره می‌سازد و می‌فرستد."""
    items = get_plan_items_between(chat_id, date_str, date_str)
    jalali_date = gregorian_to_jalali_str(date_str)

    if not items:
        await context.bot.send_message(chat_id=chat_id, text=f"دیگه پارتی برای {jalali_date} نمونده.")
        return

    text, keyboard = _build_day_edit_text_and_keyboard(items, jalali_date, date_str)
    await context.bot.send_message(chat_id=chat_id, text=text, reply_markup=keyboard)


def _build_day_edit_text_and_keyboard(items: list, jalali_date: str, date_str: str) -> tuple:
    """متن لیست شماره‌دار + کیبورد دکمه‌های شماره‌دار برای صفحه‌ی ویرایش یک روز می‌سازد."""
    lines = [f"📋 لیست ویرایش {jalali_date} — {len(items)} پارت\n"]
    buttons_row = []

    for i, page in enumerate(items):
        title = _get_text_prop(page, "Name", "بدون‌نام")
        done = _get_checkbox_prop(page, "Status")
        minutes = _get_number_prop(page, "StudyMinutes", 0)
        tests = _get_number_prop(page, "TestCount", 0)
        emoji = "✅" if done else "⏳"
        extra = f" ({minutes}د، {tests}ت)" if (minutes or tests) else ""
        lines.append(f"{_number_label(i)} {emoji} {title}{extra}")

        page_id = page["id"]
        buttons_row.append(InlineKeyboardButton(_number_label(i), callback_data=f"editsel|{page_id}"))

    lines.append("\n👇 برای ویرایش یا حذف، شماره‌ی پارت رو بزن")
    text = "\n".join(lines)

    keyboard_rows = [buttons_row[i:i + 5] for i in range(0, len(buttons_row), 5)]
    # یک دکمه‌ی جدا برای بازفرستادن گزارش رسمی به‌روزشده
    keyboard_rows.append([InlineKeyboardButton("🔄 گزارش به‌روز رو بفرست", callback_data=f"refreshrpt|{date_str}")])
    keyboard = InlineKeyboardMarkup(keyboard_rows)
    return text, keyboard


async def show_edit_options_for_item(query, chat_id: int, page_id: str):
    """گزینه‌های ویرایش یک پارت مشخص را نشان می‌دهد: تیک بزن/بردار، دقیقه، تست، حذف."""
    item = get_item_by_id(chat_id, page_id)
    title = _get_text_prop(item, "Name", "بدون‌نام")
    done = _get_checkbox_prop(item, "Status")
    minutes = _get_number_prop(item, "StudyMinutes", 0)
    tests = _get_number_prop(item, "TestCount", 0)

    toggle_label = "❌ تیک رو بردار" if done else "✅ تیک بزن"
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton(toggle_label, callback_data=f"toggle|{page_id}")],
            [InlineKeyboardButton("⏱ تغییر دقیقه", callback_data=f"editmin|{page_id}")],
            [InlineKeyboardButton("📝 تغییر تست", callback_data=f"edittest|{page_id}")],
            [InlineKeyboardButton("🗑 حذف این پارت", callback_data=f"delp|{page_id}")],
        ]
    )
    status_text = "✅ انجام‌شده" if done else "⏳ انجام‌نشده"
    await query.edit_message_text(
        f"✏️ ویرایش: {title}\n\nوضعیت فعلی: {status_text} | دقیقه: {minutes} | تست: {tests}\n\nچی رو می‌خوای تغییر بدی؟",
        reply_markup=keyboard,
    )


async def confirm_delete_item(query, chat_id: int, page_id: str):
    item = get_item_by_id(chat_id, page_id)
    title = _get_text_prop(item, "Name", "بدون‌نام")
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("✅ بله، حذف کن", callback_data=f"delpconfirm|{page_id}")],
            [InlineKeyboardButton("↩️ نه، بیخیال", callback_data=f"delpcancel|{page_id}")],
        ]
    )
    await query.edit_message_text(f"🗑 مطمئنی می‌خوای «{title}» رو کامل حذف کنی؟", reply_markup=keyboard)


WELCOME_TEXT_NOTION = (
    "سلام محمدامین جان 👋\n\n"
    "من همراه روزانه‌ی کنکورتم — هر روز صبح برنامه‌ات رو از Notion میارم، "
    "طول روز حواسم بهت هست، و شب هم گزارش کارت رو آماده می‌کنم که برای مشاورت بفرستی.\n\n"
    "از منوی پایین صفحه هر کاری داری رو انتخاب کن، دیگه نیازی به تایپ دستور نیست. بزن بریم 💪"
)

WELCOME_TEXT_LOCAL = (
    "سلام {name} جان 👋\n\n"
    "من همراه روزانه‌ی کنکورتم — هر روز صبح برنامه‌ات رو یادآوری می‌کنم، "
    "طول روز حواسم بهت هست، و شب هم گزارش کارت رو آماده می‌کنم.\n\n"
    "اول از «📝 ثبت برنامه هفته» شروع کن تا برنامه‌ات رو وارد کنی. بعدش از منوی پایین صفحه "
    "هر کاری داری رو انتخاب کن. بزن بریم 💪"
)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id

    if _is_notion_user(chat_id):
        await update.message.reply_text(
            WELCOME_TEXT_NOTION + f"\n\n(آیدی چت تو: {chat_id})",
            reply_markup=build_main_menu(chat_id),
        )
        return

    if local_db.is_registered(chat_id):
        name = local_db.get_user_name(chat_id)
        await update.message.reply_text(
            WELCOME_TEXT_LOCAL.format(name=name),
            reply_markup=build_main_menu(chat_id),
        )
        return

    # کاربر جدید و ناشناخته - باید کد دعوت بدهد
    if not INVITE_CODE:
        await update.message.reply_text(
            "⚠️ فعلاً ثبت‌نام کاربر جدید باز نیست (کد دعوت تنظیم نشده)."
        )
        return

    _pending_invite.add(chat_id)
    await update.message.reply_text(
        "سلام 👋 برای استفاده از این بات، لطفاً کد دعوتی که از محمدامین گرفتی رو بفرست."
    )


async def today_plan(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    try:
        items = get_today_plan_items(chat_id)
    except Exception as e:
        await update.message.reply_text(f"خطا در خواندن برنامه: {e}")
        return

    if not items:
        await update.message.reply_text(
            "برای امروز هیچ برنامه‌ای ثبت نشده.", reply_markup=build_main_menu(chat_id)
        )
        return

    lines = [f"📅 برنامه امروز ({today_jalali_str()}):\n"]
    for page in items:
        title = _get_text_prop(page, "Name", "بدون‌نام")
        category = _get_select_prop(page, "Category", "")
        done = _get_checkbox_prop(page, "Status")
        emoji = "✅" if done else "⏳"
        cat_text = f" ({category})" if category else ""
        lines.append(f"{emoji} {title}{cat_text}")

    await update.message.reply_text("\n".join(lines), reply_markup=build_main_menu(chat_id))


async def manual_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await send_daily_report(context)


async def manual_checklist(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await send_today_checklist(context)


async def handle_edit_item_text(update: Update, context: ContextTypes.DEFAULT_TYPE, state: dict):
    """عدد جدید دقیقه یا تست را که کاربر تایپ کرده ثبت می‌کند."""
    chat_id = update.effective_chat.id
    text = update.message.text.strip()

    if not text.isdigit():
        await update.message.reply_text("لطفاً فقط یک عدد بفرست.")
        return

    value = int(text)
    item_id = state["item_id"]

    try:
        if state["stage"] == "await_new_minutes":
            update_item_full(chat_id, item_id, minutes=value)
            await update.message.reply_text(f"✅ دقیقه به {value} تغییر کرد.")
        else:
            update_item_full(chat_id, item_id, tests=value)
            await update.message.reply_text(f"✅ تعداد تست به {value} تغییر کرد.")

        # دوباره منوی ویرایش همین پارت را نشان بده تا بشود پشت‌سرهم چندتا چیز را عوض کرد
        await send_edit_options_message(context, chat_id, item_id)
    except Exception as e:
        await update.message.reply_text(f"خطا در ثبت: {e}")

    _edit_item_state.pop(chat_id, None)


async def send_edit_options_message(context: ContextTypes.DEFAULT_TYPE, chat_id: int, page_id: str):
    """نسخه‌ی send_message از منوی ویرایش (برای جایی که query نداریم، فقط context)."""
    item = get_item_by_id(chat_id, page_id)
    title = _get_text_prop(item, "Name", "بدون‌نام")
    done = _get_checkbox_prop(item, "Status")
    minutes = _get_number_prop(item, "StudyMinutes", 0)
    tests = _get_number_prop(item, "TestCount", 0)

    toggle_label = "❌ تیک رو بردار" if done else "✅ تیک بزن"
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton(toggle_label, callback_data=f"toggle|{page_id}")],
            [InlineKeyboardButton("⏱ تغییر دقیقه", callback_data=f"editmin|{page_id}")],
            [InlineKeyboardButton("📝 تغییر تست", callback_data=f"edittest|{page_id}")],
            [InlineKeyboardButton("🗑 حذف این پارت", callback_data=f"delp|{page_id}")],
        ]
    )
    status_text = "✅ انجام‌شده" if done else "⏳ انجام‌نشده"
    await context.bot.send_message(
        chat_id=chat_id,
        text=f"✏️ ویرایش: {title}\n\nوضعیت فعلی: {status_text} | دقیقه: {minutes} | تست: {tests}\n\nچی رو می‌خوای تغییر بدی؟",
        reply_markup=keyboard,
    )


async def menu_text_router(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """وقتی کاربر روی یکی از دکمه‌های منوی ثابت می‌زند، متن پیام همان اسم دکمه است."""
    text = update.message.text
    chat_id = update.effective_chat.id

    # ۱. اگر منتظر کد دعوت هستیم
    if chat_id in _pending_invite:
        if text.strip() == INVITE_CODE and INVITE_CODE:
            name = update.effective_user.first_name or "دانش‌آموز"
            local_db.register_user(chat_id, name)
            _pending_invite.discard(chat_id)
            await update.message.reply_text(
                WELCOME_TEXT_LOCAL.format(name=name),
                reply_markup=build_main_menu(chat_id),
            )
        else:
            await update.message.reply_text("کد دعوت درست نیست. دوباره امتحان کن یا از محمدامین بپرس.")
        return

    # ۲. اگر منتظر جواب دقیقه/تست برای گزارش کار درسی هستیم
    state = _study_report_state.get(chat_id)
    if state:
        await handle_study_report_answer(update, context, state)
        return

    # ۳. اگر در میانه‌ی فرم «ثبت برنامه هفته» هستیم
    plan_state = _plan_entry_state.get(chat_id)
    if plan_state:
        await handle_plan_entry_text(update, context, plan_state)
        return

    # ۳.۵ اگر منتظر تایپ تاریخ روز دیگر هستیم (گزارش/ویرایش روزهای قبل)
    if chat_id in _other_day_report_state:
        await handle_other_day_date_text(update, context)
        return

    # ۳.۷۵ اگر در میانه‌ی ویرایش دقیقه/تست یک پارت هستیم
    edit_state = _edit_item_state.get(chat_id)
    if edit_state:
        await handle_edit_item_text(update, context, edit_state)
        return

    # ۳.۹ اگر در میانه‌ی تکمیل هدف/لول‌آپ/نوت برای قالب هفتگی هستیم
    template_state = _template_meta_state.get(chat_id)
    if template_state:
        await handle_template_meta_text(update, context, template_state)
        return

    # ۴. دکمه‌های منوی اصلی
    if text == BTN_CHECKLIST:
        await manual_checklist(update, context)
    elif text == BTN_TODAY:
        await today_plan(update, context)
    elif text == BTN_STUDY_REPORT:
        await start_study_report_flow(update, context)
    elif text == BTN_DAILY_REPORT:
        await manual_report(update, context)
    elif text == BTN_WEEKLY_STATS:
        await send_weekly_stats(update, context)
    elif text == BTN_ADD_PLAN:
        await start_plan_entry_flow(update, context)
    elif text == BTN_WEEKLY_TEMPLATE:
        await send_weekly_template(update, context)
    elif text == BTN_DAILY_TEMPLATE:
        await send_daily_template(update, context)
    else:
        await update.message.reply_text(
            "از دکمه‌های پایین صفحه استفاده کن 👇", reply_markup=build_main_menu(chat_id)
        )


async def handle_study_report_answer(update: Update, context: ContextTypes.DEFAULT_TYPE, state: dict):
    """جواب کاربر به سوال دقیقه یا تعداد تست را پردازش می‌کند."""
    chat_id = update.effective_chat.id
    text = update.message.text.strip()

    if not text.isdigit():
        await update.message.reply_text("لطفاً فقط یک عدد بفرست (مثلاً 45).")
        return

    value = int(text)

    if state["stage"] == "await_minutes":
        state["minutes"] = value
        state["stage"] = "await_tests"
        _study_report_state[chat_id] = state
        await update.message.reply_text("چند تا تست زدی؟ (اگه تست نداشت، 0 بفرست)")
        return

    if state["stage"] == "await_tests":
        minutes = state["minutes"]
        tests = value
        page_id = state["page_id"]
        title = state["title"]
        source = state.get("source", "rpt")
        lesson_status = state.get("lesson_status", "c")  # پیش‌فرض برای سازگاری با حالت قدیمی

        try:
            if lesson_status == "c":
                save_study_data(chat_id, page_id, minutes, tests, mark_done=True)
                await update.message.reply_text(
                    f"✅ ثبت شد: «{title}» → {minutes} دقیقه، {tests} تست 🔥"
                )
            else:
                # ناقص: دقیقه/تست همین امروز ثبت می‌شه ولی تیک نمی‌خوره
                save_study_data(chat_id, page_id, minutes, tests, mark_done=False)
                # یه پارت جبرانی برای فردا ساخته می‌شه
                item = get_item_by_id(chat_id, page_id)
                tomorrow = (datetime.now(tz).date() + timedelta(days=1)).strftime("%Y-%m-%d")
                create_makeup_item(chat_id, item, tomorrow)
                await update.message.reply_text(
                    f"🟡 ثبت شد: «{title}» → {minutes} دقیقه، {tests} تست (ناقص)\n"
                    f"📌 یه پارت جبرانی برای فردا ساختم تا بقیه‌ش رو ادامه بدی."
                )
        except Exception as e:
            await update.message.reply_text(f"خطا در ثبت: {e}")

        _study_report_state.pop(chat_id, None)

        # اگر از مسیر «گزارش کار درسی» اومده بود، دوباره لیست پارت‌های باقی‌مانده را نشان بده
        if source == "rpt":
            await start_study_report_flow(update, context)
        # اگر از چک‌لیست اومده بود، لیست به‌روزشده را دوباره بفرست
        elif source == "chk":
            items = get_today_plan_items(chat_id)
            await send_checklist_message(context, chat_id, items)
        # اگر از منوی ویرایش (تیک زدن دستی) اومده بود، دوباره منوی ویرایش همین پارت رو بفرست
        elif source == "edit":
            await send_edit_options_message(context, chat_id, page_id)


async def ask_lesson_status(query, page_id: str, title: str, source: str):
    """سه گزینه‌ی وضعیت (کامل/ناقص/انجام‌ندادم) را برای یک پارت درسی نشان می‌دهد."""
    # source را داخل callback_data کدگذاری می‌کنیم تا بعداً بدانیم از کجا آمده
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("✅ کامل انجام دادم", callback_data=f"status|c|{source}|{page_id}")],
            [InlineKeyboardButton("🟡 ناقص انجام دادم", callback_data=f"status|p|{source}|{page_id}")],
            [InlineKeyboardButton("⭕ انجام ندادم", callback_data=f"status|s|{source}|{page_id}")],
        ]
    )
    await query.edit_message_text(f"🔹 {title}\n\nاین پارت رو چطور انجام دادی؟", reply_markup=keyboard)


async def handle_lesson_status_choice(query, chat_id: int, raw_value: str):
    """پاسخ کاربر به سه‌گزینه‌ای کامل/ناقص/انجام‌ندادم را پردازش می‌کند."""
    status_choice, _, rest = raw_value.partition("|")
    source, _, page_id = rest.partition("|")

    if status_choice == "s":
        # انجام‌ندادم: پارت به‌طور خودکار برای فردا منتقل می‌شود (بدون تیک، بدون دقیقه/تست)
        try:
            item = get_item_by_id(chat_id, page_id)
            tomorrow = (datetime.now(tz).date() + timedelta(days=1)).strftime("%Y-%m-%d")
            create_makeup_item(chat_id, item, tomorrow)

            if source == "chk":
                items = get_today_plan_items(chat_id)
                text, keyboard = await build_checklist_text_and_keyboard(items)
                await query.edit_message_text(text, reply_markup=keyboard)
            elif source == "edit":
                await show_edit_options_for_item(query, chat_id, page_id)
            else:
                title = query.message.text.split("\n\n")[0].replace("🔹 ", "").strip()
                await query.edit_message_text(
                    f"🔹 {title}\n\n⭕ باشه، این یکی رو برای فردا منتقل کردم. نیازی نیست خودت چیزی تغییر بدی."
                )
        except Exception as e:
            await query.edit_message_text(f"خطا در انتقال به فردا: {e}")
        return

    # کامل یا ناقص - هر دو نیاز به دقیقه/تست دارند
    title = query.message.text.split("\n\n")[0].replace("🔹 ", "").strip()
    _study_report_state[chat_id] = {
        "stage": "await_minutes",
        "page_id": page_id,
        "title": title,
        "source": source,
        "lesson_status": status_choice,  # "c" یا "p"
    }
    await query.edit_message_text(f"🔹 {title}\n\n⏱ چند دقیقه براش وقت گذاشتی؟")


async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    chat_id = query.message.chat_id

    data = query.data
    action, _, value = data.partition("|")

    if action == "chk":
        page_id = value
        try:
            item = get_item_by_id(chat_id, page_id)
            category = _get_select_prop(item, "Category", "")
            title = _get_text_prop(item, "Name", "بدون‌نام")

            if category == "درسی":
                # پارت درسیه - باید وضعیتش (کامل/ناقص/انجام‌ندادم) مشخص بشه
                await ask_lesson_status(query, page_id, title, source="chk")
            else:
                # غیردرسی یا توسعه فردی - همون تیک ساده کافیه، بعد لیست رو رفرش کن
                mark_item_done(chat_id, page_id, done=True)
                items = get_today_plan_items(chat_id)
                text, keyboard = await build_checklist_text_and_keyboard(items)
                await query.edit_message_text(text, reply_markup=keyboard)
        except Exception as e:
            await query.edit_message_text(f"خطا در ثبت: {e}")

    elif action == "checkin":
        percent = value
        await query.edit_message_text(f"ثبت شد: {percent}٪ از برنامه امروز انجام شده. آفرین، ادامه بده 💪")

    elif action == "study":
        page_id = value
        # عنوان پارت را از متن پیام (که با 🔹 شروع شده) استخراج می‌کنیم
        title = query.message.text.replace("🔹 ", "").strip()
        await ask_lesson_status(query, page_id, title, source="rpt")

    elif action == "status":
        # value به‌صورت "complete|source|page_id" یا "partial|source|page_id" یا "skip|source|page_id" است
        await handle_lesson_status_choice(query, chat_id, value)

    elif action == "planday":
        await handle_plan_day_choice(query, chat_id, value)

    elif action == "planmore":
        await handle_plan_more_choice(query, chat_id, value)

    elif action == "planday_more":
        await handle_plan_day_more_choice(query, chat_id, value)

    elif action == "rptday":
        if value == "today":
            await query.edit_message_text("📅 گزارش امروز رو آماده می‌کنم...")
            await show_today_study_report_flow(update, context, chat_id)
        else:
            await query.edit_message_text(
                "تاریخ اون روز رو به فرمت شمسی بنویس (مثلاً ۱۴۰۵/۰۵/۲۰ یا 1405/05/20):"
            )
            _other_day_report_state.add(chat_id)

    elif action == "editsel":
        page_id = value
        await show_edit_options_for_item(query, chat_id, page_id)

    elif action == "refreshrpt":
        date_str = value
        report_text = await build_study_report_text_for_date(chat_id, date_str)
        await query.edit_message_text("🔄 گزارش به‌روزشده:\n\n" + report_text)
        await send_day_edit_list(context, chat_id, date_str)

    elif action == "editp":
        page_id = value
        await show_edit_options_for_item(query, chat_id, page_id)

    elif action == "delp":
        page_id = value
        await confirm_delete_item(query, chat_id, page_id)

    elif action == "delpconfirm":
        page_id = value
        try:
            delete_item(chat_id, page_id)
            await query.edit_message_text("🗑 حذف شد.")
        except Exception as e:
            await query.edit_message_text(f"خطا در حذف: {e}")

    elif action == "delpcancel":
        page_id = value
        await show_edit_options_for_item(query, chat_id, page_id)

    elif action == "weekstat":
        try:
            week_offset = int(value)
        except ValueError:
            week_offset = 0
        await query.edit_message_reply_markup(reply_markup=None)
        await send_weekly_stats_for_offset(query.message, context, chat_id, week_offset)

    elif action == "toggle":
        page_id = value
        try:
            item = get_item_by_id(chat_id, page_id)
            done = _get_checkbox_prop(item, "Status")
            category = _get_select_prop(item, "Category", "")
            title = _get_text_prop(item, "Name", "بدون‌نام")

            if not done and category == "درسی":
                # داره تیک می‌خوره و پارت درسیه -> باید بپرسیم کامل/ناقص/انجام‌ندادم
                await ask_lesson_status(query, page_id, title, source="edit")
            else:
                # یا داره تیک برداشته می‌شه (ساده)، یا پارت غیردرسی/توسعه‌فردیه (نیازی به پرسیدن نیست)
                update_item_full(chat_id, page_id, status=not done)
                await show_edit_options_for_item(query, chat_id, page_id)
        except Exception as e:
            await query.edit_message_text(f"خطا: {e}")

    elif action == "editmin":
        page_id = value
        _edit_item_state[chat_id] = {"stage": "await_new_minutes", "item_id": page_id}
        await query.edit_message_text("دقیقه‌ی جدید رو بفرست (فقط عدد):")

    elif action == "edittest":
        page_id = value
        _edit_item_state[chat_id] = {"stage": "await_new_tests", "item_id": page_id}
        await query.edit_message_text("تعداد تست جدید رو بفرست (فقط عدد):")

    elif action == "wtplreuse":
        await handle_weekly_template_reuse_choice(query, chat_id, value, context)

    elif action == "dtplreuse":
        await handle_daily_template_reuse_choice(query, chat_id, value, context)

    elif action == "dtpllu":
        await handle_daily_levelup_toggle(query, chat_id, value, context)


# ---------------------------------------------------------------------------
# راه‌اندازی اصلی
# ---------------------------------------------------------------------------

def main():
    local_db.init_db()

    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("today", today_plan))
    application.add_handler(CommandHandler("checklist", manual_checklist))
    application.add_handler(CommandHandler("report", manual_report))
    application.add_handler(CommandHandler("weekly", send_weekly_stats))
    application.add_handler(CallbackQueryHandler(button_callback))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, menu_text_router))

    job_queue: JobQueue = application.job_queue

    # چک‌لیست صبحگاهی - ساعت ۸:۰۰
    job_queue.run_daily(send_today_checklist, time=dtime(hour=8, minute=0, tzinfo=tz))

    # چک‌این‌های روزانه
    job_queue.run_daily(morning_checkin, time=dtime(hour=10, minute=0, tzinfo=tz))
    job_queue.run_daily(noon_checkin, time=dtime(hour=15, minute=0, tzinfo=tz))
    job_queue.run_daily(night_checkin, time=dtime(hour=21, minute=0, tzinfo=tz))

    # گزارش کلی پایان شب - ساعت ۲۳:۰۰
    job_queue.run_daily(send_daily_report, time=dtime(hour=23, minute=0, tzinfo=tz))

    # گزارش کار درسی خودکار - ساعت ۱:۰۰ بامداد
    job_queue.run_daily(send_study_report, time=dtime(hour=1, minute=0, tzinfo=tz))
    job_queue.run_daily(auto_carry_over_unfinished, time=dtime(hour=1, minute=15, tzinfo=tz))

    # گزارش هفتگی خودکار (متن + PDF) - جمعه ساعت ۱۶:۰۰ (۴ بعدازظهر) به وقت تهران
    # days=(4,) یعنی فقط جمعه (در پایتون: شنبه=5, یکشنبه=6, دوشنبه=0 ... جمعه=4)
    job_queue.run_daily(auto_send_weekly_report, time=dtime(hour=16, minute=0, tzinfo=tz), days=(4,))

    logger.info("ربات روشن شد و در حال اجراست...")
    application.run_polling()


if __name__ == "__main__":
    main()
