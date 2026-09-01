import { useEffect, useState } from "react";

interface LoadingScreenProps {
  label?: string;
  fullscreen?: boolean;
}

/**
 * لودینگ برند-محور: همون خط‌های هندسی فروهر که به‌جای محو شدن، واقعاً
 * "کشیده" می‌شن (stroke-dasharray animation) — مثل یه دست که داره نماد رو
 * لحظه‌به‌لحظه ترسیم می‌کنه، بعد یک درخشش طلایی نرم روی مرکز دیسک پالس
 * می‌زنه. با fullscreen=false به‌عنوان لودر داخل‌صفحه‌ای هم قابل استفاده‌ست.
 */
export default function LoadingScreen({ label = "در حال بارگذاری…", fullscreen = true }: LoadingScreenProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const uid = "ld";

  return (
    <div
      className={fullscreen ? "fixed inset-0 flex flex-col items-center justify-center" : "flex flex-col items-center justify-center"}
      style={{
        background: fullscreen ? "#0D0A07" : "transparent",
        zIndex: fullscreen ? 200 : "auto",
        minHeight: fullscreen ? undefined : 220,
        gap: 20,
      }}
    >
      <div style={{ position: "relative", width: 92, height: 73 }}>
        <svg
          viewBox="0 0 120 95"
          width={92}
          height={73}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: "drop-shadow(0 0 14px rgba(212,162,76,0.35))" }}
        >
          <defs>
            <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F0C060" />
              <stop offset="100%" stopColor="#C49040" />
            </linearGradient>
          </defs>

          {/* Wings — drawn via stroke-dasharray/offset animation */}
          {[
            { d: "M55 44 C48 37 30 26 4 22", w: 1.6, delay: 0 },
            { d: "M55 48 C50 42 34 33 10 30", w: 1.3, delay: 0.08 },
            { d: "M55 52 C51 47 38 40 18 37", w: 1.0, delay: 0.16 },
            { d: "M65 44 C72 37 90 26 116 22", w: 1.6, delay: 0 },
            { d: "M65 48 C70 42 86 33 110 30", w: 1.3, delay: 0.08 },
            { d: "M65 52 C69 47 82 40 102 37", w: 1.0, delay: 0.16 },
          ].map((p, i) => (
            <path
              key={i}
              d={p.d}
              stroke={`url(#${uid})`}
              strokeWidth={p.w}
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: ready ? 0 : 1,
                transition: `stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1) ${p.delay}s`,
              }}
            />
          ))}

          {/* Central disc */}
          <circle
            cx="60" cy="53" r="13"
            stroke={`url(#${uid})`} strokeWidth="1.5" fill="none"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: ready ? 0 : 1,
              transition: "stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1) 0.3s",
            }}
          />
          <circle
            cx="60" cy="38" r="4.5"
            fill={`url(#${uid})`}
            opacity={ready ? 0.9 : 0}
            style={{ transition: "opacity 0.4s ease 0.5s" }}
          />

          {/* Tail streamers */}
          {[
            { d: "M52 66 L49 82", delay: 0.55 },
            { d: "M60 67 L60 84", delay: 0.6 },
            { d: "M68 66 L71 82", delay: 0.65 },
          ].map((p, i) => (
            <path
              key={i}
              d={p.d}
              stroke={`url(#${uid})`}
              strokeWidth="1.1"
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: ready ? 0 : 1,
                transition: `stroke-dashoffset 0.5s cubic-bezier(.4,0,.2,1) ${p.delay}s`,
              }}
            />
          ))}
        </svg>

        {/* Soft pulsing glow behind the disc */}
        <div
          style={{
            position: "absolute",
            top: "48%",
            left: "50%",
            width: 30,
            height: 30,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(240,192,96,0.55), transparent 70%)",
            animation: ready ? "pulse-glow 1.8s ease-in-out infinite" : "none",
            opacity: ready ? 1 : 0,
            transition: "opacity 0.4s ease 0.5s",
            pointerEvents: "none",
          }}
        />
      </div>

      {label && (
        <div
          style={{
            color: "rgba(212,162,76,0.75)",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.02em",
            opacity: ready ? 1 : 0,
            transform: ready ? "translateY(0)" : "translateY(6px)",
            transition: "all 0.5s ease 0.6s",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
