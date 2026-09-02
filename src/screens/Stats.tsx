import { useMemo, useState } from "react";
import { toPersian } from "../lib/utils";
import BottomSheet from "../components/BottomSheet";
import { useAppData } from "../lib/AppDataContext";
import { Jalali } from "../lib/jalali";

interface StatsProps {
  glass?: boolean;
}

type StatsTab = "hours" | "exams" | "compare";

const SUBJECT_PALETTE = ["#5B8BF0", "#F0885B", "#5BF0A8", "#8BF05B", "#F05BB8", "#A85BF0", "#F0D45B", "#5BD0F0"];

export default function Stats({ glass = false }: StatsProps) {
  const { db, addExam } = useAppData();
  const [tab, setTab] = useState<StatsTab>("hours");
  const [showExamSheet, setShowExamSheet] = useState(false);
  const [examBusy, setExamBusy] = useState(false);

  const [examTitle, setExamTitle] = useState("");
  const [examScore, setExamScore] = useState("");
  const [examTotal, setExamTotal] = useState("100");
  const [examDate, setExamDate] = useState(Jalali.todayStr());

  const cardClass = glass ? "card-glass" : "card-solid";
  const today = Jalali.todayStr();

  // ---- weekly hours (last 7 days, from planItems.studyMinutes + sessions) ----
  const weeklyData = useMemo(() => {
    const days: { day: string; date: string; hours: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = Jalali.addDays(today, -i);
      const [y, m, dd] = d.split("-").map(Number);
      const fromItems = db.planItems
        .filter((it) => it.date === d)
        .reduce((sum, it) => sum + (it.studyMinutes || 0), 0);
      const fromSessions = db.sessions
        .filter((s) => s.date === d)
        .reduce((sum, s) => sum + (s.minutes || 0), 0);
      days.push({
        day: Jalali.WEEKDAYS_SHORT[Jalali.weekdayOf(y, m, dd)],
        date: d,
        hours: Math.round(((fromItems + fromSessions) / 60) * 10) / 10,
      });
    }
    return days;
  }, [db.planItems, db.sessions, today]);

  const maxHours = Math.max(1, ...weeklyData.map((d) => d.hours));
  const totalWeekHours = Math.round(weeklyData.reduce((s, d) => s + d.hours, 0) * 10) / 10;

  // ---- subject breakdown (from sessions, this week) ----
  const subjectBreakdown = useMemo(() => {
    const weekDates = weeklyData.map((d) => d.date);
    const bySubject: Record<string, number> = {};
    db.sessions
      .filter((s) => weekDates.includes(s.date))
      .forEach((s) => {
        bySubject[s.subject] = (bySubject[s.subject] || 0) + s.minutes;
      });
    db.planItems
      .filter((i) => weekDates.includes(i.date) && i.studyMinutes > 0)
      .forEach((i) => {
        bySubject[i.name] = (bySubject[i.name] || 0) + i.studyMinutes;
      });
    const total = Object.values(bySubject).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(bySubject)
      .map(([label, minutes], idx) => ({
        label,
        pct: Math.round((minutes / total) * 100),
        color: SUBJECT_PALETTE[idx % SUBJECT_PALETTE.length],
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [db.sessions, db.planItems, weeklyData]);

  // ---- missed items (last 7 days) ----
  const missedItems = useMemo(() => {
    const weekDates = weeklyData.map((d) => d.date);
    return db.planItems.filter(
      (i) => weekDates.includes(i.date) && (i.status === "missed" || i.status === "partial")
    );
  }, [db.planItems, weeklyData]);

  // ---- exams ----
  const sortedExams = useMemo(
    () => [...db.exams].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [db.exams]
  );

  function examTotalScore(subjects: { percent: number }[]) {
    if (!subjects.length) return 0;
    return Math.round(subjects.reduce((s, x) => s + x.percent, 0) / subjects.length);
  }

  async function submitExam() {
    const score = parseFloat(examScore);
    const total = parseFloat(examTotal) || 100;
    if (!examTitle.trim() || isNaN(score)) return;
    setExamBusy(true);
    try {
      await addExam({
        name: examTitle.trim(),
        date: examDate,
        subjects: [{ name: "کل", percent: Math.round((score / total) * 100) }],
      });
      setExamTitle("");
      setExamScore("");
      setExamTotal("100");
      setShowExamSheet(false);
    } finally {
      setExamBusy(false);
    }
  }

  const latest = sortedExams[0];
  const previous = sortedExams[1];

  return (
    <div className="bg-pattern min-h-screen pb-28 pt-16" style={{ direction: "rtl" }}>
      <div className="px-4" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="pt-4 mb-5">
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>آمار و عملکرد</h2>
        </div>

        {/* Tab control */}
        <div className="seg-control mb-6">
          {(["hours", "exams", "compare"] as StatsTab[]).map((t) => {
            const labels: Record<StatsTab, string> = {
              hours: "ساعات مطالعه",
              exams: "آزمون‌ها",
              compare: "مقایسه",
            };
            return (
              <button
                key={t}
                className={`seg-tab ${tab === t ? "seg-tab-active" : ""}`}
                onClick={() => setTab(t)}
                style={{ fontSize: 12 }}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {tab === "hours" && (
          <>
            {/* Weekly bar chart */}
            <div className={`${cardClass} p-4 mb-4`}>
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>نمودار هفتگی</h3>
                <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{Jalali.monthLabel(today)}</span>
              </div>

              <div className="flex items-end justify-between gap-1" style={{ height: 120 }}>
                {weeklyData.map((d) => {
                  const heightPct = (d.hours / maxHours) * 100;
                  const isToday = d.date === today;
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-1 flex-1">
                      <span style={{ fontSize: 9, color: isToday ? "var(--gold)" : "var(--fg-subtle)", fontWeight: isToday ? 700 : 400 }}>
                        {toPersian(d.hours)}
                      </span>
                      <div
                        style={{
                          width: "100%",
                          height: `${Math.max(heightPct, 3)}%`,
                          minHeight: 8,
                          borderRadius: "6px 6px 3px 3px",
                          background: isToday ? "linear-gradient(180deg, #E8B85C, #C49040)" : "var(--muted-bg)",
                          border: isToday ? "none" : "1px solid var(--card-border)",
                          boxShadow: isToday ? "0 0 12px rgba(212,162,76,0.35)" : "none",
                          transition: "height 0.5s ease",
                        }}
                      />
                      <span style={{ fontSize: 11, color: isToday ? "var(--gold)" : "var(--fg-muted)", fontWeight: isToday ? 700 : 400 }}>
                        {d.day}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="gold-rule" style={{ marginTop: 16, marginBottom: 10 }} />
              <div className="flex justify-between">
                <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>مجموع هفته</span>
                <span className="text-gold" style={{ fontSize: 13, fontWeight: 700 }}>
                  {toPersian(totalWeekHours)} ساعت
                </span>
              </div>
            </div>

            {/* Subject breakdown */}
            <div className={`${cardClass} p-4 mb-4`}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>تفکیک درسی</h3>
              {subjectBreakdown.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--fg-muted)", textAlign: "center", padding: "8px 0" }}>
                  هنوز داده‌ای برای این هفته ثبت نشده
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {subjectBreakdown.map((s) => (
                    <div key={s.label}>
                      <div className="flex justify-between mb-1">
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>{s.label}</span>
                        <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{toPersian(s.pct)}٪</span>
                      </div>
                      <div style={{ height: 6, background: "var(--muted-bg)", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${s.pct}%`,
                            background: s.color,
                            borderRadius: 3,
                            boxShadow: `0 0 6px ${s.color}66`,
                            transition: "width 0.6s ease",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Missed items */}
            <div className={`${cardClass} p-4`}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>موارد انجام‌نشده</h3>
              {missedItems.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>موردی برای این هفته وجود ندارد 🎉</div>
              ) : (
                missedItems.map((item, i) => (
                  <div
                    key={item.id}
                    style={{
                      fontSize: 13, color: "var(--fg-muted)", padding: "6px 0",
                      borderBottom: i < missedItems.length - 1 ? "1px solid var(--divider)" : "none",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F05B5B", display: "inline-block" }} />
                    {item.name}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "exams" && (
          <>
            {sortedExams.length === 0 ? (
              <div className={`${cardClass} p-6 text-center mb-4`}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📝</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>هنوز آزمونی ثبت نشده</div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mb-4">
                {sortedExams.map((e) => {
                  const score = examTotalScore(e.subjects);
                  return (
                    <div key={e.id} className={`${cardClass} p-4`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{e.name}</div>
                          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 3 }}>
                            {Jalali.gregorianStrToJalaliStr(e.date)}
                          </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div className="text-gold" style={{ fontSize: 22, fontWeight: 800 }}>
                            {toPersian(score)}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>از {toPersian(100)}</div>
                        </div>
                      </div>
                      <div style={{ height: 6, background: "var(--muted-bg)", borderRadius: 3, marginTop: 12, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${score}%`,
                            background: "linear-gradient(90deg, #E8B85C, #C49040)",
                            borderRadius: 3,
                            boxShadow: "0 0 8px rgba(212,162,76,0.3)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="btn-primary w-full" onClick={() => setShowExamSheet(true)}>
              + ثبت آزمون جدید
            </button>
          </>
        )}

        {tab === "compare" && (
          <>
            {!latest || !previous ? (
              <div className={`${cardClass} p-6 text-center mb-4`}>
                <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
                  برای مقایسه، حداقل به دو آزمون ثبت‌شده نیاز است
                </div>
              </div>
            ) : (
              <div className={`${cardClass} p-4 mb-4`}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>مقایسه دو آزمون اخیر</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 4 }}>آزمون قبلی</div>
                    <div className="text-gold" style={{ fontSize: 36, fontWeight: 800 }}>
                      {toPersian(examTotalScore(previous.subjects))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{previous.name}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 4 }}>آزمون اخیر</div>
                    <div className="text-gold" style={{ fontSize: 36, fontWeight: 800 }}>
                      {toPersian(examTotalScore(latest.subjects))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{latest.name}</div>
                  </div>
                </div>
                <div className="gold-rule" style={{ margin: "14px 0" }} />
                <div className="flex items-center justify-center gap-2">
                  <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>تغییر:</span>
                  {(() => {
                    const delta = examTotalScore(latest.subjects) - examTotalScore(previous.subjects);
                    return (
                      <span style={{ color: delta >= 0 ? "#3BC878" : "#F05B5B", fontWeight: 700, fontSize: 15 }}>
                        {delta >= 0 ? "+" : "−"}
                        {toPersian(Math.abs(delta))} نمره
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}

            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>تاریخچه کامل</h3>
            {sortedExams.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>هنوز آزمونی ثبت نشده</div>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedExams.map((e, i) => {
                  const score = examTotalScore(e.subjects);
                  const prevScore = i < sortedExams.length - 1 ? examTotalScore(sortedExams[i + 1].subjects) : null;
                  return (
                    <div key={e.id} className={`${cardClass} flex items-center justify-between px-4 py-3`}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{Jalali.gregorianStrToJalaliStr(e.date)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gold" style={{ fontSize: 16, fontWeight: 700 }}>
                          {toPersian(score)}
                        </span>
                        {prevScore !== null && (
                          <span style={{ fontSize: 11, color: score > prevScore ? "#5BF0A8" : "#F05B5B", fontWeight: 600 }}>
                            {score > prevScore ? "↑" : "↓"}
                            {toPersian(Math.abs(score - prevScore))}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add exam sheet */}
      <BottomSheet open={showExamSheet} onClose={() => setShowExamSheet(false)} title="ثبت آزمون جدید" glass={glass}>
        <div className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>عنوان آزمون</label>
            <input
              className="input-field"
              type="text"
              placeholder="مثال: آزمون جامع شهریور"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>نمره</label>
              <input
                className="input-field"
                type="number"
                placeholder="۸۵"
                style={{ direction: "ltr" }}
                value={examScore}
                onChange={(e) => setExamScore(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>از</label>
              <input
                className="input-field"
                type="number"
                value={examTotal}
                onChange={(e) => setExamTotal(e.target.value)}
                style={{ direction: "ltr" }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>تاریخ</label>
            <input
              className="input-field"
              type="date"
              style={{ direction: "ltr" }}
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full" onClick={submitExam} disabled={examBusy || !examTitle.trim() || !examScore}>
            {examBusy ? "در حال ثبت…" : "ثبت آزمون"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
