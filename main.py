"""
ربات تلگرام پیگیری برنامه کنکور - متصل به Notion و سرو وب

این فایل اصلی برنامه است که هم بات تلگرام و هم سرور وب Flask را اجرا می‌کند.
"""

import os
import logging
from datetime import datetime, time as dtime, timedelta
import pytz
import jdatetime
import threading
import json

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

# Flask imports
from flask import Flask, send_from_directory, request, jsonify

# ---------------------------------------------------------------------------
# تنظیمات - اینها را از متغیرهای محیطی (Environment Variables) می‌خوانیم
# ---------------------------------------------------------------------------

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "")
NOTION_PLAN_DATABASE_ID = os.environ.get("NOTION_PLAN_DATABASE_ID", "")
NOTION_REPORT_DATABASE_ID = os.environ.get("NOTION_REPORT_DATABASE_ID", "")
NOTION_WEEKLY_META_DATABASE_ID = os.environ.get("NOTION_WEEKLY_META_DATABASE_ID", "")
NOTION_DAILY_META_DATABASE_ID = os.environ.get("NOTION_DAILY_META_DATABASE_ID", "")
TIMEZONE = os.environ.get("TIMEZONE", "Asia/Tehran")
INVITE_CODE = os.environ.get("INVITE_CODE", "")

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

notion = NotionClient(auth=NOTION_TOKEN) if NOTION_TOKEN else None
tz = pytz.timezone(TIMEZONE)

_reminded_today: set[str] = set()
_last_reset_date: str = ""

# متن دکمه‌های منوی ثابت (Reply Keyboard)
BTN_CHECKLIST = "🎯 چک‌لیست امروز"
BTN_TODAY = "🗓 برنامه امروز"
BTN_STUDY_REPORT = "🧾 گزارش کار درسی"
BTN_DAILY_REPORT = "📈 گزارش کلی"
BTN_WEEKLY_STATS = "📊 آمار هفتگی"
BTN_ADD_PLAN = "📝 ثبت برنامه هفته"
BTN_WEEKLY_TEMPLATE = "🗓 قالب هفتگی"
BTN_DAILY_TEMPLATE = "📆 قالب روزانه"


def build_main_menu(chat_id: int) -> ReplyKeyboardMarkup:
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


MAIN_MENU = ReplyKeyboardMarkup(
    [
        [KeyboardButton(BTN_CHECKLIST), KeyboardButton(BTN_TODAY)],
        [KeyboardButton(BTN_STUDY_REPORT), KeyboardButton(BTN_DAILY_REPORT)],
        [KeyboardButton(BTN_WEEKLY_STATS)],
    ],
    resize_keyboard=True,
)

_study_report_state: dict = {}
_plan_entry_state: dict = {}
_template_meta_state: dict = {}
_other_day_report_state: set = set()
_edit_item_state: dict = {}
_pending_invite: set = set()


# ---------------------------------------------------------------------------
# توابع کمکی تاریخ
# ---------------------------------------------------------------------------

def gregorian_to_jalali_str(date_str: str) -> str:
    try:
        y, m, d = map(int, date_str.split("-")[:3])
        j = jdatetime.date.fromgregorian(year=y, month=m, day=d)
        return j.strftime("%Y/%m/%d")
    except Exception:
        return date_str


def jalali_str_to_gregorian(jalali_str: str) -> str:
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
    if reference_date is None:
        reference_date = datetime.now(tz).date()
    j_today = jdatetime.date.fromgregorian(date=reference_date)
    days_since_saturday = j_today.weekday()
    j_start = j_today - jdatetime.timedelta(days=days_since_saturday)
    j_end = j_start + jdatetime.timedelta(days=6)
    return j_start.togregorian(), j_end.togregorian()


def get_weekly_stats_range(reference_date=None):
    if reference_date is None:
        reference_date = datetime.now(tz).date()
    j_today = jdatetime.date.fromgregorian(date=reference_date)
    THURSDAY_INDEX = 5
    days_since_thursday = (j_today.weekday() - THURSDAY_INDEX) % 7
    j_start = j_today - jdatetime.timedelta(days=days_since_thursday)
    j_end = j_start + jdatetime.timedelta(days=7)
    return j_start.togregorian(), j_end.togregorian()


def today_jalali_str() -> str:
    return gregorian_to_jalali_str(today_gregorian_str())


def format_minutes(total_minutes: int) -> str:
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
    return str(chat_id) == str(TELEGRAM_CHAT_ID)


def _get_text_prop(page, prop_name, default=""):
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


def _notion_page_to_dict(page) -> dict:
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
        "time_label": _get_text_prop(page, "Time", ""),
        "_raw_notion_page": page,
    }


def get_today_plan_items(chat_id: int):
    today = today_gregorian_str()
    if _is_notion_user(chat_id) and notion:
        try:
            response = notion.databases.query(
                database_id=NOTION_PLAN_DATABASE_ID,
                filter={"property": "Date", "date": {"equals": today}},
            )
            return [_notion_page_to_dict(p) for p in response.get("results", [])]
        except Exception as e:
            logger.error("خطا در خواندن از Notion: %s", e)
            return []
    else:
        return local_db.get_items_for_date(chat_id, today)


def get_plan_items_between(chat_id: int, start_date: str, end_date: str):
    if _is_notion_user(chat_id) and notion:
        try:
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
        except Exception as e:
            logger.error("خطا در خواندن از Notion: %s", e)
            return []
    else:
        return local_db.get_items_between(chat_id, start_date, end_date)


def mark_item_done(chat_id: int, item_id: str, done: bool = True):
    if _is_notion_user(chat_id) and notion:
        notion.pages.update(page_id=item_id, properties={"Status": {"checkbox": done}})
    else:
        local_db.mark_item_done(item_id, done)


def save_study_data(chat_id: int, item_id: str, minutes: int, tests: int, mark_done: bool = True):
    if _is_notion_user(chat_id) and notion:
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
    if _is_notion_user(chat_id) and notion:
        page = notion.pages.retrieve(page_id=item_id)
        return _notion_page_to_dict(page)
    else:
        return local_db.get_item_by_id(item_id)


def delete_item(chat_id: int, item_id: str):
    if _is_notion_user(chat_id) and notion:
        notion.pages.update(page_id=item_id, archived=True)
    else:
        local_db.delete_item(item_id)


def update_item_full(chat_id: int, item_id: str, status: bool = None, minutes: int = None, tests: int = None):
    if _is_notion_user(chat_id) and notion:
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
    if _is_notion_user(chat_id) and notion:
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


# ---------------------------------------------------------------------------
# توابع کمکی کیبورد و متن
# ---------------------------------------------------------------------------

_NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]


def _number_label(i: int) -> str:
    return _NUMBER_EMOJIS[i] if i < len(_NUMBER_EMOJIS) else str(i + 1)


async def build_checklist_text_and_keyboard(items: list) -> tuple:
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

    keyboard_rows = [buttons_row[i:i + 5] for i in range(0, len(buttons_row), 5)]
    keyboard = InlineKeyboardMarkup(keyboard_rows)
    return text, keyboard


async def send_checklist_message(context: ContextTypes.DEFAULT_TYPE, chat_id: int, items: list):
    text, keyboard = await build_checklist_text_and_keyboard(items)
    await context.bot.send_message(
        chat_id=chat_id, text=text, reply_markup=keyboard or build_main_menu(chat_id)
    )


async def send_today_checklist_for(context: ContextTypes.DEFAULT_TYPE, chat_id: int):
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


async def send_today_checklist(context: ContextTypes.DEFAULT_TYPE):
    _reset_daily_state_if_needed()
    all_chat_ids = [int(TELEGRAM_CHAT_ID)] if TELEGRAM_CHAT_ID else []
    all_chat_ids += local_db.get_all_local_chat_ids()
    for cid in all_chat_ids:
        await send_today_checklist_for(context, cid)


# ---------------------------------------------------------------------------
# هندلرهای تلگرام
# ---------------------------------------------------------------------------

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

    if not INVITE_CODE:
        await update.message.reply_text(
            "⚠️ فعلاً ثبت‌نام کاربر جدید باز نیست (کد دعوت تنظیم نشده)."
        )
        return

    _pending_invite.add(chat_id)
    await update.message.reply_text(
        "سلام 👋 برای استفاده از این بات، لطفاً کد دعوتی که از محمدامین گرفتی رو بفرست."
    )


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
                _study_report_state[chat_id] = {
                    "stage": "await_minutes",
                    "page_id": page_id,
                    "title": title,
                    "source": "chk",
                    "lesson_status": "c",
                }
                await query.edit_message_text(f"🔹 {title}\n\n⏱ چند دقیقه براش وقت گذاشتی؟")
            else:
                mark_item_done(chat_id, page_id, done=True)
                items = get_today_plan_items(chat_id)
                text, keyboard = await build_checklist_text_and_keyboard(items)
                await query.edit_message_text(text, reply_markup=keyboard)
        except Exception as e:
            await query.edit_message_text(f"خطا در ثبت: {e}")

    elif action == "checkin":
        percent = value
        await query.edit_message_text(f"ثبت شد: {percent}٪ از برنامه امروز انجام شده. آفرین، ادامه بده 💪")


async def menu_text_router(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    chat_id = update.effective_chat.id

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

    state = _study_report_state.get(chat_id)
    if state:
        if text.isdigit():
            value = int(text)
            if state["stage"] == "await_minutes":
                state["minutes"] = value
                state["stage"] = "await_tests"
                _study_report_state[chat_id] = state
                await update.message.reply_text("چند تا تست زدی؟ (اگه تست نداشت، 0 بفرست)")
                return
            elif state["stage"] == "await_tests":
                minutes = state["minutes"]
                tests = value
                page_id = state["page_id"]
                title = state["title"]
                save_study_data(chat_id, page_id, minutes, tests, mark_done=True)
                await update.message.reply_text(
                    f"✅ ثبت شد: «{title}» → {minutes} دقیقه، {tests} تست 🔥"
                )
                _study_report_state.pop(chat_id, None)
                items = get_today_plan_items(chat_id)
                await send_checklist_message(context, chat_id, items)
                return
        else:
            await update.message.reply_text("لطفاً فقط یک عدد بفرست (مثلاً 45).")
            return

    if text == BTN_CHECKLIST:
        items = get_today_plan_items(chat_id)
        if not items:
            await update.message.reply_text("برای امروز هیچ برنامه‌ای ثبت نشده.", reply_markup=build_main_menu(chat_id))
        else:
            await send_checklist_message(context, chat_id, items)
    elif text == BTN_TODAY:
        items = get_today_plan_items(chat_id)
        if not items:
            await update.message.reply_text("برای امروز هیچ برنامه‌ای ثبت نشده.", reply_markup=build_main_menu(chat_id))
        else:
            lines = [f"📅 برنامه امروز ({today_jalali_str()}):\n"]
            for page in items:
                title = _get_text_prop(page, "Name", "بدون‌نام")
                category = _get_select_prop(page, "Category", "")
                done = _get_checkbox_prop(page, "Status")
                emoji = "✅" if done else "⏳"
                cat_text = f" ({category})" if category else ""
                lines.append(f"{emoji} {title}{cat_text}")
            await update.message.reply_text("\n".join(lines), reply_markup=build_main_menu(chat_id))
    elif text == BTN_ADD_PLAN:
        await update.message.reply_text(
            "برای ثبت برنامه، روز مورد نظر را انتخاب کنید:",
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton(day, callback_data=f"planday|{day}")] for day in ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"]]
            )
        )
    else:
        await update.message.reply_text(
            "از دکمه‌های پایین صفحه استفاده کن 👇", reply_markup=build_main_menu(chat_id)
        )


# ---------------------------------------------------------------------------
# راه‌اندازی بات
# ---------------------------------------------------------------------------

def run_bot():
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("TOKEN بات تلگرام یافت نشد. بات اجرا نمی‌شود.")
        return

    local_db.init_db()
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CallbackQueryHandler(button_callback))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, menu_text_router))

    job_queue: JobQueue = application.job_queue
    job_queue.run_daily(send_today_checklist, time=dtime(hour=8, minute=0, tzinfo=tz))

    logger.info("ربات تلگرام روشن شد و در حال اجراست...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


# ---------------------------------------------------------------------------
# سرور وب Flask
# ---------------------------------------------------------------------------

app = Flask(__name__, static_folder=".", static_url_path="")


@app.route("/")
def serve_index():
    return send_from_directory(".", "index.html")


@app.route("/<path:path>")
def serve_static(path):
    if path.startswith("bot/") or path.endswith(".py") or path.endswith(".db"):
        return "Access denied", 403
    return send_from_directory(".", path)


@app.route("/api/data", methods=["GET"])
def get_data():
    # API ساده برای دریافت داده‌ها از سمت کلاینت
    chat_id = request.args.get("chat_id", "")
    if not chat_id:
        return jsonify({"error": "chat_id required"}), 400
    
    try:
        items = get_today_plan_items(int(chat_id))
        return jsonify({"items": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/register", methods=["POST"])
def register_user():
    """ثبت‌نام کاربر جدید در دیتابیس محلی"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    chat_id = data.get("chat_id")
    invite_code = data.get("invite_code")
    name = data.get("name", "کاربر")
    
    if not chat_id or not invite_code:
        return jsonify({"error": "chat_id and invite_code are required"}), 400
    
    # بررسی کد دعوت
    if invite_code != INVITE_CODE:
        return jsonify({"error": "Invalid invite code"}), 403
    
    # بررسی تکراری نبودن کاربر
    if local_db.is_registered(int(chat_id)):
        return jsonify({"error": "User already registered"}), 409
    
    # ثبت کاربر
    try:
        local_db.register_user(int(chat_id), name)
        return jsonify({"success": True, "message": "Registration successful"}), 200
    except Exception as e:
        logger.error("Error registering user: %s", e)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # اجرای بات در ترد جداگانه
    bot_thread = threading.Thread(target=run_bot, daemon=True)
    bot_thread.start()

    # اجرای سرور وب
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"سرور وب در حال اجرا روی پورت {port}...")
    app.run(host="0.0.0.0", port=port)
