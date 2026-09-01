import { useEffect, useState } from "react";
import { toPersian } from "../lib/utils";
import BottomSheet from "../components/BottomSheet";
import { useAppData } from "../lib/AppDataContext";
import { Api } from "../lib/api";
import { Jalali } from "../lib/jalali";
import type { AnalysisExamFull, AnalysisNote } from "../lib/types";

interface AnalysisDetailProps {
  glass?: boolean;
  examId: string;
  onBack: () => void;
}

const statusColor: Record<AnalysisNote["status"], string> = {
  correct: "#5BF0A8",
  incorrect: "#F05B5B",
  unanswered: "var(--muted-bg)",
};
const statusBorder: Record<AnalysisNote["status"], string> = {
  correct: "rgba(91,240,168,0.5)",
  incorrect: "rgba(240,91,91,0.5)",
  unanswered: "var(--card-border)",
};

export default function AnalysisDetail({ glass = false, examId, onBack }: AnalysisDetailProps) {
  const { getAnalysisExamDetail, upsertAnalysisNote } = useAppData();

  const [exam, setExam] = useState<AnalysisExamFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedQ, setSelectedQ] = useState<number | null>(null);
  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState<AnalysisNote["status"]>("unanswered");
  const [noteSaving, setNoteSaving] = useState(false);

  const cardClass = glass ? "card-glass" : "card-solid";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAnalysisExamDetail(examId)
      .then((full) => {
        if (!cancelled) setExam(full);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "بارگذاری آزمون ناموفق بود");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examId, getAnalysisExamDetail]);

  const notesByNumber: Record<number, AnalysisNote> = {};
  (exam?.notes || []).forEach((n) => {
    notesByNumber[n.questionNumber] = n;
  });

  const totalQ = exam?.questionCount || 0;
  const correct = (exam?.notes || []).filter((n) => n.status === "correct").length;
  const incorrect = (exam?.notes || []).filter((n) => n.status === "incorrect").length;
  const unanswered = totalQ - correct - incorrect;

  function openQuestion(num: number) {
    const existing = notesByNumber[num];
    setSelectedQ(num);
    setNoteText(existing?.note || "");
    setNoteStatus(existing?.status || "unanswered");
    setShowNoteSheet(true);
  }

  async function submitNote() {
    if (!selectedQ) return;
    setNoteSaving(true);
    try {
      const saved = await upsertAnalysisNote(examId, {
        question_number: selectedQ,
        status: noteStatus,
        note: noteText,
      });
      setExam((prev) => {
        if (!prev) return prev;
        const others = prev.notes.filter((n) => n.questionNumber !== selectedQ);
        return { ...prev, notes: [...others, saved] };
      });
      setShowNoteSheet(false);
    } catch {
      /* keep sheet open on failure so the person can retry */
    } finally {
      setNoteSaving(false);
    }
  }

  const pdfUrl = Api.getAnalysisPdfUrl(examId);

  return (
    <div className="bg-pattern min-h-screen pb-28 pt-16" style={{ direction: "rtl" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Back header */}
        <div className="px-4 pt-4 mb-4 flex items-center gap-3">
          <button
            onClick={onBack}
            style={{
              background: "var(--muted-bg)", border: "none", borderRadius: 10,
              width: 36, height: 36, cursor: "pointer", color: "var(--fg-muted)",
              fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ›
          </button>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>{exam?.title || "…"}</h2>
            <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>
              {exam?.gradeLabel}
              {exam?.date ? ` — ${Jalali.gregorianStrToJalaliStr(exam.date)}` : ""}
            </p>
          </div>
        </div>

        {loading && (
          <div className="px-4 py-16 text-center" style={{ color: "var(--fg-muted)", fontSize: 13 }}>
            در حال بارگذاری…
          </div>
        )}
        {error && (
          <div className="px-4 py-16 text-center" style={{ color: "#E0685A", fontSize: 13 }}>
            {error}
          </div>
        )}

        {exam && !loading && !error && (
          <>
            {/* Stats strip */}
            <div className="px-4 mb-4">
              <div className={`${cardClass} flex justify-around p-3`}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#5BF0A8" }}>{toPersian(correct)}</div>
                  <div style={{ fontSize: 10, color: "var(--fg-subtle)" }}>درست</div>
                </div>
                <div style={{ width: 1, background: "var(--divider)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#F05B5B" }}>{toPersian(incorrect)}</div>
                  <div style={{ fontSize: 10, color: "var(--fg-subtle)" }}>غلط</div>
                </div>
                <div style={{ width: 1, background: "var(--divider)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg-muted)" }}>{toPersian(unanswered)}</div>
                  <div style={{ fontSize: 10, color: "var(--fg-subtle)" }}>نزده</div>
                </div>
                <div style={{ width: 1, background: "var(--divider)" }} />
                <div style={{ textAlign: "center" }}>
                  <div className="text-gold" style={{ fontSize: 20, fontWeight: 700 }}>
                    {toPersian(totalQ ? Math.round((correct / totalQ) * 100) : 0)}٪
                  </div>
                  <div style={{ fontSize: 10, color: "var(--fg-subtle)" }}>درصد</div>
                </div>
              </div>
            </div>

            {/* PDF viewer — real embed via native browser viewer */}
            <div className="px-4 mb-4">
              <div className={cardClass} style={{ aspectRatio: "3/4", overflow: "hidden", position: "relative" }}>
                <iframe
                  src={pdfUrl}
                  title={exam.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    transform: `scale(${zoom})`,
                    transformOrigin: "center",
                    transition: "transform 0.2s ease",
                  }}
                />
                <div
                  style={{
                    position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
                    display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(8px)", borderRadius: 20, padding: "6px 12px",
                  }}
                >
                  <button
                    onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
                    style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 14 }}
                  >
                    +
                  </button>
                  <span style={{ color: "white", fontSize: 12 }}>{toPersian(Math.round(zoom * 100))}٪</span>
                  <button
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                    style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 14 }}
                  >
                    −
                  </button>
                  <div style={{ width: 1, background: "rgba(255,255,255,0.3)", margin: "0 4px", height: 16 }} />
                  <a
                    href={Api.getAnalysisPdfUrl(examId, true)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "white", fontSize: 12, textDecoration: "none" }}
                  >
                    دانلود
                  </a>
                </div>
              </div>
            </div>

            {/* Question grid */}
            <div className="px-4">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>شبکه سوالات</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {Array.from({ length: totalQ }, (_, i) => i + 1).map((num) => {
                  const note = notesByNumber[num];
                  const status = note?.status || "unanswered";
                  return (
                    <button
                      key={num}
                      onClick={() => openQuestion(num)}
                      style={{
                        aspectRatio: "1", borderRadius: 8,
                        background: statusColor[status],
                        border: `1.5px solid ${statusBorder[status]}`,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 600,
                        color: status === "unanswered" ? "var(--fg-muted)" : "#1C1510",
                        boxShadow: note?.note ? `0 0 0 2px var(--gold)` : "none",
                        fontFamily: "inherit", transition: "transform 0.1s ease", position: "relative",
                      }}
                    >
                      {toPersian(num)}
                      {note?.note && (
                        <span
                          style={{
                            position: "absolute", top: 2, right: 2, width: 5, height: 5,
                            borderRadius: "50%", background: "var(--gold)",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-4 mt-4 mb-6 flex-wrap">
                {[
                  { color: "#5BF0A8", label: "درست" },
                  { color: "#F05B5B", label: "غلط" },
                  { color: "var(--muted-bg)", label: "نزده" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                    <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{l.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: "var(--muted-bg)", outline: "2px solid var(--gold)" }} />
                  <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>یادداشت</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Note sheet */}
      <BottomSheet
        open={showNoteSheet}
        onClose={() => setShowNoteSheet(false)}
        title={`سوال ${toPersian(selectedQ || 1)}`}
        glass={glass}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
              وضعیت پاسخ
            </label>
            <div className="flex gap-2">
              {(
                [
                  { id: "correct", label: "درست" },
                  { id: "incorrect", label: "غلط" },
                  { id: "unanswered", label: "نزده" },
                ] as { id: AnalysisNote["status"]; label: string }[]
              ).map((s) => (
                <button
                  key={s.id}
                  className={`chip ${noteStatus === s.id ? "chip-active" : ""}`}
                  onClick={() => setNoteStatus(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
              یادداشت (اختیاری)
            </label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="یادداشت، منبع، یا توضیح این سوال..."
              style={{ resize: "none" }}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>

          <button className="btn-primary w-full" onClick={submitNote} disabled={noteSaving}>
            {noteSaving ? "در حال ذخیره…" : "ذخیره یادداشت"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
