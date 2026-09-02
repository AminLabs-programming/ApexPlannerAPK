import { useMemo, useState } from "react";
import { SUBJECTS } from "../lib/utils";
import BottomSheet from "../components/BottomSheet";
import Faravahar from "../components/Faravahar";
import { useAppData } from "../lib/AppDataContext";
import type { Difficulty } from "../lib/types";

interface QuestionsProps {
  glass?: boolean;
}

const DIFF_FILTERS: { id: "all" | Difficulty; label: string }[] = [
  { id: "all", label: "همه" },
  { id: "easy", label: "آسان" },
  { id: "mid", label: "متوسط" },
  { id: "hard", label: "سخت" },
];

const diffColor: Record<Difficulty, string> = {
  easy: "#5BF0A8",
  mid: "#E8B85C",
  hard: "#F05B5B",
};
const diffLabel: Record<Difficulty, string> = {
  easy: "آسان",
  mid: "متوسط",
  hard: "سخت",
};

function subjectMeta(subjectLabel: string) {
  return SUBJECTS.find((s) => s.label === subjectLabel);
}

export default function Questions({ glass = false }: QuestionsProps) {
  const { db, addQuestion, deleteQuestion } = useAppData();
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [diffFilter, setDiffFilter] = useState<"all" | Difficulty>("all");
  const [showSheet, setShowSheet] = useState(false);
  const [addBusy, setAddBusy] = useState(false);

  const [newText, setNewText] = useState("");
  const [newSubject, setNewSubject] = useState(SUBJECTS[0].label);
  const [newDifficulty, setNewDifficulty] = useState<Difficulty>("mid");
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  const [correctIdx, setCorrectIdx] = useState(0);

  const cardClass = glass ? "card-glass" : "card-solid";

  const filtered = useMemo(() => {
    return db.questions.filter((q) => {
      if (subjectFilter !== "all" && q.subject !== subjectFilter) return false;
      if (diffFilter !== "all" && q.difficulty !== diffFilter) return false;
      if (search && !q.text.includes(search)) return false;
      return true;
    });
  }, [db.questions, subjectFilter, diffFilter, search]);

  async function submitAdd() {
    const opts = newOptions.map((t) => t.trim()).filter(Boolean);
    if (!newText.trim() || opts.length < 2) return;
    setAddBusy(true);
    try {
      await addQuestion({
        text: newText.trim(),
        subject: newSubject,
        topic: "",
        difficulty: newDifficulty,
        options: opts.map((text, i) => ({ text, correct: i === correctIdx })),
      });
      setNewText("");
      setNewOptions(["", "", "", ""]);
      setCorrectIdx(0);
      setShowSheet(false);
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <div className="bg-pattern min-h-screen pb-28 pt-16" style={{ direction: "rtl" }}>
      <Faravahar
        size={260}
        mono
        style={{
          position: "fixed",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.03,
          color: "var(--gold)",
          pointerEvents: "none",
        } as React.CSSProperties}
      />

      <div className="px-4 relative z-10" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="pt-4 mb-4">
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>بانک سوالات</h2>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 2 }}>{filtered.length} سوال</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در سوالات..."
            style={{ paddingRight: 40 }}
          />
          <svg
            viewBox="0 0 24 24" fill="none" width="16" height="16"
            style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--fg-subtle)" }}
          >
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Subject chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: "none" }}>
          <button className={`chip ${subjectFilter === "all" ? "chip-active" : ""}`} onClick={() => setSubjectFilter("all")}>
            همه
          </button>
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              className={`chip ${subjectFilter === s.label ? "chip-active" : ""}`}
              onClick={() => setSubjectFilter(s.label)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Difficulty chips */}
        <div className="flex gap-2 mb-5">
          {DIFF_FILTERS.map((d) => (
            <button key={d.id} className={`chip ${diffFilter === d.id ? "chip-active" : ""}`} onClick={() => setDiffFilter(d.id)}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Question list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <Faravahar size={80} mono style={{ color: "var(--muted-bg)", opacity: 0.5 } as React.CSSProperties} />
            <p style={{ color: "var(--fg-muted)", fontSize: 15 }}>سوالی یافت نشد</p>
            <p style={{ color: "var(--fg-subtle)", fontSize: 13 }}>فیلترها را تغییر دهید یا سوال جدید اضافه کنید</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-4">
            {filtered.map((q) => {
              const subj = subjectMeta(q.subject);
              return (
                <div key={q.id} className={`${cardClass} p-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: subj?.color || "#999",
                        boxShadow: `0 0 5px ${subj?.color || "#999"}88`,
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontSize: 12, color: "var(--fg-muted)", fontWeight: 500 }}>
                      {q.subject}
                    </span>
                    <span
                      style={{
                        marginRight: "auto", fontSize: 11, fontWeight: 600,
                        color: diffColor[q.difficulty], background: `${diffColor[q.difficulty]}18`,
                        borderRadius: 6, padding: "2px 8px",
                      }}
                    >
                      {diffLabel[q.difficulty]}
                    </span>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-subtle)", fontSize: 13 }}
                    >
                      ✕
                    </button>
                  </div>

                  <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.7, marginBottom: 12 }}>{q.text}</p>

                  <div className="flex flex-col gap-1.5">
                    {q.options.map((opt, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: 13, padding: "7px 12px", borderRadius: 8,
                          background: opt.correct ? "rgba(91, 240, 168, 0.15)" : "var(--muted-bg)",
                          border: opt.correct ? "1px solid rgba(91,240,168,0.4)" : "1px solid transparent",
                          color: opt.correct ? "#3BC878" : "var(--fg-muted)",
                          fontWeight: opt.correct ? 600 : 400,
                          display: "flex", alignItems: "center", gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 18, height: 18, borderRadius: "50%",
                            border: opt.correct ? "1.5px solid #3BC878" : "1.5px solid var(--card-border)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, fontSize: 9,
                          }}
                        >
                          {opt.correct && (
                            <svg viewBox="0 0 10 10" width="10" height="10">
                              <path d="M2 5L4 7.5L8 2.5" stroke="#3BC878" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                            </svg>
                          )}
                        </span>
                        {opt.text}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button className="btn-primary w-full" onClick={() => setShowSheet(true)}>
          + افزودن سوال جدید
        </button>
      </div>

      {/* Add question sheet */}
      <BottomSheet open={showSheet} onClose={() => setShowSheet(false)} title="افزودن سوال" glass={glass}>
        <div className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
              متن سوال
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="متن سوال را اینجا بنویسید..."
              style={{ resize: "vertical" }}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
              درس
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  className={`chip ${newSubject === s.label ? "chip-active" : ""}`}
                  onClick={() => setNewSubject(s.label)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
              سختی
            </label>
            <div className="flex gap-2">
              {DIFF_FILTERS.slice(1).map((d) => (
                <button
                  key={d.id}
                  className={`chip ${newDifficulty === d.id ? "chip-active" : ""}`}
                  onClick={() => setNewDifficulty(d.id as Difficulty)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
              گزینه‌ها (گزینه‌ی درست را انتخاب کنید)
            </label>
            <div className="flex flex-col gap-2">
              {newOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <button
                    onClick={() => setCorrectIdx(idx)}
                    style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      border: correctIdx === idx ? "none" : "1.5px solid var(--card-border)",
                      background: correctIdx === idx ? "linear-gradient(135deg,#5BF0A8,#3BC878)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    }}
                  >
                    {correctIdx === idx && (
                      <svg viewBox="0 0 10 10" width="10" height="10">
                        <path d="M2 5L4 7.5L8 2.5" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                  <input
                    className="input-field"
                    placeholder={`گزینه ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...newOptions];
                      next[idx] = e.target.value;
                      setNewOptions(next);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn-primary w-full"
            onClick={submitAdd}
            disabled={addBusy || !newText.trim() || newOptions.filter((o) => o.trim()).length < 2}
          >
            {addBusy ? "در حال ذخیره…" : "ذخیره سوال"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
