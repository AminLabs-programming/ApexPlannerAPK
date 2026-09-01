import { useEffect, useRef, useState } from "react";
import Faravahar from "../components/Faravahar";

interface SplashProps {
  onDone: () => void;
  /** وقتی false باشه، انیمیشن روی فاز ۳ (نمایش اسم) نگه داشته می‌شه و صبر
   * می‌کنه تا دیتای واقعی (کش محلی / درخواست به بکند) آماده بشه — به این
   * ترتیب اسپلش صرفاً تزئینی نیست، واقعاً بازتاب‌دهنده‌ی وضعیت بارگذاریه. */
  dataReady?: boolean;
}

export default function Splash({ onDone, dataReady = true }: SplashProps) {
  const [phase, setPhase] = useState(0);
  // 0: dark canvas
  // 1: geometric lines appear
  // 2: faravahar assembles
  // 3: name appears (و اینجا منتظر dataReady می‌مونیم)
  // 4: transition out

  const minTimeElapsed = useRef(false);
  const readyRef = useRef(dataReady);
  readyRef.current = dataReady;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1100);
    const t3 = setTimeout(() => setPhase(3), 1900);
    // حداقل زمان نمایش splash تا انیمیشن ناقص/پرشی به‌نظر نرسه
    const tMin = setTimeout(() => {
      minTimeElapsed.current = true;
      if (readyRef.current) proceed();
    }, 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(tMin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function proceed() {
    setPhase(4);
    setTimeout(() => onDone(), 500);
  }

  // به‌محض اینکه هم حداقل‌زمان گذشته باشه و هم دیتا واقعاً آماده باشه، برو جلو
  useEffect(() => {
    if (dataReady && minTimeElapsed.current && phase < 4) {
      proceed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady]);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        background: "#0D0A07",
        transition: "opacity 0.5s ease",
        opacity: phase === 4 ? 0 : 1,
        zIndex: 100,
      }}
    >
      {/* Geometric line fragments */}
      <svg
        viewBox="0 0 300 300"
        className="absolute inset-0 w-full h-full"
        style={{ opacity: phase >= 1 ? 1 : 0, transition: "opacity 0.7s ease" }}
      >
        <defs>
          <linearGradient id="splashGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8B85C" />
            <stop offset="100%" stopColor="#C49040" />
          </linearGradient>
        </defs>

        {/* Persepolis-inspired geometric fragments */}
        {/* Top stepped lines */}
        <path
          d="M60 60 h20 v-8 h20 v8 h20 v-8 h20 v8"
          stroke="url(#splashGold)" strokeWidth="0.8" fill="none"
          opacity={phase >= 1 ? 0.35 : 0}
          style={{ transition: "opacity 0.8s ease 0.1s" }}
        />
        <path
          d="M240 60 h-20 v-8 h-20 v8 h-20 v-8 h-20 v8"
          stroke="url(#splashGold)" strokeWidth="0.8" fill="none"
          opacity={phase >= 1 ? 0.35 : 0}
          style={{ transition: "opacity 0.8s ease 0.2s" }}
        />
        {/* Bottom stepped lines */}
        <path
          d="M60 240 h20 v8 h20 v-8 h20 v8 h20 v-8"
          stroke="url(#splashGold)" strokeWidth="0.8" fill="none"
          opacity={phase >= 1 ? 0.28 : 0}
          style={{ transition: "opacity 0.8s ease 0.3s" }}
        />
        <path
          d="M240 240 h-20 v8 h-20 v-8 h-20 v8 h-20 v-8"
          stroke="url(#splashGold)" strokeWidth="0.8" fill="none"
          opacity={phase >= 1 ? 0.28 : 0}
          style={{ transition: "opacity 0.8s ease 0.4s" }}
        />
        {/* Corner column stubs */}
        <path
          d="M40 100 v60 M44 100 v60 M48 100 v60"
          stroke="url(#splashGold)" strokeWidth="0.7" fill="none"
          opacity={phase >= 1 ? 0.2 : 0}
          style={{ transition: "opacity 0.8s ease 0.2s" }}
        />
        <path
          d="M260 100 v60 M256 100 v60 M252 100 v60"
          stroke="url(#splashGold)" strokeWidth="0.7" fill="none"
          opacity={phase >= 1 ? 0.2 : 0}
          style={{ transition: "opacity 0.8s ease 0.3s" }}
        />
        {/* Horizontal rules */}
        <path
          d="M40 95 h220"
          stroke="url(#splashGold)" strokeWidth="0.5" fill="none"
          opacity={phase >= 1 ? 0.15 : 0}
          style={{ transition: "opacity 0.8s ease 0.4s" }}
        />
        <path
          d="M40 165 h220"
          stroke="url(#splashGold)" strokeWidth="0.5" fill="none"
          opacity={phase >= 1 ? 0.15 : 0}
          style={{ transition: "opacity 0.8s ease 0.5s" }}
        />
      </svg>

      {/* Faravahar mark */}
      <div
        style={{
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? "scale(1)" : "scale(0.7)",
          transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
          filter: phase >= 2 ? "drop-shadow(0 0 24px rgba(212,162,76,0.5))" : "none",
        }}
      >
        <Faravahar size={120} />
      </div>

      {/* Gold disc accent pulse */}
      {phase >= 2 && (
        <div
          style={{
            position: "absolute",
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(240,192,96,0.6), transparent 70%)",
            top: "calc(50% + 10px)",
            animation: "pulse-glow 2s ease-in-out infinite",
          }}
        />
      )}

      {/* App name */}
      <div
        style={{
          marginTop: 32,
          opacity: phase >= 3 ? 1 : 0,
          transform: phase >= 3 ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.6s ease",
          textAlign: "center",
        }}
      >
        <div
          className="logo-shimmer"
          style={{ fontSize: 28, fontWeight: 800, letterSpacing: "0.02em" }}
        >
          اپکس پلنر
        </div>
        <div
          style={{
            color: "rgba(212,162,76,0.6)",
            fontSize: 13,
            fontWeight: 400,
            marginTop: 8,
            letterSpacing: "0.05em",
          }}
        >
          دستیار مطالعه کنکور
        </div>

        {/* دات‌های لودینگ ظریف تا وقتی dataReady بشه */}
        {phase === 3 && !dataReady && (
          <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 18 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "rgba(212,162,76,0.7)",
                  animation: `pulse-glow 1.2s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Skip button */}
      <button
        onClick={proceed}
        style={{
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          background: "none",
          border: "none",
          color: "rgba(212,162,76,0.5)",
          fontSize: 13,
          cursor: "pointer",
          opacity: phase >= 1 ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      >
        رد شدن
      </button>
    </div>
  );
}
