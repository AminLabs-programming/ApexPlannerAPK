import type { Screen } from "../lib/utils";

interface NavItem {
  id: Screen;
  label: string;
  icon: (active: boolean) => React.ReactElement;
}

const HomeIcon = (a: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <path
      d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9 21 9 15 12 15C15 15 15 21 15 21M9 21H15"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlanIcon = (a: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <rect
      x="3"
      y="4"
      width="18"
      height="18"
      rx="3"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
    />
    <path
      d="M8 9H16M8 13H13M8 17H11"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M8 2V6M16 2V6"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const TimerIcon = (a: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <circle
      cx="12"
      cy="13"
      r="8"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
    />
    <path
      d="M12 9V13L15 15"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M9.5 2.5H14.5"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M12 2.5V5"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const QuestionsIcon = (a: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <path
      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
    />
    <path
      d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15848 13.7588 7.52152 14.2151 8.06353C14.6714 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="12" cy="17" r="1" fill={a ? "url(#navGold)" : "currentColor"} />
  </svg>
);

const StatsIcon = (a: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <path
      d="M3 20H21"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M6 20V14M10 20V10M14 20V14M18 20V6"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const AnalysisIcon = (a: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
    <path
      d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 2V8H20"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 13H16M8 17H12"
      stroke={a ? "url(#navGold)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="16" cy="17" r="1.5" fill={a ? "url(#navGold)" : "currentColor"} />
  </svg>
);

import React from "react";

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "خانه", icon: HomeIcon },
  { id: "plan", label: "برنامه", icon: PlanIcon },
  { id: "timer", label: "تایمر", icon: TimerIcon },
  { id: "questions", label: "سوالات", icon: QuestionsIcon },
  { id: "stats", label: "آمار", icon: StatsIcon },
  { id: "analysis", label: "تحلیل", icon: AnalysisIcon },
];

interface BottomNavProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  glass?: boolean;
}

export default function BottomNav({ active, onNavigate, glass = false }: BottomNavProps) {
  return (
    <nav
      className={`nav-bar ${glass ? "glass" : ""} fixed bottom-0 left-0 right-0 z-40 safe-area-pb`}
      style={{ maxWidth: 520, margin: "0 auto" }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="navGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8B85C" />
            <stop offset="100%" stopColor="#C49040" />
          </linearGradient>
        </defs>
      </svg>

      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all duration-200"
              style={{
                color: isActive ? "transparent" : "var(--fg-muted)",
                minWidth: 48,
              }}
            >
              <div
                style={{
                  filter: isActive
                    ? "drop-shadow(0 0 6px rgba(212,162,76,0.5))"
                    : undefined,
                  transition: "filter 0.2s ease",
                }}
              >
                {item.icon(isActive)}
              </div>
              <span
                className="text-gold"
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? undefined : "var(--fg-muted)",
                  WebkitTextFillColor: isActive ? undefined : "var(--fg-muted)",
                  backgroundImage: isActive
                    ? "linear-gradient(135deg, #E8B85C, #C49040)"
                    : "none",
                  WebkitBackgroundClip: isActive ? "text" : undefined,
                  backgroundClip: isActive ? "text" : undefined,
                }}
              >
                {item.label}
              </span>
              {isActive && (
                <span
                  style={{
                    width: 18,
                    height: 2.5,
                    borderRadius: 2,
                    background: "linear-gradient(90deg, #E8B85C, #C49040)",
                    boxShadow: "0 0 6px rgba(212,162,76,0.6)",
                    display: "block",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
