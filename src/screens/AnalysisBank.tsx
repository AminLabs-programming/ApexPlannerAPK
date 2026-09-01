import { useEffect, useState } from "react";
import { toPersian } from "../lib/utils";
import Faravahar from "../components/Faravahar";
import BottomSheet from "../components/BottomSheet";
import { useAppData } from "../lib/AppDataContext";
import { Jalali } from "../lib/jalali";

interface AnalysisBankProps {
  glass?: boolean;
  onDetail?: (examId: string) => void;
}

const GRADE_OPTIONS = [
  { label: "دهم", value: 10 },
  { label: "یازدهم", value: 11 },
  { label: "دوازدهم", value: 12 },
];
const GRADE_FILTERS = ["همه", "دهم", "یازدهم", "دوازدهم"];

function gradeValue(label: string) {
  return GRADE_OPTIONS.find((g) => g.label === label)?.value;
}

export default function AnalysisBank({ glass = false, onDetail }: AnalysisBankProps) {
  const { analysisExams, analysisExamsLoading, loadAnalysisExams, uploadAnalysisExam } = useAppData();

  const [gradeFilter, setGradeFilter] = useState("همه");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState(12);
  const [questionCount, setQuestionCount] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const cardClass = glass ? "card-glass" : "card-solid";

  useEffect(() => {
    loadAnalysisExams(gradeFilter === "همه" ? undefined : gradeValue(gradeFilter));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeFilter]);

  async function submitUpload() {
    if (!title.trim() || !file) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      await uploadAnalysisExam(
        {
          title: title.trim(),
          grade,
          question_count: parseInt(questionCount, 10) || 0,
        },
        file
      );
      setTitle("");
      setQuestionCount("");
      setFile(null);
      setShowUploadSheet(false);
    } catch (e: any) {
      setUploadError(e?.message || "آپلود ناموفق بود");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="bg-pattern min-h-screen pb-28 pt-16" style={{ direction: "rtl" }}>
      <div className="px-4" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="pt-4 mb-4 flex items-center justify-between">
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>بانک تحلیل</h2>
            <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 2 }}>
              {toPersian(analysisExams.length)} آزمون
            </p>
          </div>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            style={{
              background: filterOpen ? "linear-gradient(135deg, #E8B85C, #C49040)" : "var(--muted-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: filterOpen ? "#1C1510" : "var(--fg-muted)",
              fontFamily: "inherit",
              boxShadow: filterOpen ? "var(--shadow-gold-sm)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            فیلتر {filterOpen ? "▲" : "▼"}
          </button>
        </div>

        {/* Filter panel */}
        {filterOpen && (
          <div className={`${cardClass} p-4 mb-4 animate-fade-up`}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>پایه تحصیلی</div>
            <div className="flex gap-2 flex-wrap">
              {GRADE_FILTERS.map((g) => (
                <button
                  key={g}
                  className={`chip ${gradeFilter === g ? "chip-active" : ""}`}
                  onClick={() => setGradeFilter(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Exam list */}
        {analysisExamsLoading ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>در حال بارگذاری…</div>
          </div>
        ) : analysisExams.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <Faravahar size={80} mono style={{ color: "var(--muted-bg)", opacity: 0.5 } as React.CSSProperties} />
            <p style={{ color: "var(--fg-muted)", fontSize: 15 }}>آزمونی یافت نشد</p>
            <p style={{ color: "var(--fg-subtle)", fontSize: 13 }}>یک دفترچه‌ی آزمون آپلود کنید</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-4">
            {analysisExams.map((exam) => (
              <button
                key={exam.id}
                onClick={() => onDetail?.(exam.id)}
                className={`${cardClass} p-4 text-right w-full`}
                style={{ cursor: "pointer", border: "1px solid var(--card-border)", transition: "box-shadow 0.2s ease" }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>{exam.title}</div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                      {exam.gradeLabel || (exam.grade ? `پایه ${toPersian(exam.grade)}` : "")}
                      {exam.date ? ` — ${Jalali.gregorianStrToJalaliStr(exam.date)}` : ""}
                    </div>
                  </div>
                  {exam.notesCount === 0 && (
                    <span
                      style={{
                        fontSize: 11, background: "rgba(240,91,91,0.12)", color: "#F05B5B",
                        borderRadius: 6, padding: "2px 8px", fontWeight: 600, flexShrink: 0,
                      }}
                    >
                      بدون پاسخ
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-subtle)" }}>
                  {toPersian(exam.questionCount)} سوال — {toPersian(exam.pageCount)} صفحه
                  {exam.notesCount > 0 && ` — ${toPersian(exam.notesCount)} یادداشت ثبت‌شده`}
                </div>
              </button>
            ))}
          </div>
        )}

        <button className="btn-primary w-full" onClick={() => setShowUploadSheet(true)}>
          + آپلود دفترچه آزمون
        </button>
      </div>

      {/* Upload sheet */}
      <BottomSheet open={showUploadSheet} onClose={() => setShowUploadSheet(false)} title="آپلود دفترچه آزمون" glass={glass}>
        <div className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>نام آزمون</label>
            <input
              className="input-field"
              type="text"
              placeholder="مثال: کنکور ۱۴۰۳"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>پایه</label>
              <select className="input-field" style={{ cursor: "pointer" }} value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>تعداد سوال</label>
              <input
                className="input-field"
                type="number"
                placeholder="۴۰"
                style={{ direction: "ltr" }}
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
              />
            </div>
          </div>

          <label
            style={{
              border: "2px dashed var(--card-border)",
              borderRadius: 12,
              padding: "32px 24px",
              textAlign: "center",
              cursor: "pointer",
              color: "var(--fg-muted)",
              display: "block",
            }}
          >
            <input
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {file ? file.name : "فایل PDF را انتخاب کنید"}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-subtle)", marginTop: 4 }}>حداکثر ۵۰ مگابایت</div>
          </label>

          {uploadError && (
            <div style={{ color: "#E0685A", fontSize: 13, fontWeight: 600 }}>{uploadError}</div>
          )}

          <button
            className="btn-primary w-full"
            onClick={submitUpload}
            disabled={uploadBusy || !title.trim() || !file}
          >
            {uploadBusy ? "در حال آپلود…" : "آپلود و ادامه"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
