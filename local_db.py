"""
ماژول دیتابیس محلی (SQLite) برای کاربرانی که Notion ندارند.
سیستم احراز هویت: نام کاربری و رمز عبور (بدون کد دعوت).
"""

import sqlite3
import os
import secrets
from datetime import datetime
import hashlib
import json

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bot.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """جدول‌های لازم را می‌سازد."""
    conn = get_connection()
    cur = conn.cursor()

    # جدول کاربران
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            chat_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    # جدول احراز هویت (نام کاربری و رمز عبور)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS credentials (
            chat_id INTEGER PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            FOREIGN KEY (chat_id) REFERENCES users(chat_id)
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

    cur.execute("""
        CREATE TABLE IF NOT EXISTS template_meta_cache (
            chat_id INTEGER NOT NULL,
            scope TEXT NOT NULL,
            period_key TEXT NOT NULL,
            data_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (chat_id, scope, period_key)
        )
    """)

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# مدیریت احراز هویت (ثبت‌نام و ورود)
# ---------------------------------------------------------------------------

def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def register_user_credentials(username: str, password: str) -> tuple[bool, str]:
    """
    ثبت‌نام کاربر جدید با نام کاربری و رمز عبور.
    بازگشت: (موفقیت, پیام)
    """
    conn = get_connection()
    try:
        # بررسی تکراری نبودن نام کاربری
        existing = conn.execute("SELECT chat_id FROM credentials WHERE username = ?", (username,)).fetchone()
        if existing:
            return False, "این نام کاربری قبلاً گرفته شده است."

        chat_id = secrets.randbelow(1000000000) + 100000000 # تولید چت آیدی تصادفی برای وب
        password_hash = _hash_password(password)
        
        now = datetime.utcnow().isoformat()
        
        conn.execute("INSERT INTO users (chat_id, name, created_at) VALUES (?, ?, ?)",
                     (chat_id, username, now))
        conn.execute("INSERT INTO credentials (chat_id, username, password_hash) VALUES (?, ?, ?)",
                     (chat_id, username, password_hash))
        conn.commit()
        return True, str(chat_id) # چت آیدی را برمی‌گردانیم تا در سشن ذخیره شود
    except Exception as e:
        return False, f"خطا در ثبت‌نام: {str(e)}"
    finally:
        conn.close()


def verify_credentials(username: str, password: str) -> tuple[bool, int | None]:
    """
    بررسی نام کاربری و رمز عبور.
    بازگشت: (موفقیت, chat_id)
    """
    conn = get_connection()
    try:
        row = conn.execute("SELECT chat_id, password_hash FROM credentials WHERE username = ?", (username,)).fetchone()
        if not row:
            return False, None
        
        if row["password_hash"] == _hash_password(password):
            return True, row["chat_id"]
        else:
            return False, None
    except Exception:
        return False, None
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# سایر توابع کاربری
# ---------------------------------------------------------------------------

def is_registered_by_chat_id(chat_id: int) -> bool:
    conn = get_connection()
    row = conn.execute("SELECT 1 FROM users WHERE chat_id = ?", (chat_id,)).fetchone()
    conn.close()
    return row is not None


def get_user_name_by_chat_id(chat_id: int) -> str:
    conn = get_connection()
    row = conn.execute("SELECT name FROM users WHERE chat_id = ?", (chat_id,)).fetchone()
    conn.close()
    return row["name"] if row else "کاربر"


def get_all_local_chat_ids() -> list[int]:
    conn = get_connection()
    rows = conn.execute("SELECT chat_id FROM users").fetchall()
    conn.close()
    return [r["chat_id"] for r in rows]


# ---------------------------------------------------------------------------
# مدیریت پارت‌های برنامه (همان توابع قبلی)
# ---------------------------------------------------------------------------

def add_plan_item(chat_id: int, name: str, date: str, category: str = "درسی") -> str:
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
    title = original_item["name"]
    new_title = title if "(جبرانی)" in title else f"{title} (جبرانی)"
    return add_plan_item(
        chat_id=original_item["chat_id"],
        name=new_title,
        date=tomorrow_date,
        category=original_item.get("category", "درسی"),
    )


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


def save_template_meta_cache(chat_id: int, scope: str, period_key: str,  dict):
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
    
