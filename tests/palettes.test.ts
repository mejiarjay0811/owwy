import { describe, expect, it } from "vitest";
import { HERO_STYLES, HERO_STYLE_THEME, getHeroStyle } from "@/lib/defaults/card-styles";
import { DEFAULT_PALETTE_ID, getPalette, PALETTES, paletteSwatches, type PaletteColors } from "@/lib/defaults/palettes";
import { themeCss } from "@/lib/defaults/theme-css";

/**
 * A theme picker is only a feature if every option is still readable.
 *
 * The browser contrast pass (scripts/contrast.mjs) measures what actually
 * rendered, but it can only visit a palette at a time. These checks are the
 * cheap half: they run on the palette data itself, so a new colour cannot be
 * added without its labels clearing WCAG AA first.
 *
 * The balance-card gradients are deliberately not checked here — a gradient
 * has no single colour to compare against, so claiming a ratio for one would
 * be confident nonsense. They are measured in the browser instead.
 */

const hex = (value: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) throw new Error(`not a plain hex colour: ${value}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const luminance = (color: string) => {
  const { r, g, b } = hex(color);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** The page surfaces a palette has to sit on. They are not repainted. */
const SURFACES = {
  light: { bg: "#f6f3ec", surface: "#ffffff" },
  dark: { bg: "#0b1310", surface: "#15201b" },
};

/** [label, foreground, background, minimum] */
const pairs = (c: PaletteColors, surfaces: { bg: string; surface: string }): [string, string, string, number][] => [
  ["brand text on the page", c.brand, surfaces.bg, 4.5],
  ["brand text on a card", c.brand, surfaces.surface, 4.5],
  ["a primary button's label", c.brandInk, c.brand, 4.5],
  ["a soft brand chip's label", c.brandSoftInk, c.brandSoft, 4.5],
  ["an accent button's label", c.accentInk, c.accent, 4.5],
  ["a soft accent chip's label", c.accentSoftInk, c.accentSoft, 4.5],
];

/**
 * The focus ring is two-tone on purpose.
 *
 * A warm accent on warm paper measures about 2:1, so no palette whose accent
 * is amber, coral or gold could carry a focus indicator on its own. The ring
 * pairs the accent with an ink-coloured halo, and the halo is what clears
 * WCAG 1.4.11's 3:1 — which makes it a property of the theme, not of the
 * palette, and it is checked once rather than seven times.
 */
const FOCUS_HALO = { light: "#0e1816", dark: "#ecf2ef" };

describe("every palette stays readable", () => {
  for (const palette of PALETTES) {
    for (const theme of ["light", "dark"] as const) {
      it(`${palette.name} in ${theme}`, () => {
        for (const [what, fg, bg, need] of pairs(palette[theme], SURFACES[theme])) {
          const ratio = contrast(fg, bg);
          expect(ratio, `${palette.name} ${theme}: ${what} is ${ratio.toFixed(2)}:1 (${fg} on ${bg}), needs ${need}`).toBeGreaterThanOrEqual(need);
        }
      });
    }
  }
});

describe("the focus ring", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`has an edge that stands out from the ${theme} page`, () => {
      for (const surface of Object.values(SURFACES[theme])) {
        expect(contrast(FOCUS_HALO[theme], surface)).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

describe("the palette catalogue", () => {
  it("keeps Owwy's own colours as the default", () => {
    expect(PALETTES[0].id).toBe(DEFAULT_PALETTE_ID);
    expect(PALETTES[0].light.brand).toBe("#14463f");
    expect(PALETTES[0].light.accent).toBe("#e39a35");
  });

  it("has unique ids and names", () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    expect(new Set(PALETTES.map((p) => p.name)).size).toBe(PALETTES.length);
  });

  it("falls back to the default rather than throwing on something unknown", () => {
    expect(getPalette("a-palette-from-a-newer-version").id).toBe(DEFAULT_PALETTE_ID);
    expect(getPalette(undefined).id).toBe(DEFAULT_PALETTE_ID);
  });

  it("shows the swatches for the theme that's actually on screen", () => {
    const berry = getPalette("berry");
    expect(paletteSwatches(berry, false)).toEqual([berry.light.brand, berry.light.accent]);
    expect(paletteSwatches(berry, true)).toEqual([berry.dark.brand, berry.dark.accent]);
  });
});

describe("the generated stylesheet", () => {
  const css = themeCss();

  it("covers every palette, light and dark", () => {
    for (const p of PALETTES) {
      expect(css).toContain(`:root[data-palette="${p.id}"]{`);
      expect(css).toContain(`:root[data-theme="dark"][data-palette="${p.id}"]{`);
    }
  });

  it("wins against the plain :root in globals.css whichever order they load", () => {
    // Specificity, not order: `[data-palette=…]` alone ties with `:root`.
    expect(css).not.toMatch(/(^|})\[data-palette/);
    expect(css).not.toMatch(/(^|})\[data-theme/);
  });

  it("covers every balance-card finish except the one that follows the palette", () => {
    for (const style of HERO_STYLES) {
      const selector = `:root[data-hero="${style.id}"]`;
      if (style.id === HERO_STYLE_THEME) expect(css).not.toContain(selector);
      else expect(css).toContain(selector);
    }
  });

  it("gives a light finish its own ink, so a pale card isn't white on white", () => {
    const parchment = HERO_STYLES.find((s) => s.tone === "light");
    expect(parchment).toBeDefined();
    const block = css.slice(css.indexOf(`:root[data-hero="${parchment!.id}"]`));
    expect(block.slice(0, block.indexOf("}"))).toContain("--hero-ink:#2b2418");
  });

  it("sets a value for every variable it declares", () => {
    expect(css).not.toMatch(/--[a-z-]+:(;|})/);
  });
});

describe("balance-card finishes", () => {
  it("default to following the palette", () => {
    expect(HERO_STYLES[0].id).toBe(HERO_STYLE_THEME);
    expect(HERO_STYLES[0].background).toBeNull();
    expect(getHeroStyle(undefined).id).toBe(HERO_STYLE_THEME);
    expect(getHeroStyle("a-finish-from-a-newer-version").id).toBe(HERO_STYLE_THEME);
  });

  it("offer the same finishes an account card can wear", () => {
    expect(HERO_STYLES.length).toBeGreaterThan(5);
    expect(HERO_STYLES.filter((s) => s.id !== HERO_STYLE_THEME).every((s) => Boolean(s.background))).toBe(true);
  });
});
