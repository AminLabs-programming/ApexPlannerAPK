interface FaravaharProps {
  size?: number;
  className?: string;
  mono?: boolean;
  style?: React.CSSProperties;
  /** یه حرکت نرم و پیوسته (تنفس/درخشش بال + پالس دیسک مرکزی) — برای هدر */
  animated?: boolean;
}

export default function Faravahar({ size = 80, className = "", mono = false, style, animated = false }: FaravaharProps) {
  const uid = `fg-${size}`;
  return (
    <svg
      viewBox="0 0 120 95"
      width={size}
      height={size * (95 / 120)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className}${animated ? " faravahar-breathe" : ""}`}
      style={style}
    >
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          {animated ? (
            <>
              <stop offset="0%" stopColor="#F0C060">
                <animate attributeName="stop-color" values="#F0C060;#E8B85C;#F0C060" dur="3.2s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#C49040" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#E8B85C" />
              <stop offset="100%" stopColor="#C49040" />
            </>
          )}
        </linearGradient>
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* ── Left wing fill layers ── */}
      <path
        d="M55 44 C48 37 30 27 4 22 L8 28 C32 32 49 42 55 48Z"
        fill={mono ? "currentColor" : `url(#${uid})`}
        opacity="0.14"
      />
      <path
        d="M55 48 C50 42 34 34 10 30 L14 36 C36 38 51 46 55 52Z"
        fill={mono ? "currentColor" : `url(#${uid})`}
        opacity="0.11"
      />
      <path
        d="M55 52 C51 47 38 41 18 38 L22 44 C38 44 52 50 55 55Z"
        fill={mono ? "currentColor" : `url(#${uid})`}
        opacity="0.08"
      />

      {/* ── Left wing strokes ── */}
      <path
        d="M55 44 C48 37 30 26 4 22"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M55 48 C50 42 34 33 10 30"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.82"
      />
      <path
        d="M55 52 C51 47 38 40 18 37"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1.0"
        strokeLinecap="round"
        opacity="0.65"
      />
      <path
        d="M55 55 C52 51 42 46 28 44"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.48"
      />

      {/* ── Right wing fill layers ── */}
      <path
        d="M65 44 C72 37 90 27 116 22 L112 28 C88 32 71 42 65 48Z"
        fill={mono ? "currentColor" : `url(#${uid})`}
        opacity="0.14"
      />
      <path
        d="M65 48 C70 42 86 34 110 30 L106 36 C84 38 69 46 65 52Z"
        fill={mono ? "currentColor" : `url(#${uid})`}
        opacity="0.11"
      />
      <path
        d="M65 52 C69 47 82 41 102 38 L98 44 C82 44 68 50 65 55Z"
        fill={mono ? "currentColor" : `url(#${uid})`}
        opacity="0.08"
      />

      {/* ── Right wing strokes ── */}
      <path
        d="M65 44 C72 37 90 26 116 22"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M65 48 C70 42 86 33 110 30"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.82"
      />
      <path
        d="M65 52 C69 47 82 40 102 37"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1.0"
        strokeLinecap="round"
        opacity="0.65"
      />
      <path
        d="M65 55 C68 51 78 46 92 44"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.48"
      />

      {/* ── Wing tip rings ── */}
      <circle
        cx="4"
        cy="22"
        r="3"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="0.9"
        fill="none"
      />
      <circle
        cx="116"
        cy="22"
        r="3"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="0.9"
        fill="none"
      />

      {/* ── Central outer disc ── */}
      <circle
        cx="60"
        cy="53"
        r="13"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1.5"
        fill="none"
      />
      {/* Inner ring */}
      <circle
        cx="60"
        cy="53"
        r="8.5"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1"
        fill="none"
        opacity="0.7"
      />

      {/* ── Human head ── */}
      <circle
        cx="60"
        cy="38"
        r="4.5"
        fill={mono ? "currentColor" : `url(#${uid})`}
        opacity="0.9"
      >
        {animated && (
          <animate attributeName="r" values="4.5;5.1;4.5" dur="2.6s" repeatCount="indefinite" />
        )}
      </circle>

      {/* ── Shoulders / outstretched arms ── */}
      <path
        d="M49 44 Q60 40 71 44"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1.3"
        fill="none"
        opacity="0.85"
      />
      {/* Left hand ring */}
      <circle
        cx="49"
        cy="44"
        r="1.8"
        fill={mono ? "currentColor" : `url(#${uid})`}
        opacity="0.7"
      />
      {/* Right hand ring */}
      <circle
        cx="71"
        cy="44"
        r="1.8"
        fill={mono ? "currentColor" : `url(#${uid})`}
        opacity="0.7"
      />

      {/* ── Tail streamers ── */}
      <path
        d="M52 66 L49 82"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M60 67 L60 84"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M68 66 L71 82"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* Tail horizontal crossbars */}
      <path
        d="M50 73 H70"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="0.7"
        opacity="0.45"
      />
      <path
        d="M50 79 H70"
        stroke={mono ? "currentColor" : `url(#${uid})`}
        strokeWidth="0.7"
        opacity="0.28"
      />
    </svg>
  );
}
