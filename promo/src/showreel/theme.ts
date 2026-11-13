import { Easing, interpolate } from "remotion";

/**
 * A 15-second motion design reel.
 *
 * Everything is cut to a 28-frame beat (≈128bpm at 60fps), so entrances,
 * transitions and exits land together instead of merely near each other.
 * That grid is the reason the piece feels deliberate rather than busy.
 */
export const FPS = 60;
export const BEAT = 28;
export const DURATION = 900; // 15.00s

/** Warm and editorial on purpose: neon-on-black is the default everyone reaches for. */
export const C = {
  ink: "#0B0B0D",
  ink2: "#16161B",
  paper: "#F5F1E8",
  paper2: "#D8D1C2",
  clay: "#D97757",
  amber: "#F2B33D",
  cyan: "#5BC8D9",
  plum: "#2A1B2E",
} as const;

/**
 * Real curves. `outExpo` for anything arriving (fast in, long settle),
 * `inQuart` for anything leaving (reluctant, then gone), `inOutQuint` for
 * whole-frame moves that should feel heavy.
 */
export const E = {
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  outQuart: Easing.bezier(0.25, 1, 0.5, 1),
  outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
  inQuart: Easing.bezier(0.5, 0, 0.75, 0),
  inOutQuint: Easing.bezier(0.83, 0, 0.17, 1),
  inOutCubic: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

export interface Chapter {
  n: string;
  /** Named for the principle it demonstrates — a reel should show its thinking. */
  label: string;
  start: number;
  length: number;
}

const plan: [string, number][] = [
  ["ANTICIPATION", 84],
  ["KINETIC TYPE", 140],
  ["SHAPE MORPH", 112],
  ["SYSTEMS", 112],
  ["LINE WORK", 112],
  ["DEPTH", 112],
  ["DISRUPTION", 84],
  ["RESOLVE", 144],
];

export const CHAPTERS: Chapter[] = plan.reduce<Chapter[]>((all, [label, length], i) => {
  const start = all.length ? all[all.length - 1].start + all[all.length - 1].length : 0;
  return [...all, { n: String(i + 1).padStart(2, "0"), label, start, length }];
}, []);

/** Frames where one chapter becomes the next — every transition lands on one. */
export const CUTS = CHAPTERS.slice(1).map((c) => c.start);

/** interpolate() with clamping and an easing curve, which is the only way it's ever wanted. */
export const ramp = (
  frame: number,
  range: readonly [number, number],
  out: readonly [number, number],
  easing = E.outExpo,
): number =>
  interpolate(frame, range as [number, number], out as [number, number], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** 0→1 across a window, for driving anything else. */
export const phase = (frame: number, from: number, to: number, easing = E.outExpo): number =>
  ramp(frame, [from, to], [0, 1], easing);

export const SANS = "'Jakarta', 'Segoe UI', system-ui, sans-serif";
export const SERIF = "'Fraunces', Georgia, serif";
export const MONO = "'Consolas', 'SF Mono', monospace";
