import type { OwwyMood } from "@/lib/finance/owwy-voice";
import { cn } from "@/lib/utils/cn";

export type { OwwyMood };

interface OwwyMascotProps {
  mood?: OwwyMood;
  size?: number;
  /** Idle blink / bob. Automatically disabled with prefers-reduced-motion. */
  animated?: boolean;
  className?: string;
  /** When omitted the mascot is decorative and hidden from screen readers. */
  label?: string;
}

const MOOD_LABELS: Record<OwwyMood, string> = {
  happy: "happy",
  thinking: "thinking",
  celebrating: "celebrating",
  concerned: "concerned",
  sleeping: "sleeping",
  encouraging: "encouraging",
  neutral: "calm",
};

/**
 * Owwy — a friendly, modern owl. Geometric and warm rather than cartoonish:
 * evergreen plumage, parchment face, amber eyes. Seven expressions share one
 * silhouette so the character stays recognizable at any size.
 */
export function OwwyMascot({ mood = "neutral", size = 72, animated = false, className, label }: OwwyMascotProps) {
  const wingsUp = mood === "celebrating";
  const waving = mood === "encouraging";

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn("shrink-0 overflow-visible", animated && mood === "celebrating" && "animate-owwy-bob", animated && mood === "sleeping" && "animate-owwy-float", className)}
      role={label ? "img" : undefined}
      aria-label={label ? `${label} (Owwy is ${MOOD_LABELS[mood]})` : undefined}
      aria-hidden={label ? undefined : true}
      style={
        {
          "--o-body": "var(--owwy-body, #1f5a50)",
          "--o-body-dark": "var(--owwy-body-dark, #163f39)",
          "--o-face": "#f6ecd9",
          "--o-belly": "#efe0c3",
          "--o-line": "#d6bd92",
          "--o-eye": "#fffaf0",
          "--o-iris": "#e39a35",
          "--o-pupil": "#1c1611",
          "--o-beak": "#d4822a",
        } as React.CSSProperties
      }
    >
      {/* soft ground shadow */}
      <ellipse cx="60" cy="114" rx="26" ry="3.5" fill="currentColor" opacity="0.08" />

      {/* wings (behind body) */}
      {wingsUp ? (
        <g fill="var(--o-body-dark)">
          <path d="M30 62 C18 52 10 38 14 24 C24 34 34 46 38 58 Z" />
          <path d="M90 62 C102 52 110 38 106 24 C96 34 86 46 82 58 Z" />
        </g>
      ) : (
        <g fill="var(--o-body-dark)">
          <path d="M27 60 C17 74 18 92 30 104 C33 90 34 74 34 62 Z" />
          {waving ? (
            <path d="M88 60 C100 52 108 40 106 28 C96 36 88 46 84 58 Z" />
          ) : (
            <path d="M93 60 C103 74 102 92 90 104 C87 90 86 74 86 62 Z" />
          )}
        </g>
      )}

      {/* ear tufts */}
      <g fill="var(--o-body)" stroke="var(--o-body)" strokeWidth="3" strokeLinejoin="round">
        <path d="M34 34 L27 13 L48 25 Z" />
        <path d="M86 34 L93 13 L72 25 Z" />
      </g>

      {/* body */}
      <path d="M60 19 C85 19 99 38 99 64 C99 91 83 109 60 109 C37 109 21 91 21 64 C21 38 35 19 60 19 Z" fill="var(--o-body)" />

      {/* belly with feather scallops */}
      <path d="M60 67 C75 67 83 77 83 88 C83 100 73 106 60 106 C47 106 37 100 37 88 C37 77 45 67 60 67 Z" fill="var(--o-belly)" />
      <g fill="none" stroke="var(--o-line)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M49 82 q3.5 3.5 7 0 M57.5 82 q3.5 3.5 7 0 M66 82 q3.5 3.5 7 0" />
        <path d="M53 91 q3.5 3.5 7 0 M61.5 91 q3.5 3.5 7 0" />
      </g>

      {/* facial disc */}
      <g fill="var(--o-face)">
        <circle cx="44.5" cy="53" r="17.5" />
        <circle cx="75.5" cy="53" r="17.5" />
      </g>

      <Eyes mood={mood} animated={animated} />

      {/* beak */}
      <path d="M60 59.5 C64.5 61.5 66 65 60 72.5 C54 65 55.5 61.5 60 59.5 Z" fill="var(--o-beak)" />

      {/* cheeks */}
      {(mood === "happy" || mood === "celebrating" || mood === "encouraging") && (
        <g fill="#f0967a" opacity="0.45">
          <ellipse cx="33" cy="64" rx="4.2" ry="2.6" />
          <ellipse cx="87" cy="64" rx="4.2" ry="2.6" />
        </g>
      )}

      {/* feet */}
      <g fill="none" stroke="var(--o-iris)" strokeWidth="3" strokeLinecap="round">
        <path d="M49 108 v3 M53 108 v3.5 M57 108 v3" />
        <path d="M63 108 v3 M67 108 v3.5 M71 108 v3" />
      </g>

      {mood === "celebrating" && (
        <g>
          <path d="M16 14 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" fill="#e39a35" />
          <path d="M103 8 l1.4 3.4 l3.4 1.4 l-3.4 1.4 l-1.4 3.4 l-1.4 -3.4 l-3.4 -1.4 l3.4 -1.4 Z" fill="#6cc7b3" />
          <circle cx="110" cy="34" r="2.2" fill="#f0967a" />
          <circle cx="8" cy="40" r="1.8" fill="#6cc7b3" />
        </g>
      )}

      {mood === "sleeping" && (
        <g fill="currentColor" fontFamily="inherit" fontWeight="700" opacity="0.55">
          <text x="92" y="22" fontSize="13" className={animated ? "owwy-z" : undefined}>z</text>
          <text x="102" y="10" fontSize="9" className={animated ? "owwy-z" : undefined} style={{ animationDelay: "1.2s" }}>
            z
          </text>
        </g>
      )}
    </svg>
  );
}

function Eyes({ mood, animated }: { mood: OwwyMood; animated: boolean }) {
  const closedStroke = { fill: "none", stroke: "var(--o-pupil)", strokeWidth: 3.2, strokeLinecap: "round" as const };

  if (mood === "sleeping") {
    return (
      <g {...closedStroke}>
        <path d="M36 54 q8.5 6 17 0" />
        <path d="M67 54 q8.5 6 17 0" />
      </g>
    );
  }
  if (mood === "celebrating") {
    return (
      <g {...closedStroke}>
        <path d="M36 56 q8.5 -9 17 0" />
        <path d="M67 56 q8.5 -9 17 0" />
      </g>
    );
  }

  const look = mood === "thinking" ? { x: 2.6, y: -3 } : mood === "concerned" ? { x: 0, y: 2 } : { x: 0, y: 0.5 };

  const openEye = (cx: number, key: string) => (
    <g key={key} className={animated ? "owwy-eye" : undefined}>
      <circle cx={cx} cy="53" r="11.5" fill="var(--o-eye)" />
      <circle cx={cx + look.x * 0.6} cy={53 + look.y * 0.6} r="8" fill="var(--o-iris)" />
      <circle cx={cx + look.x} cy={53 + look.y} r="4.6" fill="var(--o-pupil)" />
      <circle cx={cx + look.x - 1.8} cy={53 + look.y - 2} r="1.7" fill="#fff" />
    </g>
  );

  return (
    <g>
      {openEye(44.5, "l")}
      {mood === "encouraging" ? (
        <path d="M67 55 q8.5 -8 17 0" {...closedStroke} />
      ) : (
        openEye(75.5, "r")
      )}

      {/* happy squint: lower lids */}
      {mood === "happy" && (
        <g fill="var(--o-face)">
          <path d="M31 58 Q44.5 52 58 58 L58 66 L31 66 Z" />
          <path d="M62 58 Q75.5 52 89 58 L89 66 L62 66 Z" />
        </g>
      )}

      {mood === "thinking" && (
        <g fill="none" stroke="var(--o-body-dark)" strokeWidth="3" strokeLinecap="round">
          <path d="M66 36 q9 -6 18 -1" />
        </g>
      )}
      {mood === "concerned" && (
        <g fill="none" stroke="var(--o-body-dark)" strokeWidth="3" strokeLinecap="round">
          <path d="M34 40 L53 36" />
          <path d="M86 40 L67 36" />
        </g>
      )}
    </g>
  );
}

/** Compact owl mark for cards, headers and the app icon. */
export function OwwyMark({ size = 20, className, tone = "brand" }: { size?: number; className?: string; tone?: "brand" | "light" | "dark" }) {
  const palette = {
    brand: { body: "var(--owwy-body, #1f5a50)", eye: "#f6ecd9", pupil: "#1c1611", beak: "#e39a35" },
    light: { body: "rgba(255,255,255,0.9)", eye: "rgba(0,0,0,0.28)", pupil: "rgba(255,255,255,0.95)", beak: "rgba(0,0,0,0.28)" },
    dark: { body: "#15211f", eye: "#f6ecd9", pupil: "#15211f", beak: "#e39a35" },
  }[tone];
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <path d="M8.5 9 L6.5 2.5 L13 6.2 Z M23.5 9 L25.5 2.5 L19 6.2 Z" fill={palette.body} stroke={palette.body} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 4.5 C23 4.5 27 9.5 27 16.5 C27 24 22.5 29 16 29 C9.5 29 5 24 5 16.5 C5 9.5 9 4.5 16 4.5 Z" fill={palette.body} />
      <circle cx="11.7" cy="14.8" r="4.3" fill={palette.eye} />
      <circle cx="20.3" cy="14.8" r="4.3" fill={palette.eye} />
      <circle cx="11.7" cy="15" r="1.9" fill={palette.pupil} />
      <circle cx="20.3" cy="15" r="1.9" fill={palette.pupil} />
      <path d="M16 17.6 L14.5 19.9 L16 22.4 L17.5 19.9 Z" fill={palette.beak} />
    </svg>
  );
}
