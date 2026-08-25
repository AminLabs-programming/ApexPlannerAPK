"""
ماژول دیتابیس محلی (SQLite) برای کاربرانی که Notion ندارند.
هر کاربر با chat_id شناخته می‌شود. ساختار جدول‌ها موازی با فیلدهای Notion طراحی شده
(Name, Date, Category, Status, StudyMinutes, TestCount) تا منطق مشترک با نسخه‌ی Notion کار کند.
"""

import sqlite3
import os
import secrets
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bot.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """جدول‌های لازم را در صورت نبود می‌سازد. در ابتدای اجرای بات یک‌بار صدا زده می‌شود."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            chat_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS plan_items (
            id TEXT PRIMARY KEY,
            chat_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'درسی',
            status INTEGER NOT NULL DEFAULT 0,
            study_minutes INTEGER NOT NULL DEFAULT 0,
            test_count INTEGER NOT NULL DEFAULT 0,
            notes TEXT DEFAULT '',
            FOREIGN KEY (chat_id) REFERENCES users(chat_id)
        )
    """)

    # کش محلیِ متن‌های «هدف/Level Up/نوت» قالب هفتگی و «اولویت/اهداف» قالب روزانه.
    # مستقل از این‌که کاربر Notion داره یا نه: حتی برای کاربر Notion هم این کش نگه
    # داشته می‌شه تا اگه در Notion خالی بود و کاربر تو چت جواب داد، دفعه‌ی بعد بشه
    # بین «ویرایش قبلی» یا «نوشتن از نو» یکی رو انتخاب کرد (به‌جای پرسیدن مجدد از صفر).
    cur.execute("""
        CREATE TABLE IF NOT EXISTS template_meta_cache (
            chat_id INTEGER NOT NULL,
            scope TEXT NOT NULL,       -- 'weekly' یا 'daily'
            period_key TEXT NOT NULL,  -- برای هفتگی: تاریخ شنبه (YYYY-MM-DD)، برای روزانه: تاریخ همون روز
            data_json TEXT NOT NULL,   -- json از فیلدهای اون scope
            updated_at TEXT NOT NULL,
            PRIMARY KEY (chat_id, scope, period_key)
        )
    """)

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# مدیریت کاربران
# ---------------------------------------------------------------------------

def is_registered(chat_id: int) -> bool:
    conn = get_connection()
    row = conn.execute("SELECT 1 FROM users WHERE chat_id = ?", (chat_id,)).fetchone()
    conn.close()
    return row is not None


def register_user(chat_id: int, name: str):
    conn = get_connection()
    conn.execute(
        "INSERT OR IGNORE INTO users (chat_id, name, created_at) VALUES (?, ?, ?)",
        (chat_id, name, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()


def get_all_local_chat_ids() -> list[int]:
    """لیست همه‌ی chat_id های ثبت‌شده در SQLite را برمی‌گرداند (برای لوپ زدن Jobها)."""
    conn = get_connection()
    rows = conn.execute("SELECT chat_id FROM users").fetchall()
    conn.close()
    return [r["chat_id"] for r in rows]


def get_user_name(chat_id: int) -> str:
    conn = get_connection()
    row = conn.execute("SELECT name FROM users WHERE chat_id = ?", (chat_id,)).fetchone()
    conn.close()
    return row["name"] if row else "دانش‌آموز"


# ---------------------------------------------------------------------------
# مدیریت پارت‌های برنامه
# ---------------------------------------------------------------------------

def add_plan_item(chat_id: int, name: str, date: str, category: str = "درسی") -> str:
    """یک پارت جدید اضافه می‌کند و id آن را برمی‌گرداند."""
    item_id = secrets.token_hex(12)
    conn = get_connection()
    conn.execute(
        "INSERT INTO plan_items (id, chat_id, name, date, category) VALUES (?, ?, ?, ?, ?)",
        (item_id, chat_id, name, date, category),
    )
    conn.commit()
    conn.close()
    return item_id


def get_items_for_date(chat_id: int, date: str) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM plan_items WHERE chat_id = ? AND date = ?", (chat_id, date)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_items_between(chat_id: int, start_date: str, end_date: str) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM plan_items WHERE chat_id = ? AND date >= ? AND date <= ?",
        (chat_id, start_date, end_date),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_item_by_id(item_id: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM plan_items WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_item(item_id: str):
    conn = get_connection()
    conn.execute("DELETE FROM plan_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()


def update_item_full(item_id: str, status: bool = None, minutes: int = None, tests: int = None):
    """فیلدهای دلخواه یک پارت را آپدیت می‌کند (برای ویرایش گزارش روزهای قبل)."""
    fields = []
    params = []
    if status is not None:
        fields.append("status = ?")
        params.append(1 if status else 0)
    if minutes is not None:
        fields.append("study_minutes = ?")
        params.append(minutes)
    if tests is not None:
        fields.append("test_count = ?")
        params.append(tests)
    if not fields:
        return
    params.append(item_id)
    conn = get_connection()
    conn.execute(f"UPDATE plan_items SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    conn.close()


def mark_item_done(item_id: str, done: bool = True):
    conn = get_connection()
    conn.execute("UPDATE plan_items SET status = ? WHERE id = ?", (1 if done else 0, item_id))
    conn.commit()
    conn.close()


def save_study_data(item_id: str, minutes: int, tests: int, mark_done: bool = True):
    conn = get_connection()
    if mark_done:
        conn.execute(
            "UPDATE plan_items SET study_minutes = ?, test_count = ?, status = 1 WHERE id = ?",
            (minutes, tests, item_id),
        )
    else:
        conn.execute(
            "UPDATE plan_items SET study_minutes = ?, test_count = ? WHERE id = ?",
            (minutes, tests, item_id),
        )
    conn.commit()
    conn.close()


def create_makeup_item(original_item: dict, tomorrow_date: str) -> str:
    """کپی یک پارت ناقص/انجام‌نشده را برای فردا می‌سازد (مثل نسخه‌ی Notion)."""
    title = original_item["name"]
    new_title = title if "(جبرانی)" in title else f"{title} (جبرانی)"
    return add_plan_item(
        chat_id=original_item["chat_id"],
        name=new_title,
        date=tomorrow_date,
        category=original_item.get("category", "درسی"),
    )


# ---------------------------------------------------------------------------
# کش متن‌های قالب هفتگی/روزانه (هدف/Level Up/نوت/اولویت/اهداف)
# ---------------------------------------------------------------------------
import json


def get_template_meta_cache(chat_id: int, scope: str, period_key: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT data_json FROM template_meta_cache WHERE chat_id = ? AND scope = ? AND period_key = ?",
        (chat_id, scope, period_key),
    ).fetchone()
    conn.close()
    if not row:
        return None
    try:
        return json.loads(row["data_json"])
    except (json.JSONDecodeError, TypeError):
        return None


def save_template_meta_cache(chat_id: int, scope: str, period_key: str, data: dict):
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO template_meta_cache (chat_id, scope, period_key, data_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(chat_id, scope, period_key)
        DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
        """,
        (chat_id, scope, period_key, json.dumps(data, ensure_ascii=False), datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()
