import { useState } from "react";
import Faravahar from "../components/Faravahar";
import BottomSheet from "../components/BottomSheet";
import type { SurfaceStyle, ColorMode, Screen } from "../lib/utils";
import { toPersian } from "../lib/utils";
import { useAppData } from "../lib/AppDataContext";
import { Api, ApiError } from "../lib/api";
import { Store } from "../lib/store";

interface ProfileProps {
  glass?: boolean;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  surfaceStyle: SurfaceStyle;
  setSurfaceStyle: (v: SurfaceStyle) => void;
  colorMode: ColorMode;
  setColorMode: (v: ColorMode) => void;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
}

export default function Profile({
  glass = false,
  darkMode,
  setDarkMode,
  surfaceStyle,
  setSurfaceStyle,
  colorMode,
  setColorMode,
  onNavigate,
  onLogout,
}: ProfileProps) {
  const { db, refresh } = useAppData();

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showPasswordSheet, setShowPasswordSheet] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [theme, setTheme] = useState<"ancient" | "custom">("ancient");
  const [primaryColor, setPrimaryColor] = useState("#D4A24C");

  const [editName, setEditName] = useState(db.profile.name);
  const [editGoal, setEditGoal] = useState(String(db.profile.goalHoursPerDay));
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [curPassword, setCurPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  const [deleteBusy, setDeleteBusy] = useState(false);

  const cardClass = glass ? "card-glass" : "card-solid";
  const isAdmin = db.profile.role === "admin";

  const totalStudyMinutes =
    db.planItems.reduce((s, i) => s + (i.studyMinutes || 0), 0) +
    db.sessions.reduce((s, sess) => s + (sess.minutes || 0), 0);
  const totalStudyHours = Math.round(totalStudyMinutes / 60);
  const totalExams = db.exams.length;

  const SETTINGS = [
    { label: "ویرایش پروفایل و هدف", icon: "✏️", action: () => setShowEditSheet(true) },
    { label: "تغییر رمز عبور", icon: "🔒", action: () => setShowPasswordSheet(true) },
    { label: "مدیریت هشدارها", icon: "🔔", action: () => onNavigate("timer") },
    { label: "گزارش مطالعاتی", icon: "📊", action: () => onNavigate("stats") },
    {
      label: "نصب به عنوان PWA",
      icon: "📱",
      action: () => {
        // eslint-disable-next-line no-console
        console.info("نصب PWA از طریق مرورگر — درخواست beforeinstallprompt در سطح اپ مدیریت می‌شود.");
      },
    },
    {
      label: "مجوز اعلان‌ها",
      icon: "📢",
      action: () => {
        if ("Notification" in window) Notification.requestPermission();
      },
    },
  ];

  async function submitEdit() {
    setEditError(null);
    setEditBusy(true);
    try {
      await Api.updateMe({
        display_name: editName.trim(),
        goal_hours_per_day: parseFloat(editGoal) || db.profile.goalHoursPerDay,
      });
      await refresh();
      setShowEditSheet(false);
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : "ذخیره تغییرات ناموفق بود");
    } finally {
      setEditBusy(false);
    }
  }

  async function submitPasswordChange() {
    setPwError(null);
    setPwSuccess(null);
    if (!curPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setPwError("رمز جدید و تکرار آن یکسان نیستند");
      return;
    }
    setPwBusy(true);
    try {
      await Api.changePassword(curPassword, newPassword);
      setPwSuccess("رمز عبور با موفقیت تغییر کرد");
      setCurPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setShowPasswordSheet(false), 900);
    } catch (e) {
      setPwError(e instanceof ApiError ? e.message : "تغییر رمز عبور ناموفق بود");
    } finally {
      setPwBusy(false);
    }
  }

  async function confirmDeleteAllData() {
    setDeleteBusy(true);
    try {
      const userId = db.profile.userId;
      if (userId) await Store.clearDbCache(userId);
      setShowDeleteDialog(false);
      await onLogout();
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="bg-pattern min-h-screen pb-28 pt-16" style={{ direction: "rtl" }}>
      <Faravahar
        size={300}
        mono
        style={{
          position: "fixed",
          bottom: 60,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: 0.025,
          color: "var(--gold)",
          pointerEvents: "none",
        } as React.CSSProperties}
      />

      <div className="px-4 relative z-10" style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Avatar card */}
        <div className={`${cardClass} p-5 mt-4 mb-4 flex items-center gap-4`}>
          <div
            style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "linear-gradient(135deg, #E8B85C, #C49040)",
              boxShadow: "var(--shadow-gold)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 700, color: "#1C1510", flexShrink: 0,
            }}
          >
            {db.profile.name?.[0] || "؟"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{db.profile.name}</div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 2 }}>
              {db.profile.username ? `@${db.profile.username}` : ""}
            </div>
            <div className="flex gap-4 mt-3">
              <div style={{ textAlign: "center" }}>
                <div className="text-gold" style={{ fontSize: 16, fontWeight: 700 }}>{toPersian(totalStudyHours)}</div>
                <div style={{ fontSize: 10, color: "var(--fg-subtle)" }}>ساعت مطالعه</div>
              </div>
              <div style={{ width: 1, background: "var(--divider)" }} />
              <div style={{ textAlign: "center" }}>
                <div className="text-gold" style={{ fontSize: 16, fontWeight: 700 }}>{toPersian(totalExams)}</div>
                <div style={{ fontSize: 10, color: "var(--fg-subtle)" }}>آزمون</div>
              </div>
            </div>
          </div>
        </div>

        {/* Settings list */}
        <div className={`${cardClass} mb-4`} style={{ overflow: "hidden" }}>
          {SETTINGS.map((item, i) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                width: "100%", background: "none", border: "none",
                borderBottom: i < SETTINGS.length - 1 ? "1px solid var(--divider)" : "none",
                padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center",
                gap: 12, color: "var(--fg)", fontFamily: "inherit", fontSize: 14, fontWeight: 500,
                textAlign: "right", transition: "background 0.15s ease",
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              <span style={{ color: "var(--fg-subtle)", fontSize: 16 }}>›</span>
            </button>
          ))}
        </div>

        {/* ─── Appearance settings ─── */}
        <div className={`${cardClass} p-4 mb-4`}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>ظاهر</h3>

          <div className="mb-5">
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>تم</div>
            <div className="seg-control">
              <button className={`seg-tab ${theme === "ancient" ? "seg-tab-active" : ""}`} onClick={() => setTheme("ancient")}>
                فارسی باستان
              </button>
              <button className={`seg-tab ${theme === "custom" ? "seg-tab-active" : ""}`} onClick={() => setTheme("custom")}>
                سفارشی
              </button>
            </div>
          </div>

          <div className="mb-5">
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>حالت نمایش</div>
            <div className="seg-control">
              {(["light", "dark", "system"] as ColorMode[]).map((m) => {
                const labels: Record<ColorMode, string> = { light: "روشن", dark: "تاریک", system: "سیستم" };
                return (
                  <button
                    key={m}
                    className={`seg-tab ${colorMode === m ? "seg-tab-active" : ""}`}
                    onClick={() => {
                      setColorMode(m);
                      if (m === "light") setDarkMode(false);
                      if (m === "dark") setDarkMode(true);
                    }}
                    style={{ fontSize: 12 }}
                  >
                    {labels[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-5">
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>سطح کارت‌ها</div>
            <div className="seg-control">
              <button className={`seg-tab ${surfaceStyle === "solid" ? "seg-tab-active" : ""}`} onClick={() => setSurfaceStyle("solid")}>
                جامد
              </button>
              <button className={`seg-tab ${surfaceStyle === "glass" ? "seg-tab-active" : ""}`} onClick={() => setSurfaceStyle("glass")}>
                شیشه‌ای
              </button>
            </div>
          </div>

          {theme === "custom" && (
            <div
              className="animate-fade-up"
              style={{ padding: "16px", background: "var(--muted-bg)", borderRadius: 12, border: "1px solid var(--card-border)" }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 10 }}>رنگ اصلی</div>
              <div className="flex gap-3 flex-wrap mb-3">
                {["#D4A24C", "#5B8BF0", "#5BF0A8", "#F05BB8", "#A85BF0", "#F0885B"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setPrimaryColor(c)}
                    style={{
                      width: 36, height: 36, borderRadius: "50%", background: c,
                      border: primaryColor === c ? "3px solid var(--fg)" : "2px solid transparent",
                      cursor: "pointer", boxShadow: `0 0 10px ${c}66`,
                      transition: "transform 0.15s ease",
                      transform: primaryColor === c ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-subtle)" }}>
                رنگ‌های ثانوی به صورت خودکار از رنگ اصلی استخراج می‌شوند.
              </div>
            </div>
          )}
        </div>

        {/* Admin Panel (group admin only) */}
        {isAdmin && (
          <button
            onClick={() => onNavigate("admin")}
            className={cardClass}
            style={{
              width: "100%", background: "none", border: "1px solid var(--gold-border)",
              borderRadius: 16, padding: "14px 16px", cursor: "pointer", display: "flex",
              alignItems: "center", gap: 12, color: "var(--fg)", fontFamily: "inherit",
              fontSize: 14, fontWeight: 600, marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 16 }}>🛡️</span>
            <span style={{ flex: 1, textAlign: "right" }}>پنل مدیریت گروه</span>
            <span
              style={{
                fontSize: 10, fontWeight: 700, color: "var(--gold)",
                background: "rgba(212,162,76,0.12)", borderRadius: 6, padding: "2px 8px",
              }}
            >
              مدیر
            </span>
            <span style={{ color: "var(--fg-subtle)", fontSize: 16 }}>›</span>
          </button>
        )}

        {/* Danger zone */}
        <div className={`${cardClass} mb-8 mt-4`} style={{ overflow: "hidden" }}>
          <div
            style={{
              padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--fg-subtle)",
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}
          >
            منطقه خطر
          </div>
          <button
            onClick={() => setShowLogoutDialog(true)}
            style={{
              width: "100%", background: "none", border: "none", borderTop: "1px solid var(--divider)",
              padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
              color: "#F0A050", fontFamily: "inherit", fontSize: 14, fontWeight: 500, textAlign: "right",
            }}
          >
            <span style={{ fontSize: 16 }}>🚪</span>
            <span>خروج از حساب</span>
          </button>
          <button
            onClick={() => setShowDeleteDialog(true)}
            style={{
              width: "100%", background: "none", border: "none", borderTop: "1px solid var(--divider)",
              padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
              color: "#F05B5B", fontFamily: "inherit", fontSize: 14, fontWeight: 500, textAlign: "right",
            }}
          >
            <span style={{ fontSize: 16 }}>🗑️</span>
            <span>حذف داده‌های محلی و خروج</span>
          </button>
        </div>
      </div>

      {/* Edit profile sheet */}
      <BottomSheet open={showEditSheet} onClose={() => setShowEditSheet(false)} title="ویرایش پروفایل" glass={glass}>
        <div className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>نام نمایشی</label>
            <input className="input-field" value={editName} onChange={(e) => setEditName(e.target.value)} type="text" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>هدف روزانه (ساعت)</label>
            <input
              className="input-field"
              value={editGoal}
              onChange={(e) => setEditGoal(e.target.value)}
              type="number"
              style={{ direction: "ltr" }}
            />
          </div>
          {editError && <div style={{ color: "#E0685A", fontSize: 13, fontWeight: 600 }}>{editError}</div>}
          <button className="btn-primary w-full" onClick={submitEdit} disabled={editBusy || !editName.trim()}>
            {editBusy ? "در حال ذخیره…" : "ذخیره تغییرات"}
          </button>
        </div>
      </BottomSheet>

      {/* Change password sheet */}
      <BottomSheet open={showPasswordSheet} onClose={() => setShowPasswordSheet(false)} title="تغییر رمز عبور" glass={glass}>
        <div className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>رمز فعلی</label>
            <input className="input-field" type="password" value={curPassword} onChange={(e) => setCurPassword(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>رمز جدید</label>
            <input className="input-field" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>تکرار رمز جدید</label>
            <input className="input-field" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {pwError && <div style={{ color: "#E0685A", fontSize: 13, fontWeight: 600 }}>{pwError}</div>}
          {pwSuccess && <div style={{ color: "var(--gold)", fontSize: 13, fontWeight: 600 }}>{pwSuccess}</div>}
          <button
            className="btn-primary w-full"
            onClick={submitPasswordChange}
            disabled={pwBusy || !curPassword || !newPassword || !confirmPassword}
          >
            {pwBusy ? "در حال تغییر…" : "تغییر رمز"}
          </button>
        </div>
      </BottomSheet>

      {/* Logout dialog */}
      {showLogoutDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
          <div className={`${cardClass} p-6 w-full animate-fade-up`} style={{ maxWidth: 360 }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚪</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>خروج از حساب</h3>
              <p style={{ fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.6 }}>آیا از خروج از حساب کاربری اطمینان دارید؟</p>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowLogoutDialog(false)}>انصراف</button>
              <button
                onClick={() => {
                  setShowLogoutDialog(false);
                  onLogout();
                }}
                style={{
                  flex: 1, background: "#F0A050", color: "#1C1510", fontWeight: 700, borderRadius: 14,
                  padding: "12px", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14,
                }}
              >
                خروج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete data dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
          <div className={`${cardClass} p-6 w-full animate-fade-up`} style={{ maxWidth: 360 }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>حذف داده‌های محلی</h3>
              <p style={{ fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.6 }}>
                کش محلی این دستگاه پاک می‌شود و از حساب خارج می‌شوید. داده‌های سرور (برنامه‌ها، سوالات، آزمون‌ها)
                حذف نمی‌شوند و با ورود مجدد بازمی‌گردند.
              </p>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowDeleteDialog(false)}>انصراف</button>
              <button
                onClick={confirmDeleteAllData}
                disabled={deleteBusy}
                style={{
                  flex: 1, background: "#F05B5B", color: "white", fontWeight: 700, borderRadius: 14,
                  padding: "12px", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14,
                  opacity: deleteBusy ? 0.7 : 1,
                }}
              >
                {deleteBusy ? "در حال حذف…" : "حذف و خروج"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
