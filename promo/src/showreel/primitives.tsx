import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C, type Chapter, E, MONO, ramp, SANS } from "./theme";

/* ------------------------------------------------------------------ shapes */

/**
 * One parameterisation for every shape in the reel: twelve radii around a
 * circle plus a smoothing weight. A circle is twelve equal radii fully
 * smoothed; a triangle is the same twelve radii following a polygon falloff
 * with the smoothing off. Because both are the same twelve numbers, any shape
 * morphs into any other by interpolating them — no path libraries, no
 * mismatched node counts.
 */
export const SAMPLES = 12;

const ngon = (angle: number, sides: number): number => {
  const seg = (Math.PI * 2) / sides;
  const t = ((angle % seg) + seg) % seg;
  return Math.cos(Math.PI / sides) / Math.cos(t - Math.PI / sides);
};

export type ShapeName = "circle" | "square" | "triangle" | "star" | "blob";

interface ShapeSpec {
  radius: (angle: number, index: number) => number;
  smooth: number;
  scale: number;
}

const SHAPES: Record<ShapeName, ShapeSpec> = {
  circle: { radius: () => 1, smooth: 1, scale: 1 },
  square: { radius: (a) => ngon(a, 4), smooth: 0.06, scale: 0.78 },
  triangle: { radius: (a) => ngon(a, 3), smooth: 0.06, scale: 0.74 },
  star: { radius: (_a, i) => (i % 2 === 0 ? 1 : 0.44), smooth: 0.08, scale: 1.06 },
  blob: { radius: (a) => 1 + 0.17 * Math.sin(3 * a + 0.6) + 0.07 * Math.sin(5 * a), smooth: 1, scale: 0.94 },
};

/** The twelve radii of a shape, already scaled to sit optically the same size. */
export const radiiOf = (name: ShapeName): number[] => {
  const spec = SHAPES[name];
  return Array.from({ length: SAMPLES }, (_, i) => spec.radius((i / SAMPLES) * Math.PI * 2, i) * spec.scale);
};

/** A closed Catmull-Rom path; `smooth` 0 gives straight edges, 1 gives curves. */
export const pathFromRadii = (radii: number[], smooth: number, size: number, spin = 0): string => {
  const n = radii.length;
  const points = radii.map((r, i) => {
    const a = (i / n) * Math.PI * 2 + spin;
    return [Math.cos(a) * r * size, Math.sin(a) * r * size] as const;
  });
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * smooth;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * smooth;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * smooth;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * smooth;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d} Z`;
};

/** Blend two shapes; `t` 0→1 walks one into the other. */
export const morphPath = (from: ShapeName, to: ShapeName, t: number, size: number, spin = 0): string => {
  const a = radiiOf(from);
  const b = radiiOf(to);
  const radii = a.map((r, i) => r + (b[i] - r) * t);
  const smooth = SHAPES[from].smooth + (SHAPES[to].smooth - SHAPES[from].smooth) * t;
  return pathFromRadii(radii, smooth, size, spin);
};

/* ------------------------------------------------------------------ texture */

/**
 * Film grain, rendered small and scaled up so the grain is chunky rather than
 * digital, and re-seeded every other frame so it flickers at 30 rather than 60.
 */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.16 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const seed = Math.floor(frame / 2);
  // The noise field follows the frame's aspect, so the grain stays round
  // instead of being stretched into streaks in the 9:16 cut.
  const w = Math.round(width / 4);
  const h = Math.round(height / 4);
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <filter id={`grain-${seed}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={w} height={h} filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/**
 * Kept deliberately light. Anything heavier reads as a smudged lens on the
 * bone-coloured chapters instead of as depth.
 */
export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.3 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(135% 105% at 50% 45%, transparent 55%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/* -------------------------------------------------------------- transitions */

/**
 * Every cut is covered. Two skewed panels cross the frame a few frames apart,
 * fully covering the screen exactly on the cut frame, so the chapter change
 * happens behind them. Alternating direction keeps eight transitions from
 * reading as one repeated trick.
 */
const SWEEP = 26;

const Panel: React.FC<{ progress: number; color: string; toLeft: boolean }> = ({ progress, color, toLeft }) => {
  const x = interpolate(progress, [0, 1], toLeft ? [175, -175] : [-175, 175]);
  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${x}%) skewX(${toLeft ? 11 : -11}deg) scale(1.9)`,
        background: color,
        willChange: "transform",
      }}
    />
  );
};

export const Sweeps: React.FC<{ cuts: readonly number[]; palette?: readonly string[] }> = ({
  cuts,
  palette = [C.clay, C.paper, C.amber, C.ink, C.cyan, C.plum, C.clay],
}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {cuts.map((cut, i) => {
        const start = cut - SWEEP / 2;
        if (frame < start - 2 || frame > start + SWEEP + 2) return null;
        const p = ramp(frame, [start, start + SWEEP], [0, 1], E.inOutQuint);
        const trail = ramp(frame, [start + 4, start + SWEEP + 4], [0, 1], E.inOutQuint);
        const toLeft = i % 2 === 1;
        return (
          <AbsoluteFill key={cut}>
            <Panel progress={trail} color={C.ink} toLeft={toLeft} />
            <Panel progress={p} color={palette[i % palette.length]} toLeft={toLeft} />
          </AbsoluteFill>
        );
      })}
    </>
  );
};

/* --------------------------------------------------------------------- HUD */

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");

/**
 * The reel's own chrome. It sits in `difference` blend, so it reads as white on
 * the dark chapters and as dark on the bone-coloured ones without a single
 * conditional.
 */
export const Hud: React.FC<{ chapters: readonly Chapter[]; duration: number; beat: number; title?: string; pipEvery?: number }> = ({
  chapters,
  duration,
  beat,
  title = "CLAUDE",
  // One pip per beat reads well over 32 beats; over a longer film, pass 4 to
  // show bars instead, or the row runs off the side of the frame.
  pipEvery = 1,
}) => {
  const frame = useCurrentFrame();
  const chapter = [...chapters].reverse().find((c) => frame >= c.start) ?? chapters[0];
  const sinceCut = frame - chapter.start;
  const reveal = ramp(sinceCut, [0, 16], [0, 100], E.outExpo);
  const intro = ramp(frame, [6, 34], [0, 1], E.outExpo);
  const outro = ramp(frame, [duration - 30, duration - 6], [1, 0], E.inQuart);
  const alpha = Math.min(intro, outro);

  return (
    <AbsoluteFill style={{ mixBlendMode: "difference", opacity: alpha, pointerEvents: "none" }}>
      {/* crop marks: an L at each corner, arms pointing inward */}
      {([
        [{ top: 44, left: 44 }, { top: 44, left: 44 }],
        [{ top: 44, right: 44 }, { top: 44, right: 44 }],
        [{ bottom: 44, left: 44 }, { bottom: 44, left: 44 }],
        [{ bottom: 44, right: 44 }, { bottom: 44, right: 44 }],
      ] as const).map(([h, v], i) => (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", ...h, width: 16, height: 1, background: "#fff", opacity: 0.45 }} />
          <div style={{ position: "absolute", ...v, width: 1, height: 16, background: "#fff", opacity: 0.45 }} />
        </React.Fragment>
      ))}

      <div
        style={{
          position: "absolute",
          top: 62,
          left: 76,
          fontFamily: SANS,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.34em",
          color: "#fff",
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          top: 62,
          right: 76,
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: "0.12em",
          color: "#fff",
          opacity: 0.75,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        00:00:{pad(frame / 60)}:{pad(frame % 60)}
      </div>

      <div style={{ position: "absolute", bottom: 58, left: 76, display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{chapter.n}</span>
        <span style={{ overflow: "hidden", display: "inline-block" }}>
          <span
            style={{
              display: "inline-block",
              fontFamily: SANS,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.3em",
              color: "#fff",
              opacity: 0.85,
              clipPath: `inset(0 ${100 - reveal}% 0 0)`,
            }}
          >
            {chapter.label}
          </span>
        </span>
      </div>

      {/* beat pips — one per beat, filling as the reel plays */}
      <div style={{ position: "absolute", bottom: 62, right: 76, display: "flex", gap: 5, alignItems: "flex-end" }}>
        {Array.from({ length: Math.floor(duration / (beat * pipEvery)) }, (_, i) => {
          const on = frame >= i * beat * pipEvery;
          const hit = frame - i * beat * pipEvery;
          const pop = hit >= 0 && hit < 10 ? ramp(hit, [0, 10], [1, 0]) : 0;
          return <div key={i} style={{ width: 3, height: 10 + pop * 12, background: "#fff", opacity: on ? 0.28 + pop * 0.72 : 0.1 }} />;
        })}
      </div>

      <div style={{ position: "absolute", left: 0, bottom: 0, height: 2, width: `${(frame / duration) * 100}%`, background: "#fff", opacity: 0.55 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ helpers */

/** Built from its code point rather than typed, so no encoding accident can eat it. */
const NBSP = String.fromCharCode(160);

/** Deterministic jitter, so every render of frame N is identical. */
export const jitter = (seed: string, spread: number): number => (random(seed) - 0.5) * spread;

/** Letters wrapped for per-character masking, each with its own delay. */
export const Split: React.FC<{
  text: string;
  frame: number;
  delay?: number;
  stagger?: number;
  style?: React.CSSProperties;
  from?: number;
}> = ({ text, frame, delay = 0, stagger = 4, style, from = 110 }) => (
  <span style={{ display: "flex" }}>
    {text.split("").map((ch, i) => {
      const t = ramp(frame, [delay + i * stagger, delay + i * stagger + 26], [0, 1], E.outExpo);
      return (
        <span key={`${ch}-${i}`} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.08em" }}>
          <span
            style={{
              display: "inline-block",
              transform: `translateY(${(1 - t) * from}%) rotate(${(1 - t) * -4}deg)`,
              ...style,
            }}
          >
            {ch === " " ? NBSP : ch}
          </span>
        </span>
      );
    })}
  </span>
);
