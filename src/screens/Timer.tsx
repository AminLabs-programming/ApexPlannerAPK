import { useState, useEffect, useRef } from "react";
import { toPersian } from "../lib/utils";
import BottomSheet from "../components/BottomSheet";
import { useAppData } from "../lib/AppDataContext";
import { Jalali } from "../lib/jalali";

interface TimerProps {
  glass?: boolean;
}

type TimerMode = "pomodoro" | "countdown" | "stopwatch";

const DURATION_PRESETS = [15, 30, 45, 60];
const SESSION_COLORS: Record<string, string> = {};
const PALETTE = ["#5B8BF0", "#F0885B", "#5BF0A8", "#F05BB8", "#A85BF0", "#E8B85C"];
function colorFor(subject: string) {
  if (!SESSION_COLORS[subject]) {
    const idx = Object.keys(SESSION_COLORS).length % PALETTE.length;
    SESSION_COLORS[subject] = PALETTE[idx];
  }
  return SESSION_COLORS[subject];
}

export default function Timer({ glass = false }: TimerProps) {
  const { db, addSession, addAlarm, deleteAlarm } = useAppData();

  const [mode, setMode] = useState<TimerMode>("pomodoro");
  const [playing, setPlaying] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [elapsed, setElapsed] = useState(0);
  const [subject, setSubject] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(25);
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [showAlarmSheet, setShowAlarmSheet] = useState(false);

  const [logSubject, setLogSubject] = useState("");
  const [logMinutes, setLogMinutes] = useState("25");
  const [logTime, setLogTime] = useState("");

  const [newAlarmLabel, setNewAlarmLabel] = useState("");
  const [newAlarmTime, setNewAlarmTime] = useState("");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cardClass = glass ? "card-glass" : "card-solid";

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setElapsed((p) => {
          if (mode !== "stopwatch" && p + 1 >= totalSeconds) {
            setPlaying(false);
            return totalSeconds;
          }
          return p + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, totalSeconds, mode]);

  const remaining = mode === "stopwatch" ? elapsed : Math.max(0, totalSeconds - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = mode === "stopwatch" ? 0 : elapsed / totalSeconds;

  const r = 110;
  const circ = 2 * Math.PI * r;
  const dash = progress * circ;

  const handlePreset = (min: number) => {
    setSelectedPreset(min);
    setTotalSeconds(min * 60);
    setElapsed(0);
    setPlaying(false);
  };

  const handleReset = () => {
    setElapsed(0);
    setPlaying(false);
  };

  function handleStop() {
    const minutesElapsed = Math.round(elapsed / 60);
    setPlaying(false);
    setElapsed(0);
    if (minutesElapsed > 0) {
      addSession({ subject: subject || "بدون‌عنوان", minutes: minutesElapsed, mode });
    }
    setLogSubject(subject);
    setLogMinutes(String(minutesElapsed || 25));
    setShowLogSheet(true);
  }

  function submitManualLog() {
    const m = parseInt(logMinutes, 10);
    if (!logSubject.trim() || !m || m <= 0) {
      setShowLogSheet(false);
      return;
    }
    addSession({ subject: logSubject.trim(), minutes: m, mode: "manual" });
    setShowLogSheet(false);
  }

  async function submitAlarm() {
    if (!newAlarmLabel.trim() || !newAlarmTime) return;
    await addAlarm({
      label: newAlarmLabel.trim(),
      time: newAlarmTime,
      days: [0, 1, 2, 3, 4, 5, 6],
      enabled: true,
    } as any);
    setNewAlarmLabel("");
    setNewAlarmTime("");
  }

  const recentSessions = [...db.sessions]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 6);

  const enabledAlarms = db.alarms.filter((a) => a.enabled);
  const nextAlarmLabel = (() => {
    if (enabledAlarms.length === 0) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const withDelta = enabledAlarms.map((a) => {
      const [h, m] = a.time.split(":").map(Number);
      let delta = h * 60 + m - nowMin;
      if (delta < 0) delta += 24 * 60;
      return { a, delta };
    });
    withDelta.sort((x, y) => x.delta - y.delta);
    const next = withDelta[0];
    const hoursLeft = Math.floor(next.delta / 60);
    const minsLeft = next.delta % 60;
    const etaLabel =
      hoursLeft > 0 ? `${toPersian(hoursLeft)} ساعت دیگر` : `${toPersian(minsLeft)} دقیقه دیگر`;
    return `${toPersian(enabledAlarms.length)} هشدار فعال — بعدی: ${toPersian(next.a.time)} (${etaLabel})`;
  })();

  return (
    <div className="bg-pattern min-h-screen pb-28 pt-16" style={{ direction: "rtl" }}>
      <div className="px-4" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="pt-4 mb-6">
          {/* Mode pills */}
          <div className="seg-control mb-6">
            {(["pomodoro", "countdown", "stopwatch"] as TimerMode[]).map((m) => {
              const labels: Record<TimerMode, string> = {
                pomodoro: "پومودورو",
                countdown: "شمارش معکوس",
                stopwatch: "کرونومتر",
              };
              return (
                <button
                  key={m}
                  className={`seg-tab ${mode === m ? "seg-tab-active" : ""}`}
                  onClick={() => {
                    setMode(m);
                    handleReset();
                    if (m === "stopwatch") setTotalSeconds(0);
                    else setTotalSeconds(selectedPreset * 60);
                  }}
                  style={{ fontSize: 13 }}
                >
                  {labels[m]}
                </button>
              );
            })}
          </div>

          {/* Subject input */}
          <div className="mb-8">
            <input
              className="input-field"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="عنوان درس..."
              style={{ textAlign: "center", fontSize: 16, fontWeight: 600 }}
            />
          </div>

          {/* Ring */}
          <div className="flex justify-center mb-6">
            <div style={{ position: "relative", width: 260, height: 260 }}>
              <svg width="260" height="260" viewBox="0 0 260 260">
                <defs>
                  <linearGradient id="timerGold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#E8B85C" />
                    <stop offset="100%" stopColor="#C49040" />
                  </linearGradient>
                  <filter id="timerGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                <circle cx="130" cy="130" r="124" fill="none" stroke="var(--card-border)" strokeWidth="1" />
                <circle cx="130" cy="130" r={r} fill="none" stroke="var(--ring-track)" strokeWidth="14" />

                {mode !== "stopwatch" && (
                  <circle
                    cx="130" cy="130" r={r}
                    fill="none"
                    stroke="url(#timerGold)"
                    strokeWidth="14"
                    strokeDasharray={`${dash} ${circ - dash}`}
                    strokeDashoffset={circ / 4}
                    strokeLinecap="round"
                    filter="url(#timerGlow)"
                    style={{ transition: playing ? "stroke-dasharray 0.9s linear" : "none" }}
                  />
                )}
                {mode === "stopwatch" && playing && (
                  <circle
                    cx="130" cy="130" r={r}
                    fill="none"
                    stroke="url(#timerGold)"
                    strokeWidth="14"
                    strokeDasharray={`${circ * 0.08} ${circ * 0.92}`}
                    strokeLinecap="round"
                    filter="url(#timerGlow)"
                    style={{ animation: "spin-ring 2s linear infinite" }}
                  />
                )}
              </svg>

              <div
                style={{
                  position: "absolute", inset: 0, display: "flex",
                  flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}
              >
                <span className="text-gold" style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {toPersian(String(mins).padStart(2, "0"))}:{toPersian(String(secs).padStart(2, "0"))}
                </span>
                <span style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 8 }}>
                  {mode === "pomodoro" ? "پومودورو" : mode === "countdown" ? "شمارش معکوس" : "کرونومتر"}
                </span>
                {subject && (
                  <span
                    style={{
                      fontSize: 12, color: "var(--gold)", marginTop: 4, fontWeight: 600,
                      maxWidth: 140, textAlign: "center", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {subject}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Duration presets (countdown only) */}
          {mode === "countdown" && (
            <div className="flex gap-2 justify-center mb-6">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p}
                  className={`chip ${selectedPreset === p ? "chip-active" : ""}`}
                  onClick={() => handlePreset(p)}
                >
                  {toPersian(p)} دق
                </button>
              ))}
            </div>
          )}

          {/* Transport buttons */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <button className="transport-btn transport-btn-secondary" style={{ width: 52, height: 52 }} onClick={handleReset}>
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path
                  d="M1 4V10H7M23 20V14H17M20.49 9C19.9828 7.56678 19.1209 6.28392 17.9845 5.27542C16.8482 4.26692 15.4745 3.56614 13.9917 3.24013C12.5089 2.91413 10.9652 2.97371 9.51266 3.41339C8.06007 3.85306 6.74722 4.65772 5.69997 5.74L1 10M23 14L18.3 18.26C17.2528 19.3423 15.9399 20.1469 14.4873 20.5866C13.0347 21.0263 11.4911 21.0859 10.0083 20.7599C8.52547 20.4339 7.15183 19.7331 6.01547 18.7246C4.87911 17.7161 4.01717 16.4332 3.51 15"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </button>

            <button className="transport-btn transport-btn-play" style={{ width: 72, height: 72 }} onClick={() => setPlaying((p) => !p)}>
              {playing ? (
                <svg viewBox="0 0 24 24" fill="#1C1510" width="28" height="28">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="#1C1510" width="28" height="28">
                  <path d="M8 5.14v14l11-7-11-7z" />
                </svg>
              )}
            </button>

            <button className="transport-btn transport-btn-secondary" style={{ width: 52, height: 52 }} onClick={handleStop}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          </div>

          {/* Alarms */}
          <div className={`${cardClass} p-4 mb-4`}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 14, fontWeight: 600 }}>هشدارها و یادآورها</span>
              <button
                onClick={() => setShowAlarmSheet(true)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gold)", fontSize: 13, fontFamily: "inherit" }}
              >
                مدیریت ›
              </button>
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
              {nextAlarmLabel || "هیچ هشداری تنظیم نشده"}
            </div>
          </div>

          {/* Recent sessions */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>جلسات اخیر</h3>
            {recentSessions.length === 0 ? (
              <div className={`${cardClass} p-5 text-center`}>
                <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>هنوز جلسه‌ای ثبت نشده</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recentSessions.map((s) => (
                  <div key={s.id} className={`${cardClass} flex items-center gap-3 px-4 py-3`}>
                    <div
                      style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: colorFor(s.subject),
                        boxShadow: `0 0 6px ${colorFor(s.subject)}88`,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{s.subject}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                        {Jalali.gregorianStrToJalaliStr(s.date)}
                      </div>
                    </div>
                    <span className="text-gold" style={{ fontSize: 13, fontWeight: 600 }}>
                      {toPersian(s.minutes)} دقیقه
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual log sheet */}
      <BottomSheet open={showLogSheet} onClose={() => setShowLogSheet(false)} title="ثبت مطالعه" glass={glass}>
        <div className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
              درس
            </label>
            <input
              className="input-field"
              type="text"
              value={logSubject}
              onChange={(e) => setLogSubject(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>مدت (دقیقه)</label>
              <input
                className="input-field"
                type="number"
                value={logMinutes}
                onChange={(e) => setLogMinutes(e.target.value)}
                style={{ direction: "ltr" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>زمان شروع</label>
              <input
                className="input-field"
                type="time"
                value={logTime}
                onChange={(e) => setLogTime(e.target.value)}
                style={{ direction: "ltr" }}
              />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={submitManualLog}>
            ثبت جلسه
          </button>
        </div>
      </BottomSheet>

      {/* Alarm sheet */}
      <BottomSheet open={showAlarmSheet} onClose={() => setShowAlarmSheet(false)} title="مدیریت هشدارها" glass={glass}>
        <div className="flex flex-col gap-3">
          {db.alarms.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--fg-muted)", textAlign: "center", padding: "12px 0" }}>
              هنوز هشداری اضافه نشده
            </div>
          )}
          {db.alarms.map((a) => (
            <div key={a.id} className={`${cardClass} flex items-center justify-between px-4 py-3`}>
              <span style={{ fontSize: 14 }}>
                {toPersian(a.time)} — {a.label}
              </span>
              <button
                onClick={() => deleteAlarm(a.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-muted)" }}
              >
                ✕
              </button>
            </div>
          ))}

          <div className="gold-rule" style={{ margin: "8px 0" }} />

          <div className="grid grid-cols-2 gap-3">
            <input
              className="input-field"
              type="text"
              placeholder="عنوان هشدار"
              value={newAlarmLabel}
              onChange={(e) => setNewAlarmLabel(e.target.value)}
            />
            <input
              className="input-field"
              type="time"
              value={newAlarmTime}
              onChange={(e) => setNewAlarmTime(e.target.value)}
              style={{ direction: "ltr" }}
            />
          </div>
          <button className="btn-primary w-full mt-2" onClick={submitAlarm} disabled={!newAlarmLabel.trim() || !newAlarmTime}>
            + افزودن هشدار
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
