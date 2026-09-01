import { useMemo, useState } from "react";
import { toPersian } from "../lib/utils";
import type { Screen } from "../lib/utils";
import Faravahar from "../components/Faravahar";
import BottomSheet from "../components/BottomSheet";
import { useAppData } from "../lib/AppDataContext";
import { Jalali } from "../lib/jalali";
import type { PlanCategory } from "../lib/types";

interface HomeProps {
  glass?: boolean;
  onNavigate: (s: Screen) => void;
}

const CATEGORY_COLORS: Record<PlanCategory, string> = {
  "درسی": "#5B8BF0",
  "توسعه فردی": "#F05BB8",
  "غیردرسی": "#5BF0A8",
};

function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${toPersian(h)}:${toPersian(String(m).padStart(2, "0"))}`;
}

function CircleProgress({ percent }: { percent: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * circ;

  return (
    <div style={{ position: "relative", width: 140, height: 140 }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8B85C" />
            <stop offset="100%" stopColor="#C49040" />
          </linearGradient>
          <filter id="ringGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--ring-track)" strokeWidth="8" />
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          filter="url(#ringGlow)"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}
      >
        <span className="text-gold" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
          {toPersian(Math.round(percent))}٪
        </span>
        <span style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4 }}>تکمیل برنامه</span>
      </div>
    </div>
  );
}

export default function Home({ glass = false, onNavigate }: HomeProps) {
  const { db, addPlanItem, updatePlanItem } = useAppData();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<PlanCategory>("درسی");
  const [newTime, setNewTime] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const cardClass = glass ? "card-glass" : "card-solid";

  const today = Jalali.todayStr();

  const todayItems = useMemo(
    () => db.planItems.filter((i) => i.date === today),
    [db.planItems, today]
  );

  const progress = useMemo(() => {
    if (todayItems.length === 0) return 0;
    const done = todayItems.filter((i) => i.status === "done").length;
    return (done / todayItems.length) * 100;
  }, [todayItems]);

  const studiedMinutesToday = useMemo(() => {
    const fromItems = todayItems.reduce((sum, i) => sum + (i.studyMinutes || 0), 0);
    const fromSessions = db.sessions
      .filter((s) => s.date === today)
      .reduce((sum, s) => sum + (s.minutes || 0), 0);
    return fromItems + fromSessions;
  }, [todayItems, db.sessions, today]);

  const testsToday = useMemo(
    () => todayItems.reduce((sum, i) => sum + (i.testCount || 0), 0),
    [todayItems]
  );

  const streak = useMemo(() => {
    const days: { day: string; done: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = Jalali.addDays(today, -i);
      const dayItems = db.planItems.filter((it) => it.date === d);
      const done = dayItems.length > 0 && dayItems.every((it) => it.status === "done");
      days.push({ day: Jalali.WEEKDAYS_SHORT[Jalali.weekdayOf(...(d.split("-").map(Number) as [number, number, number]))], done });
    }
    return days;
  }, [db.planItems, today]);

  function toggleDone(id: string, currentStatus: string) {
    updatePlanItem(id, { status: currentStatus === "done" ? "pending" : "done" });
  }

  async function submitAdd() {
    if (!newTitle.trim()) return;
    await addPlanItem({
      name: newTitle.trim(),
      date: today,
      category: newCategory,
      timeLabel: newTime,
    });
    setNewTitle("");
    setNewTime("");
    setNewDuration("");
    setShowAddSheet(false);
  }

  return (
    <div className="bg-pattern min-h-screen pb-28 pt-16" style={{ direction: "rtl" }}>
      {/* Faravahar watermark */}
      <Faravahar
        size={340}
        mono
        style={{
          position: "fixed",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.025,
          color: "var(--gold)",
          pointerEvents: "none",
          zIndex: 0,
        } as React.CSSProperties}
      />

      <div className="px-4 relative z-10" style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Greeting */}
        <div className="pt-4 pb-6">
          <p style={{ color: "var(--fg-muted)", fontSize: 13, marginBottom: 4 }}>
            {Jalali.fullLabel(today)}
          </p>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>
            سلام، {db.profile.name} 👋
          </h2>
          <div className="gold-rule" style={{ marginTop: 12 }} />
        </div>

        {/* Stats 2×2 grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Goal hours */}
          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 12, color: "var(--fg-muted)", fontWeight: 500 }}>هدف روزانه</span>
              <span style={{ fontSize: 18, filter: "drop-shadow(0 0 6px rgba(212,162,76,0.5))" }}>🎯</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800 }} className="text-gold">
              {toPersian(db.profile.goalHoursPerDay)}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>ساعت</div>
          </div>

          {/* Studied today */}
          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 12, color: "var(--fg-muted)", fontWeight: 500 }}>مطالعه امروز</span>
              <span style={{ fontSize: 18, filter: "drop-shadow(0 0 6px rgba(232,184,92,0.4))" }}>⏱</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800 }} className="text-gold">
              {formatMinutes(studiedMinutesToday)}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>ساعت و دقیقه</div>
          </div>

          {/* Progress ring card */}
          <div className={`${cardClass} p-4 flex items-center justify-center`}>
            <CircleProgress percent={progress} />
          </div>

          {/* Tests today */}
          <div className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 12, color: "var(--fg-muted)", fontWeight: 500 }}>آزمون امروز</span>
              <span style={{ fontSize: 18 }}>📝</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800 }} className="text-gold">
              {toPersian(testsToday)}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>آزمون ثبت شده</div>

            {/* Streak row */}
            <div className="gold-rule" style={{ marginTop: 16, marginBottom: 12 }} />
            <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 8, fontWeight: 500 }}>
              استرک هفته
            </div>
            <div className="flex gap-1 justify-between">
              {streak.map((d, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: d.done ? "linear-gradient(135deg, #E8B85C, #C49040)" : "var(--muted-bg)",
                      boxShadow: d.done ? "0 0 8px rgba(212,162,76,0.4)" : "none",
                      margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {d.done && (
                      <svg viewBox="0 0 10 10" width="10" height="10">
                        <path d="M2 5 L4 7 L8 3" stroke="#1C1510" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 9, color: "var(--fg-muted)", marginTop: 2, display: "block" }}>
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-6">
          <button className="btn-primary flex-1" style={{ fontSize: 14 }} onClick={() => setShowAddSheet(true)}>
            + افزودن برنامه
          </button>
          <button className="btn-secondary flex-1" style={{ fontSize: 14 }} onClick={() => onNavigate("timer" as Screen)}>
            ثبت مطالعه
          </button>
        </div>

        {/* Today's plan preview */}
        <div className="mb-4 flex items-center justify-between">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>برنامه امروز</h3>
          <button
            onClick={() => onNavigate("plan" as Screen)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gold)", fontSize: 13, fontFamily: "inherit" }}
          >
            مشاهده همه ›
          </button>
        </div>

        {todayItems.length === 0 ? (
          <div className={`${cardClass} p-6 text-center`}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>برنامه‌ای برای امروز ثبت نشده</div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>با دکمه‌ی «افزودن برنامه» شروع کن</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayItems.slice(0, 6).map((item) => {
              const done = item.status === "done";
              return (
                <div
                  key={item.id}
                  className={`${cardClass} flex items-center gap-3 px-4 py-3`}
                  style={{ transition: "box-shadow 0.2s ease" }}
                >
                  <button
                    onClick={() => toggleDone(item.id, item.status)}
                    style={{
                      width: 22, height: 22, borderRadius: 6, border: "none",
                      background: done ? "linear-gradient(135deg, #E8B85C, #C49040)" : "transparent",
                      boxShadow: done ? "0 0 8px rgba(212,162,76,0.35)" : "none",
                      outline: done ? "none" : "1.5px solid var(--card-border)",
                      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    }}
                  >
                    {done && (
                      <svg viewBox="0 0 12 12" width="12" height="12">
                        <path d="M2 6 L5 9 L10 3" stroke="#1C1510" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>

                  <div
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: CATEGORY_COLORS[item.category] || "#B0B0B0",
                      flexShrink: 0,
                      boxShadow: `0 0 6px ${CATEGORY_COLORS[item.category] || "#B0B0B0"}66`,
                    }}
                  />

                  <span
                    style={{
                      flex: 1, fontSize: 14, fontWeight: 500,
                      color: done ? "var(--fg-muted)" : "var(--fg)",
                      textDecoration: done ? "line-through" : "none",
                      opacity: done ? 0.7 : 1,
                    }}
                  >
                    {item.name}
                  </span>

                  {done && item.studyMinutes > 0 && (
                    <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>
                      {formatMinutes(item.studyMinutes)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Plan Sheet */}
      <BottomSheet open={showAddSheet} onClose={() => setShowAddSheet(false)} title="افزودن آیتم برنامه" glass={glass}>
        <div className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
              عنوان
            </label>
            <input
              className="input-field"
              type="text"
              placeholder="مثال: ریاضی — معادلات"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
              دسته‌بندی
            </label>
            <div className="flex gap-2 flex-wrap">
              {(["درسی", "توسعه فردی", "غیردرسی"] as PlanCategory[]).map((c) => (
                <button
                  key={c}
                  className={`chip ${newCategory === c ? "chip-active" : ""}`}
                  onClick={() => setNewCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
                زمان شروع
              </label>
              <input
                className="input-field"
                type="time"
                style={{ direction: "ltr" }}
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
                مدت (دقیقه)
              </label>
              <input
                className="input-field"
                type="number"
                placeholder="۹۰"
                style={{ direction: "ltr" }}
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
              />
            </div>
          </div>
          <button className="btn-primary w-full mt-2" onClick={submitAdd} disabled={!newTitle.trim()}>
            افزودن به برنامه
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
