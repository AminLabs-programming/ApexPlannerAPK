import { useEffect, useRef, useState } from "react";
import Faravahar from "./Faravahar";
import type { Screen } from "../lib/utils";

interface TopBarProps {
  onProfile: () => void;
  glass?: boolean;
  hasPendingSync?: boolean;
  hasAlarms?: boolean;
  onNavigate?: (s: Screen) => void;
}

/**
 * هدر داینامیک: با اسکرول به پایین، از حالت تمام‌عرض/گوشه‌تیز به یک کپسول
 * شناور با فاصله از لبه‌ها، گردتر، کوچیک‌تر و با سایه‌ی قوی‌تر تبدیل می‌شه —
 * همون رفتار اپ‌های موبایل امروزی (مثل هدر شناور iOS/Material 3).
 */
export default function TopBar({
  onProfile,
  glass = false,
  hasPendingSync = false,
  hasAlarms = true,
  onNavigate,
}: TopBarProps) {
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const THRESHOLD = 28;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > THRESHOLD);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-40 flex justify-center"
      style={{
        paddingTop: scrolled ? 10 : 0,
        transition: "padding-top 0.35s cubic-bezier(.22,1,.36,1)",
        pointerEvents: "none",
      }}
    >
      <header
        className={`top-bar ${glass ? "glass" : ""} flex items-center justify-between px-4`}
        style={{
          width: "100%",
          maxWidth: scrolled ? 480 : 520,
          margin: "0 auto",
          height: scrolled ? 50 : 56,
          borderRadius: scrolled ? 22 : 0,
          boxShadow: scrolled
            ? "0 10px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(212,162,76,0.10)"
            : "none",
          borderBottom: scrolled ? "1px solid var(--card-border)" : undefined,
          transform: scrolled ? "translateY(0) scale(1)" : "translateY(0) scale(1)",
          transition:
            "max-width 0.35s cubic-bezier(.22,1,.36,1), height 0.35s cubic-bezier(.22,1,.36,1), border-radius 0.35s cubic-bezier(.22,1,.36,1), box-shadow 0.35s ease, margin-top 0.35s ease",
          pointerEvents: "auto",
        }}
      >
      {/* Right: logo / brand */}
      <button
        className="flex items-center gap-2"
        onClick={() => onNavigate?.("home")}
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <Faravahar
          size={scrolled ? 26 : 32}
          animated
          style={{ transition: "width 0.35s ease, height 0.35s ease" }}
        />
        <span
          className="logo-shimmer font-bold"
          style={{
            fontSize: scrolled ? 14 : 16,
            letterSpacing: "0.01em",
            transition: "font-size 0.35s ease",
          }}
        >
          اپکس پلنر
        </span>
      </button>

      {/* Left: action icons */}
      <div className="flex items-center gap-3">
        {/* Sync status */}
        <button
          style={{ background: "none", border: "none", cursor: "pointer", position: "relative", color: "var(--fg-muted)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
            <path
              d="M1 4V10H7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M23 20V14H17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20.49 9C19.9828 7.56678 19.1209 6.28392 17.9845 5.27542C16.8482 4.26692 15.4745 3.56614 13.9917 3.24013C12.5089 2.91413 10.9652 2.97371 9.51266 3.41339C8.06007 3.85306 6.74722 4.65772 5.69997 5.74L1 10M23 14L18.3 18.26C17.2528 19.3423 15.9399 20.1469 14.4873 20.5866C13.0347 21.0263 11.4911 21.0859 10.0083 20.7599C8.52547 20.4339 7.15183 19.7331 6.01547 18.7246C4.87911 17.7161 4.01717 16.4332 3.51 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {hasPendingSync && (
            <span
              className="status-dot"
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #E8B85C, #C49040)",
                border: "1.5px solid var(--bg)",
              }}
            />
          )}
        </button>

        {/* Alarm bell */}
        <button
          style={{ background: "none", border: "none", cursor: "pointer", position: "relative", color: "var(--fg-muted)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
            <path
              d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {hasAlarms && (
            <span
              className="status-dot"
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#E8B85C",
                border: "1.5px solid var(--bg)",
              }}
            />
          )}
        </button>

        {/* Profile avatar */}
        <button
          onClick={onProfile}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #E8B85C, #C49040)",
            boxShadow: "var(--shadow-gold-sm)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1C1510",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          م
        </button>
      </div>
      </header>
    </div>
  );
}
