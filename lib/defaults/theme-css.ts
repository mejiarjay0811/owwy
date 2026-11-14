import { HERO_STYLES, HERO_STYLE_THEME } from "@/lib/defaults/card-styles";
import { PALETTES, type PaletteColors } from "@/lib/defaults/palettes";

/**
 * The stylesheet for everything the user can repaint.
 *
 * Generated from the palette and finish catalogues so there is exactly one
 * place to add a colour, and shipped in the document head so a saved choice
 * is already on screen at first paint rather than arriving a frame later.
 *
 * Selectors are deliberately over-specific — `:root[data-palette=…]` beats
 * the plain `:root` in globals.css whichever order the two stylesheets end up
 * in, which a bare `[data-palette=…]` would not.
 */

const PALETTE_VARS: [keyof PaletteColors, string][] = [
  ["brand", "--brand"],
  ["brandHover", "--brand-hover"],
  ["brandInk", "--brand-ink"],
  ["brandSoft", "--brand-soft"],
  ["brandSoftInk", "--brand-soft-ink"],
  ["accent", "--accent"],
  ["accentInk", "--accent-ink"],
  ["accentSoft", "--accent-soft"],
  ["accentSoftInk", "--accent-soft-ink"],
  ["focus", "--focus"],
  ["heroBg", "--hero-bg"],
  ["owwyBody", "--owwy-body"],
  ["owwyBodyDark", "--owwy-body-dark"],
];

/**
 * Ink and translucent fills for a light balance-card finish.
 *
 * A parchment card with white-on-white chips is unreadable, so the finish
 * carries its own ink and the fills flip from "lighten" to "darken".
 */
export const LIGHT_HERO: Record<string, string> = {
  "--hero-ink": "#2b2418",
  "--hero-ink-2": "rgba(43, 36, 24, 0.7)",
  "--hero-fill": "rgba(43, 36, 24, 0.08)",
  "--hero-fill-strong": "rgba(43, 36, 24, 0.15)",
  "--hero-line": "rgba(43, 36, 24, 0.12)",
};

const decls = (pairs: [string, string][]) => pairs.map(([name, value]) => `${name}:${value}`).join(";");

export function themeCss(): string {
  const palettes = PALETTES.map((p) => {
    const light = `:root[data-palette="${p.id}"]{${decls(PALETTE_VARS.map(([k, name]) => [name, p.light[k]]))}}`;
    const dark = `:root[data-theme="dark"][data-palette="${p.id}"]{${decls(PALETTE_VARS.map(([k, name]) => [name, p.dark[k]]))}}`;
    return light + dark;
  }).join("");

  // "Match my colours" has nothing to override: the palette already set
  // --hero-bg, and :root already holds the light-on-dark ink and fills.
  const heroes = HERO_STYLES.filter((s) => s.id !== HERO_STYLE_THEME && s.background)
    .map((s) => {
      const pairs: [string, string][] = [["--hero-bg", s.background as string]];
      if (s.tone === "light") pairs.push(...(Object.entries(LIGHT_HERO) as [string, string][]));
      return `:root[data-hero="${s.id}"],:root[data-theme="dark"][data-hero="${s.id}"]{${decls(pairs)}}`;
    })
    .join("");

  return palettes + heroes;
}
