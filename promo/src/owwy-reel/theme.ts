import type { Chapter } from "../showreel/theme";

/**
 * Fifteen seconds of Owwy.
 *
 * The palette is the product's own, lifted from app/globals.css — nothing here
 * is invented, and every screen the film shows is a real capture of the built
 * app rather than a mockup.
 */
export const FPS = 60;
export const BEAT = 28; // ≈128bpm; every cut lands on one
export const DURATION = 900; // 15.00s

export const O = {
  bg: "#0b1310",
  bgDeep: "#060d0a",
  surface: "#15201b",
  surface2: "#1c2923",
  ink: "#eef2ef",
  ink2: "#a9b6b2",
  ink3: "#75837f",
  brand: "#6cc7b3",
  brandDeep: "#14463f",
  brandSoft: "#173430",
  accent: "#f2b458",
  positive: "#55c790",
} as const;

/** The product's own words. */
export const COPY = {
  name: "owwy",
  tagline: "Know your money. Own your tomorrow.",
  promise: "Private · Offline · No ads",
} as const;

/** Lays a list of [label, beats] out on the beat grid. */
const layOut = (plan: [string, number][]): Chapter[] =>
  plan.reduce<Chapter[]>((all, [label, beats], i) => {
    const previous = all[all.length - 1];
    const start = previous ? previous.start + previous.length : 0;
    return [...all, { n: String(i + 1).padStart(2, "0"), label, start, length: beats * BEAT }];
  }, []);

export const CHAPTERS: Chapter[] = layOut([
  ["SEED", 3],
  ["THE GROVE", 5],
  ["ASK OWWY", 4],
  ["SAFE TO SPEND", 4],
  ["SCAN", 4],
  ["EVERYTHING", 4],
  ["PRIVATE", 3],
  ["OWWY", 5],
]);

// 32 beats is 896 frames; the last chapter carries the remainder up to 900.
CHAPTERS[CHAPTERS.length - 1].length += DURATION - CHAPTERS.reduce((n, c) => n + c.length, 0);

export const CUTS = CHAPTERS.slice(1).map((c) => c.start);

/* ─────────────────────────────────────────────────────────── the long cut ── */

/**
 * Sixty seconds: 128 beats, laid out in four movements — the hook, the product,
 * the argument, the sign-off. The last chapter carries 16 extra frames so the
 * film lands on a round 3600 while every cut before it still falls on a beat.
 */
export const FILM_CHAPTERS: Chapter[] = layOut([
  ["SEED", 4],
  ["THE QUESTION", 6],
  ["THE GROVE", 11],
  ["TYPE IT, DONE", 8],
  ["ASK OWWY", 9],
  ["SAFE TO SPEND", 9],
  ["SCAN A RECEIPT", 11],
  ["SHOPPING", 7],
  ["WALLET", 7],
  ["STATS", 8],
  ["BUDGETS & GOALS", 7],
  ["OWED & PLANS", 6],
  ["EVERYTHING", 10],
  ["PRIVATE", 8],
  ["OFFLINE", 6],
  ["OWWY", 11],
]);

const FILM_BEATS = FILM_CHAPTERS.reduce((n, c) => n + c.length, 0); // 3584
export const FILM_HOLD = 16;
export const FILM_DURATION = FILM_BEATS + FILM_HOLD; // 3600 = 60.00s

// The final chapter absorbs the hold, so the end card settles instead of cutting.
FILM_CHAPTERS[FILM_CHAPTERS.length - 1].length += FILM_HOLD;

export const FILM_CUTS = FILM_CHAPTERS.slice(1).map((c) => c.start);

/** Transition colours drawn from the brand, so even the wipes are on-palette. */
export const SWEEP_PALETTE = [O.brand, O.bgDeep, O.accent, O.brandDeep, O.ink, O.brand, O.bgDeep];
