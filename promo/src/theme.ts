/**
 * Owwy's real visual identity, copied from app/globals.css (dark palette) so the
 * film and the product are the same brand. Nothing here is invented.
 */
export const theme = {
  bg: "#0b1310",
  bgElevated: "#101a16",
  surface: "#15201b",
  surface2: "#1c2923",
  ink: "#eef2ef",
  ink2: "#a9b6b2",
  ink3: "#75837f",
  brand: "#6cc7b3",
  brandInk: "#062520",
  brandDeep: "#14463f",
  brandSoft: "#173430",
  accent: "#f2b458",
  accentSoft: "#33260f",
  positive: "#55c790",
  line: "rgba(238, 242, 239, 0.12)",
  sans: '"Jakarta Promo", ui-sans-serif, system-ui, sans-serif',
  display: '"Fraunces Promo", ui-serif, Georgia, serif',
} as const;

/** The app's own words — tagline, nav labels and feature names all come from the product. */
export const copy = {
  name: "owwy",
  tagline: "Know your money. Own your tomorrow.",
  promise: "Private · Offline · No ads",
  developer: "@mjolnir_dev",
} as const;

export const FPS = 30;

/**
 * Frames a scene keeps playing, fading, after its slot ends — the next scene
 * has already started underneath, so the film dissolves instead of blinking.
 */
export const CROSSFADE = 16;

/** Scene boundaries in frames, so audio can be cut to the same marks. */
export const timeline = {
  intro: { from: 0, duration: 120 },
  alive: { from: 120, duration: 195 },
  features: { from: 315, duration: 510 },
  montage: { from: 825, duration: 180 },
  hero: { from: 1005, duration: 120 },
  available: { from: 1125, duration: 150 },
  credit: { from: 1275, duration: 75 },
} as const;

export const TOTAL_FRAMES = timeline.credit.from + timeline.credit.duration;
