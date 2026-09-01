import { useState } from "react";
import Faravahar from "../components/Faravahar";
import type { Screen } from "../lib/utils";

interface ConceptGalleryProps {
  onEnterApp: () => void;
  onBack: () => void;
}

type ConceptScreen = "login" | "home" | "timer" | "plan";
type ConceptId = 1 | 2 | 3 | 4;

const CONCEPTS = [
  {
    id: 1 as ConceptId,
    name: "Royal Minimal",
    nameFA: "رویال مینیمال",
    description: "خطوط تمیز، سطوح جامد، تایپوگرافی مطمئن. طلا فقط در جزئیات.",
    bg: "#FAF6EF",
    card: "#FFF9EE",
    text: "#1C1510",
    muted: "#7A6850",
    gold: "#D4A24C",
    accent: "#D4A24C",
    border: "rgba(212,162,76,0.15)",
    shadow: "0 2px 12px rgba(0,0,0,0.06)",
    glass: false,
    ornament: false,
  },
  {
    id: 2 as ConceptId,
    name: "Persian Glass",
    nameFA: "پرشین گلاس",
    description: "شیشه مات و تار، لایه‌بندی عمق، حاشیه‌های طلایی شفاف.",
    bg: "#F5F0E8",
    card: "rgba(255,249,238,0.68)",
    text: "#1C1510",
    muted: "#7A6850",
    gold: "#D4A24C",
    accent: "#E8B85C",
    border: "rgba(212,162,76,0.3)",
    shadow: "0 4px 24px rgba(212,162,76,0.12), 0 2px 8px rgba(0,0,0,0.06)",
    glass: true,
    ornament: false,
  },
  {
    id: 3 as ConceptId,
    name: "Contemporary Persia",
    nameFA: "ایران معاصر",
    description: "هندسه تخت جمشید قابل مشاهده، هدر فراوهر بزرگتر، الگوی برجسته‌تر.",
    bg: "#F8F2E8",
    card: "#FFF7E6",
    text: "#1C1510",
    muted: "#7A6850",
    gold: "#C8952A",
    accent: "#C8952A",
    border: "rgba(200,149,42,0.25)",
    shadow: "0 2px 16px rgba(0,0,0,0.08)",
    glass: false,
    ornament: true,
  },
  {
    id: 4 as ConceptId,
    name: "Luxury Editorial",
    nameFA: "لاکچری اِدیتوریال",
    description: "تایپوگرافی سینمایی، فاصله سخاوتمندانه، طلا به عنوان خط راهنما.",
    bg: "#FDFAF4",
    card: "#FFF9EE",
    text: "#1C1510",
    muted: "#9A8568",
    gold: "#D4A24C",
    accent: "#D4A24C",
    border: "rgba(212,162,76,0.1)",
    shadow: "0 1px 4px rgba(0,0,0,0.04)",
    glass: false,
    ornament: false,
  },
];

// Mini Login mockup for each concept
function MiniLogin({ concept }: { concept: typeof CONCEPTS[0] }) {
  return (
    <div
      style={{
        background: concept.bg,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 12px",
        direction: "rtl",
        gap: 12,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* BG pattern (concepts 3) */}
      {concept.ornament && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='32'%3E%3Cpath d='M0 10 h8 v-4 h8 v4 h8 v-4 h8 v4 h8' stroke='%23C8952A' stroke-width='0.5' fill='none' opacity='0.25'/%3E%3C/svg%3E")`,
            backgroundSize: "40px 32px",
            opacity: 0.6,
          }}
        />
      )}

      {/* Faravahar */}
      <div
        style={{
          filter: `drop-shadow(0 0 6px ${concept.gold}55)`,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Faravahar size={concept.id === 4 ? 52 : 44} />
      </div>

      {/* App name */}
      <div
        style={{
          fontSize: concept.id === 4 ? 14 : 12,
          fontWeight: concept.id === 4 ? 800 : 700,
          color: concept.gold,
          letterSpacing: concept.id === 4 ? "0.06em" : "0.02em",
          position: "relative",
          zIndex: 1,
          lineHeight: concept.id === 4 ? 1.4 : 1.2,
          textAlign: "center",
        }}
      >
        اپکس پلنر
      </div>

      {/* Input fields placeholder */}
      <div
        style={{
          width: "100%",
          background: concept.glass ? concept.card : concept.card,
          backdropFilter: concept.glass ? "blur(12px)" : "none",
          border: `1px solid ${concept.border}`,
          borderRadius: concept.id === 4 ? 6 : 10,
          padding: "10px 10px",
          boxShadow: concept.shadow,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Segmented control */}
        <div
          style={{
            background: "rgba(0,0,0,0.05)",
            borderRadius: 6,
            display: "flex",
            padding: "2px",
            marginBottom: 4,
          }}
        >
          <div
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${concept.gold}, ${concept.accent})`,
              borderRadius: 4,
              padding: "3px 0",
              fontSize: 8,
              fontWeight: 700,
              color: "#1C1510",
              textAlign: "center",
            }}
          >
            ورود
          </div>
          <div
            style={{
              flex: 1,
              fontSize: 8,
              color: concept.muted,
              textAlign: "center",
              padding: "3px 0",
            }}
          >
            ثبت‌نام
          </div>
        </div>

        {/* Field stubs */}
        {[1, 2].map((f) => (
          <div
            key={f}
            style={{
              height: 20,
              background: "rgba(0,0,0,0.04)",
              borderRadius: concept.id === 4 ? 2 : 5,
              border: `1px solid ${concept.border}`,
            }}
          />
        ))}

        {/* Button */}
        <div
          style={{
            height: 22,
            background: `linear-gradient(135deg, ${concept.gold}, ${concept.accent})`,
            borderRadius: concept.id === 4 ? 4 : 7,
            boxShadow: `0 2px 8px ${concept.gold}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 8, fontWeight: 700, color: "#1C1510" }}>ورود به حساب</div>
        </div>
      </div>

      {/* Ornament: concept 3 border */}
      {concept.ornament && (
        <>
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              right: 6,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${concept.gold}55, transparent)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 6,
              left: 6,
              right: 6,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${concept.gold}55, transparent)`,
            }}
          />
        </>
      )}
    </div>
  );
}

// Mini Home mockup
function MiniHome({ concept }: { concept: typeof CONCEPTS[0] }) {
  return (
    <div
      style={{
        background: concept.bg,
        width: "100%",
        height: "100%",
        direction: "rtl",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {concept.ornament && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='32'%3E%3Cpath d='M0 10 h8 v-4 h8 v4 h8 v-4 h8 v4 h8' stroke='%23C8952A' stroke-width='0.5' fill='none' opacity='0.18'/%3E%3C/svg%3E")`,
            backgroundSize: "40px 32px",
          }}
        />
      )}

      {/* Greeting */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 7, color: concept.muted }}>شنبه، ۱۰ مرداد</div>
        <div style={{ fontSize: concept.id === 4 ? 13 : 11, fontWeight: 700, color: concept.text, marginTop: 1 }}>
          سلام، محمدامین 👋
        </div>
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${concept.gold}, transparent)`, marginTop: 4, opacity: 0.4 }} />
      </div>

      {/* 2x2 stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, position: "relative", zIndex: 1 }}>
        {[["۶ ساعت", "هدف"], ["۲:۴۵", "مطالعه"], ["۶۲٪", "پیشرفت"], ["۱ آزمون", "امروز"]].map(([val, label], i) => (
          <div
            key={i}
            style={{
              background: concept.glass ? concept.card : concept.card,
              backdropFilter: concept.glass ? "blur(10px)" : "none",
              border: `1px solid ${concept.border}`,
              borderRadius: concept.id === 4 ? 4 : 8,
              padding: "6px 8px",
              boxShadow: concept.shadow,
            }}
          >
            <div style={{ fontSize: concept.id === 4 ? 12 : 11, fontWeight: 800, color: concept.gold }}>{val}</div>
            <div style={{ fontSize: 7, color: concept.muted, marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Quick action buttons */}
      <div style={{ display: "flex", gap: 4, position: "relative", zIndex: 1 }}>
        <div
          style={{
            flex: 1,
            height: 20,
            background: `linear-gradient(135deg, ${concept.gold}, ${concept.accent})`,
            borderRadius: concept.id === 4 ? 3 : 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 2px 8px ${concept.gold}44`,
          }}
        >
          <span style={{ fontSize: 7, fontWeight: 700, color: "#1C1510" }}>+ افزودن</span>
        </div>
        <div
          style={{
            flex: 1,
            height: 20,
            background: "rgba(0,0,0,0.05)",
            border: `1px solid ${concept.border}`,
            borderRadius: concept.id === 4 ? 3 : 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 7, color: concept.muted }}>ثبت مطالعه</span>
        </div>
      </div>

      {/* Plan item stubs */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: concept.glass ? concept.card : concept.card,
            backdropFilter: concept.glass ? "blur(10px)" : "none",
            border: `1px solid ${concept.border}`,
            borderRadius: concept.id === 4 ? 4 : 8,
            height: 22,
            display: "flex",
            alignItems: "center",
            gap: 5,
            paddingRight: 8,
            boxShadow: concept.shadow,
            position: "relative",
            zIndex: 1,
            opacity: 1 - i * 0.15,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: i === 0 ? 3 : 2,
              background: i === 0 ? `linear-gradient(135deg, ${concept.gold}, ${concept.accent})` : "transparent",
              border: i > 0 ? `1px solid ${concept.border}` : "none",
              flexShrink: 0,
            }}
          />
          <div style={{ width: "60%", height: 3, background: "rgba(0,0,0,0.1)", borderRadius: 2 }} />
        </div>
      ))}
    </div>
  );
}

// Mini Timer mockup
function MiniTimer({ concept }: { concept: typeof CONCEPTS[0] }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = 0.6 * circ;

  return (
    <div
      style={{
        background: concept.bg,
        width: "100%",
        height: "100%",
        direction: "rtl",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "12px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {concept.ornament && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='32'%3E%3Cpath d='M0 10 h8 v-4 h8 v4 h8 v-4 h8 v4 h8' stroke='%23C8952A' stroke-width='0.5' fill='none' opacity='0.15'/%3E%3C/svg%3E")`,
            backgroundSize: "40px 32px",
          }}
        />
      )}

      {/* Mode pills */}
      <div
        style={{
          background: "rgba(0,0,0,0.05)",
          borderRadius: 8,
          display: "flex",
          padding: "2px",
          gap: 2,
          width: "80%",
          position: "relative",
          zIndex: 1,
        }}
      >
        {["پومودورو", "شمارش", "کرونو"].map((t, i) => (
          <div
            key={t}
            style={{
              flex: 1,
              background: i === 0 ? `linear-gradient(135deg, ${concept.gold}, ${concept.accent})` : "transparent",
              borderRadius: 6,
              padding: "3px 2px",
              fontSize: 6,
              fontWeight: i === 0 ? 700 : 400,
              color: i === 0 ? "#1C1510" : concept.muted,
              textAlign: "center",
            }}
          >
            {t}
          </div>
        ))}
      </div>

      {/* Ring */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <svg width="90" height="90" viewBox="0 0 90 90">
          <defs>
            <linearGradient id={`rg${concept.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={concept.gold} />
              <stop offset="100%" stopColor={concept.accent} />
            </linearGradient>
          </defs>
          <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="5" />
          <circle
            cx="45" cy="45" r={r}
            fill="none"
            stroke={`url(#rg${concept.id})`}
            strokeWidth="5"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ / 4}
            strokeLinecap="round"
            filter={concept.glass ? "url(#rg-glow)" : "none"}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: concept.id === 4 ? 16 : 14, fontWeight: 800, color: concept.gold }}>۲۲:۰۰</span>
          <span style={{ fontSize: 6, color: concept.muted, marginTop: 1 }}>ریاضی</span>
        </div>
      </div>

      {/* Transport */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative", zIndex: 1 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: concept.glass ? concept.card : concept.card,
            backdropFilter: concept.glass ? "blur(8px)" : "none",
            border: `1px solid ${concept.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: concept.shadow,
          }}
        >
          <svg viewBox="0 0 10 10" fill={concept.muted} width="8" height="8">
            <path d="M2 2h2v6H2zM6 2h2v6H6z" />
          </svg>
        </div>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${concept.gold}, ${concept.accent})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 2px 10px ${concept.gold}55`,
          }}
        >
          <svg viewBox="0 0 10 10" fill="#1C1510" width="10" height="10">
            <path d="M3 2l6 3-6 3z" />
          </svg>
        </div>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: concept.glass ? concept.card : concept.card,
            backdropFilter: concept.glass ? "blur(8px)" : "none",
            border: `1px solid ${concept.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: concept.shadow,
          }}
        >
          <svg viewBox="0 0 10 10" fill={concept.muted} width="8" height="8">
            <rect x="2" y="2" width="6" height="6" rx="1" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Mini Plan mockup
function MiniPlan({ concept }: { concept: typeof CONCEPTS[0] }) {
  const items = [
    { done: true, color: "#5B8BF0" },
    { done: false, color: "#F0885B" },
    { done: false, color: "#F05BB8" },
    { done: false, color: "#5BF0A8" },
  ];

  return (
    <div
      style={{
        background: concept.bg,
        width: "100%",
        height: "100%",
        direction: "rtl",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {concept.ornament && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='32'%3E%3Cpath d='M0 10 h8 v-4 h8 v4 h8 v-4 h8 v4 h8' stroke='%23C8952A' stroke-width='0.5' fill='none' opacity='0.15'/%3E%3C/svg%3E")`,
            backgroundSize: "40px 32px",
          }}
        />
      )}

      {/* Date nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ fontSize: 9, color: concept.muted }}>‹</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: concept.id === 4 ? 10 : 9, fontWeight: 700, color: concept.text }}>شنبه</div>
          <div style={{ fontSize: 7, color: concept.muted }}>۱۰ مرداد</div>
        </div>
        <div style={{ fontSize: 9, color: concept.muted }}>›</div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          background: concept.glass ? concept.card : concept.card,
          backdropFilter: concept.glass ? "blur(8px)" : "none",
          border: `1px solid ${concept.border}`,
          borderRadius: 6,
          padding: "6px 8px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ height: 4, background: "rgba(0,0,0,0.08)", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              width: "25%",
              height: "100%",
              background: `linear-gradient(90deg, ${concept.gold}, ${concept.accent})`,
              borderRadius: 2,
              boxShadow: `0 0 4px ${concept.gold}55`,
            }}
          />
        </div>
        <div style={{ fontSize: 7, color: concept.muted, marginTop: 3 }}>۲۵٪ تکمیل</div>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 3, position: "relative", zIndex: 1 }}>
        {["همه", "درسی", "سایر"].map((c, i) => (
          <div
            key={c}
            style={{
              fontSize: 6,
              padding: "2px 6px",
              borderRadius: 8,
              background: i === 0 ? `linear-gradient(135deg, ${concept.gold}, ${concept.accent})` : "rgba(0,0,0,0.06)",
              color: i === 0 ? "#1C1510" : concept.muted,
              fontWeight: i === 0 ? 700 : 400,
              boxShadow: i === 0 ? `0 1px 4px ${concept.gold}44` : "none",
            }}
          >
            {c}
          </div>
        ))}
      </div>

      {/* Plan items */}
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            background: concept.glass ? concept.card : concept.card,
            backdropFilter: concept.glass ? "blur(8px)" : "none",
            border: `1px solid ${concept.border}`,
            borderRadius: concept.id === 4 ? 4 : 7,
            height: 24,
            display: "flex",
            alignItems: "center",
            gap: 5,
            paddingRight: 8,
            boxShadow: concept.shadow,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 11,
              height: 11,
              borderRadius: 3,
              background: item.done ? `linear-gradient(135deg, ${concept.gold}, ${concept.accent})` : "transparent",
              border: item.done ? "none" : `1px solid ${concept.border}`,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {item.done && (
              <svg viewBox="0 0 8 8" width="7" height="7">
                <path d="M1 4L3 6L7 2" stroke="#1C1510" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
          <div
            style={{
              width: "55%",
              height: 3,
              background: "rgba(0,0,0,0.1)",
              borderRadius: 2,
              opacity: item.done ? 0.4 : 1,
            }}
          />
        </div>
      ))}
    </div>
  );
}

const DEMO_SCREENS: { id: ConceptScreen; label: string }[] = [
  { id: "login", label: "ورود" },
  { id: "home", label: "خانه" },
  { id: "timer", label: "تایمر" },
  { id: "plan", label: "برنامه" },
];

export default function ConceptGallery({ onEnterApp, onBack }: ConceptGalleryProps) {
  const [activeScreen, setActiveScreen] = useState<ConceptScreen>("login");

  const renderScreen = (concept: typeof CONCEPTS[0]) => {
    switch (activeScreen) {
      case "login": return <MiniLogin concept={concept} />;
      case "home": return <MiniHome concept={concept} />;
      case "timer": return <MiniTimer concept={concept} />;
      case "plan": return <MiniPlan concept={concept} />;
    }
  };

  return (
    <div
      className="bg-pattern min-h-screen"
      style={{ direction: "rtl", background: "var(--bg)", paddingBottom: 40 }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Header */}
        <div className="px-5 pt-12 pb-6">
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--fg-muted)",
              fontSize: 13,
              fontFamily: "inherit",
              marginBottom: 20,
              display: "block",
            }}
          >
            ← بازگشت
          </button>

          <div className="flex items-center gap-3 mb-3">
            <Faravahar size={40} />
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>۴ کانسپت طراحی</h1>
              <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>اپکس پلنر — فارسی باستان</p>
            </div>
          </div>

          <p style={{ color: "var(--fg-muted)", fontSize: 14, lineHeight: 1.7 }}>
            هر چهار کانسپت هویت برند فارسی باستان را با رویکردهای متفاوت در تراکم، تزئین و سطح ارائه می‌دهند.
          </p>
        </div>

        {/* Screen selector */}
        <div className="px-5 mb-6">
          <div className="flex gap-2">
            {DEMO_SCREENS.map((s) => (
              <button
                key={s.id}
                className={`chip ${activeScreen === s.id ? "chip-active" : ""}`}
                onClick={() => setActiveScreen(s.id)}
                style={{ flex: 1, textAlign: "center" }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Concept cards — 2 column grid */}
        <div className="px-5 grid grid-cols-2 gap-4 mb-8">
          {CONCEPTS.map((concept) => (
            <div key={concept.id}>
              {/* Phone frame */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "9/16",
                  borderRadius: 20,
                  overflow: "hidden",
                  border: "2px solid rgba(212,162,76,0.2)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(212,162,76,0.08)",
                  position: "relative",
                }}
              >
                {/* Phone notch */}
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    background: "rgba(0,0,0,0.2)",
                    zIndex: 10,
                  }}
                />
                <div style={{ position: "absolute", inset: 0 }}>
                  {renderScreen(concept)}
                </div>
              </div>

              {/* Concept info */}
              <div style={{ marginTop: 10 }}>
                <div
                  className="text-gold"
                  style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}
                >
                  {concept.nameFA}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  {concept.description}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {concept.glass && (
                    <span style={{ fontSize: 9, background: "rgba(212,162,76,0.12)", color: "var(--gold)", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
                      گلاس
                    </span>
                  )}
                  {concept.ornament && (
                    <span style={{ fontSize: 9, background: "rgba(212,162,76,0.12)", color: "var(--gold)", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
                      تزئین
                    </span>
                  )}
                  {concept.id === 4 && (
                    <span style={{ fontSize: 9, background: "rgba(212,162,76,0.12)", color: "var(--gold)", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
                      سینمایی
                    </span>
                  )}
                  {concept.id === 1 && (
                    <span style={{ fontSize: 9, background: "rgba(212,162,76,0.12)", color: "var(--gold)", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
                      مینیمال
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Persian Glass highlight + CTA */}
        <div className="px-5 mb-8">
          <div
            style={{
              background: "linear-gradient(135deg, rgba(212,162,76,0.08), rgba(212,162,76,0.03))",
              border: "1px solid rgba(212,162,76,0.25)",
              borderRadius: 16,
              padding: "20px 20px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -20,
                left: -20,
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(232,184,92,0.12), transparent 70%)",
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div className="flex items-center gap-2 mb-3">
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--gold)",
                    background: "rgba(212,162,76,0.12)",
                    borderRadius: 6,
                    padding: "2px 8px",
                  }}
                >
                  ✦ کانسپت برگزیده
                </span>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>پرشین گلاس</h3>
              <p style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.7, marginBottom: 16 }}>
                بهترین تعادل میان هویت فارسی باستان، عمق بصری شیشه‌ای، و خوانایی اپلیکیشن‌های موبایل — این کانسپت در تمام صفحات اجرا شده است.
              </p>
              <button
                className="btn-primary w-full"
                style={{ fontSize: 15 }}
                onClick={onEnterApp}
              >
                ورود به نسخه کامل اپلیکیشن ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
