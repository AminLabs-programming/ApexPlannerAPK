import { useMemo, useState } from "react";
import { toPersian } from "../lib/utils";
import BottomSheet from "../components/BottomSheet";
import { useAppData } from "../lib/AppDataContext";
import { Jalali } from "../lib/jalali";
import type { PlanCategory } from "../lib/types";

interface PlanProps {
  glass?: boolean;
}

const CATEGORY_COLORS: Record<PlanCategory, string> = {
  "درسی": "#5B8BF0",
  "توسعه فردی": "#F05BB8",
  "غیردرسی": "#5BF0A8",
};

const FILTER_CHIPS: { id: "all" | PlanCategory; label: string }[] = [
  { id: "all", label: "همه" },
  { id: "درسی", label: "درسی" },
  { id: "توسعه فردی", label: "پرورشی" },
  { id: "غیردرسی", label: "غیر درسی" },
];

export default function Plan({ glass = false }: PlanProps) {
  const { db, addPlanItem, updatePlanItem, deletePlanItem } = useAppData();
  const [filter, setFilter] = useState<"all" | PlanCategory>("all");
  const [showSheet, setShowSheet] = useState(false);
  const [dateOffset, setDateOffset] = useState(0);
  const [addBusy, setAddBusy] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<PlanCategory>("درسی");
  const [newTime, setNewTime] = useState("");
  const [newDuration, setNewDuration] = useState("");

  const cardClass = glass ? "card-glass" : "card-solid";

  const activeDate = useMemo(() => Jalali.addDays(Jalali.todayStr(), dateOffset), [dateOffset]);
  const isToday = dateOffset === 0;

  const items = useMemo(
    () => db.planItems.filter((i) => i.date === activeDate),
    [db.planItems, activeDate]
  );
  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);

  const done = items.filter((i) => i.status === "done").length;
  const progress = items.length ? Math.round((done / items.length) * 100) : 0;

  function toggleDone(id: string, currentStatus: string) {
    updatePlanItem(id, { status: currentStatus === "done" ? "pending" : "done" });
  }

  async function submitAdd() {
    if (!newTitle.trim()) return;
    setAddBusy(true);
    try {
      await addPlanItem({
        name: newTitle.trim(),
        date: activeDate,
        category: newCategory,
        timeLabel: newTime,
      });
      setNewTitle("");
      setNewTime("");
      setNewDuration("");
      setShowSheet(false);
    } finally {
      setAddBusy(false);
    }
  }

  async function carryOverYesterday() {
    const yesterday = Jalali.addDays(activeDate, -1);
    const unfinished = db.planItems.filter((i) => i.date === yesterday && i.status !== "done");
    for (const item of unfinished) {
      await addPlanItem({
        name: item.name,
        date: activeDate,
        category: item.category,
        timeLabel: "",
      });
    }
  }

  return (
    <div className="bg-pattern min-h-screen pb-28 pt-16" style={{ direction: "rtl" }}>
      <div className="px-4" style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Date navigator */}
        <div className="flex items-center justify-between pt-4 mb-4">
          <button
            onClick={() => setDateOffset((p) => p - 1)}
            style={{
              background: "var(--muted-bg)",
              border: "none",
              borderRadius: 10,
              width: 36,
              height: 36,
              cursor: "pointer",
              color: "var(--fg-muted)",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ‹
          </button>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              {Jalali.weekdayLabel(activeDate)}
              {isToday && <span className="text-gold" style={{ marginRight: 6, fontSize: 12 }}>(امروز)</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
              {toPersian(Jalali.dayNumLabel(activeDate))} {Jalali.monthLabel(activeDate)}
            </div>
          </div>

          <button
            onClick={() => setDateOffset((p) => p + 1)}
            style={{
              background: "var(--muted-bg)",
              border: "none",
              borderRadius: 10,
              width: 36,
              height: 36,
              cursor: "pointer",
              color: "var(--fg-muted)",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ›
          </button>
        </div>

        {/* Progress bar */}
        <div className={`${cardClass} p-4 mb-4`}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 13, fontWeight: 600 }}>پیشرفت روز</span>
            <span className="text-gold" style={{ fontSize: 13, fontWeight: 700 }}>
              {toPersian(done)} از {toPersian(items.length)} مورد
            </span>
          </div>
          <div style={{ height: 8, background: "var(--muted-bg)", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "linear-gradient(90deg, #E8B85C, #C49040)",
                borderRadius: 4,
                boxShadow: "0 0 8px rgba(212,162,76,0.4)",
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 6 }}>
            {toPersian(progress)}٪ تکمیل شده
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
          {FILTER_CHIPS.map((c) => (
            <button
              key={c.id}
              className={`chip ${filter === c.id ? "chip-active" : ""}`}
              onClick={() => setFilter(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Plan items */}
        {filtered.length === 0 ? (
          <div className={`${cardClass} p-6 text-center mb-4`}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>موردی برای این روز ثبت نشده</div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>با دکمه‌ی پایین یه بخش جدید اضافه کن</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {filtered.map((item) => (
              <div key={item.id} className={`${cardClass} flex items-center gap-3 px-4 py-3.5`}>
                {/* Checkbox */}
                <button
                  onClick={() => toggleDone(item.id, item.status)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    border: item.status === "done" ? "none" : "1.5px solid var(--card-border-glass)",
                    background:
                      item.status === "done" ? "linear-gradient(135deg, #E8B85C, #C49040)" : "transparent",
                    boxShadow: item.status === "done" ? "var(--shadow-gold-sm)" : "none",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {item.status === "done" && (
                    <svg viewBox="0 0 12 12" width="13" height="13">
                      <path d="M2 6 L5 9 L10 3" stroke="#1C1510" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                    </svg>
                  )}
                </button>

                {/* Cat dot */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: CATEGORY_COLORS[item.category] || "#B0B0B0",
                    flexShrink: 0,
                    boxShadow: `0 0 5px ${CATEGORY_COLORS[item.category] || "#B0B0B0"}88`,
                  }}
                />

                {/* Content */}
                <div
                  style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                  onDoubleClick={() => {
                    if (confirm(`حذف «${item.name}»؟`)) deletePlanItem(item.id);
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: item.status === "done" ? "var(--fg-muted)" : "var(--fg)",
                      textDecoration: item.status === "done" ? "line-through" : "none",
                      opacity: item.status === "done" ? 0.7 : 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.name}
                  </div>
                  {(item.timeLabel || (item.status === "done" && item.studyMinutes > 0)) && (
                    <div style={{ fontSize: 11, color: "var(--fg-subtle)", marginTop: 2 }}>
                      {item.timeLabel}
                      {item.status === "done" && item.studyMinutes > 0 &&
                        ` ${item.timeLabel ? "—" : ""} ${toPersian(item.studyMinutes)} دقیقه`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button className="btn-primary flex-1" style={{ fontSize: 14 }} onClick={() => setShowSheet(true)}>
            + افزودن بخش جدید
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: 12, padding: "12px 14px", whiteSpace: "nowrap" }}
            onClick={carryOverYesterday}
          >
            جبران دیروز
          </button>
        </div>
      </div>

      {/* Add item sheet */}
      <BottomSheet open={showSheet} onClose={() => setShowSheet(false)} title="افزودن بخش جدید" glass={glass}>
        <div className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
              عنوان
            </label>
            <input
              className="input-field"
              type="text"
              placeholder="مثال: زیست — فصل تکوین"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
              دسته‌بندی
            </label>
            <div className="flex gap-2">
              {(["درسی", "توسعه فردی", "غیردرسی"] as PlanCategory[]).map((c) => (
                <button
                  key={c}
                  className={`chip ${newCategory === c ? "chip-active" : ""}`}
                  onClick={() => setNewCategory(c)}
                >
                  {c === "توسعه فردی" ? "پرورشی" : c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>زمان</label>
              <input
                className="input-field"
                type="time"
                style={{ direction: "ltr" }}
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>مدت (دق)</label>
              <input
                className="input-field"
                type="number"
                placeholder="۶۰"
                style={{ direction: "ltr" }}
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
              />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={submitAdd} disabled={addBusy || !newTitle.trim()}>
            {addBusy ? "در حال افزودن…" : "افزودن"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
