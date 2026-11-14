/**
 * Owwy's colour palettes.
 *
 * A palette repaints the *accent* layer of the app — buttons, links, chips,
 * the active tab, progress bars, the balance card and the owl itself. It
 * deliberately leaves the surfaces alone: the warm paper of the light theme
 * and the night forest of the dark one were tuned so every label clears
 * WCAG AA on them, and re-tinting the page behind every caption is how a
 * theme picker quietly turns readable text into grey-on-grey.
 *
 * This file is the single source of truth; `lib/defaults/theme-css` renders
 * it into the stylesheet that ships in the document head, so a saved palette
 * is already applied on the first paint.
 */

export interface PaletteColors {
  brand: string;
  brandHover: string;
  brandInk: string;
  brandSoft: string;
  brandSoftInk: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  accentSoftInk: string;
  /** Focus ring. Usually the accent. */
  focus: string;
  /** Default balance-card finish for this palette. */
  heroBg: string;
  /** The owl's body, so the mascot belongs to the palette too. */
  owwyBody: string;
  owwyBodyDark: string;
}

export interface Palette {
  id: string;
  name: string;
  hint: string;
  light: PaletteColors;
  dark: PaletteColors;
}

export const PALETTES: Palette[] = [
  {
    id: "evergreen",
    name: "Evergreen",
    hint: "Owwy's own — forest green and owl-eye amber",
    light: {
      brand: "#14463f",
      brandHover: "#0f3a34",
      brandInk: "#ffffff",
      brandSoft: "#e1ede9",
      brandSoftInk: "#14463f",
      accent: "#e39a35",
      accentInk: "#2a1a04",
      accentSoft: "#fbeed8",
      accentSoftInk: "#8a5310",
      focus: "#e39a35",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #21645a 0%, #14463f 42%, #0b2c28 100%)",
      owwyBody: "#1f5a50",
      owwyBodyDark: "#163f39",
    },
    dark: {
      brand: "#6cc7b3",
      brandHover: "#82d3c1",
      brandInk: "#062520",
      brandSoft: "#173430",
      brandSoftInk: "#8fd8c7",
      accent: "#f2b458",
      accentInk: "#2a1a04",
      accentSoft: "#33260f",
      accentSoftInk: "#f5c77f",
      focus: "#f2b458",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #1d4d45 0%, #133a34 40%, #0b221f 100%)",
      owwyBody: "#2f7d6f",
      owwyBodyDark: "#22604f",
    },
  },
  {
    id: "lagoon",
    name: "Lagoon",
    hint: "Deep ocean teal with a warm coral",
    light: {
      brand: "#10565f",
      brandHover: "#0c454d",
      brandInk: "#ffffff",
      brandSoft: "#ddeff1",
      brandSoftInk: "#0e4b53",
      accent: "#d86c45",
      accentInk: "#2b1105",
      accentSoft: "#fbe5dc",
      accentSoftInk: "#8d3a1c",
      focus: "#d86c45",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #1f7b83 0%, #10565f 42%, #06333a 100%)",
      owwyBody: "#1b6068",
      owwyBodyDark: "#124a51",
    },
    dark: {
      brand: "#63c9d4",
      brandHover: "#7ad4dd",
      brandInk: "#04262a",
      brandSoft: "#11343a",
      brandSoftInk: "#8bdbe3",
      accent: "#f3936d",
      accentInk: "#2b1105",
      accentSoft: "#3a2014",
      accentSoftInk: "#f7b094",
      focus: "#f3936d",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #1a5b63 0%, #113f47 40%, #08262c 100%)",
      owwyBody: "#2a8089",
      owwyBodyDark: "#1d6068",
    },
  },
  {
    id: "dusk",
    name: "Dusk",
    hint: "Twilight violet with a low amber sun",
    light: {
      brand: "#4b3570",
      brandHover: "#3d2a5c",
      brandInk: "#ffffff",
      brandSoft: "#e8e2f2",
      brandSoftInk: "#46306a",
      accent: "#c07a38",
      accentInk: "#2a1704",
      accentSoft: "#f7e8d6",
      accentSoftInk: "#80491a",
      focus: "#c07a38",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #6a4a94 0%, #4b3570 42%, #271a40 100%)",
      owwyBody: "#4a3561",
      owwyBodyDark: "#352346",
    },
    dark: {
      brand: "#b6a0ef",
      brandHover: "#c5b3f4",
      brandInk: "#19102c",
      brandSoft: "#271c3d",
      brandSoftInk: "#c9b9f5",
      accent: "#f0b060",
      accentInk: "#2a1704",
      accentSoft: "#342712",
      accentSoftInk: "#f6c98c",
      focus: "#f0b060",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #4e3878 0%, #372856 40%, #201634 100%)",
      owwyBody: "#6e5a9e",
      owwyBodyDark: "#4f3f78",
    },
  },
  {
    id: "berry",
    name: "Berry",
    hint: "Plum and rose, with a soft gold",
    light: {
      brand: "#7a2f4c",
      brandHover: "#65253e",
      brandInk: "#ffffff",
      brandSoft: "#f6e3ea",
      brandSoftInk: "#742c48",
      accent: "#b07f26",
      accentInk: "#2a1c02",
      accentSoft: "#f7ead2",
      accentSoftInk: "#7b5510",
      focus: "#b07f26",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #a8456b 0%, #7a2f4c 42%, #43182a 100%)",
      owwyBody: "#7d3a57",
      owwyBodyDark: "#5c2941",
    },
    dark: {
      brand: "#f0a0bd",
      brandHover: "#f4b2ca",
      brandInk: "#2b0f1b",
      brandSoft: "#3a1a26",
      brandSoftInk: "#f5bdd1",
      accent: "#efc063",
      accentInk: "#2a1c02",
      accentSoft: "#352a10",
      accentSoftInk: "#f5d490",
      focus: "#efc063",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #7e3755 0%, #5c2740 40%, #371726 100%)",
      owwyBody: "#a2566f",
      owwyBodyDark: "#7a3b52",
    },
  },
  {
    id: "harvest",
    name: "Harvest",
    hint: "Baked terracotta with olive leaves",
    light: {
      brand: "#8a3f20",
      brandHover: "#72331a",
      brandInk: "#ffffff",
      brandSoft: "#f7e4da",
      brandSoftInk: "#853d1f",
      accent: "#7d9a3c",
      accentInk: "#0b1102",
      accentSoft: "#ecf0dc",
      accentSoftInk: "#4d6020",
      focus: "#7d9a3c",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #b85f33 0%, #8a3f20 42%, #4e2112 100%)",
      owwyBody: "#8a4b24",
      owwyBodyDark: "#6b3718",
    },
    dark: {
      brand: "#f0a279",
      brandHover: "#f4b492",
      brandInk: "#2d1207",
      brandSoft: "#3b1e13",
      brandSoftInk: "#f6bb9c",
      accent: "#b8d16a",
      accentInk: "#16200a",
      accentSoft: "#28320f",
      accentSoftInk: "#cde08f",
      focus: "#b8d16a",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #8d4526 0%, #67311a 40%, #3c1c0f 100%)",
      owwyBody: "#a35a2e",
      owwyBodyDark: "#7b4020",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    hint: "Navy sky and old gold",
    light: {
      brand: "#1f3b63",
      brandHover: "#182f50",
      brandInk: "#ffffff",
      brandSoft: "#e0e7f2",
      brandSoftInk: "#1d3760",
      accent: "#a97c28",
      accentInk: "#231703",
      accentSoft: "#f6ecd5",
      accentSoftInk: "#765210",
      focus: "#a97c28",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #2f5d93 0%, #1f3b63 42%, #101f36 100%)",
      owwyBody: "#2b4e7a",
      owwyBodyDark: "#1d3757",
    },
    dark: {
      brand: "#8fb8ea",
      brandHover: "#a4c6ef",
      brandInk: "#0a1729",
      brandSoft: "#16263c",
      brandSoftInk: "#a9c9f0",
      accent: "#e9c268",
      accentInk: "#231703",
      accentSoft: "#332a12",
      accentSoftInk: "#f0d290",
      focus: "#e9c268",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #1f4472 0%, #163152 40%, #0b1b2f 100%)",
      owwyBody: "#37628f",
      owwyBodyDark: "#24456a",
    },
  },
  {
    id: "mono",
    name: "Quiet",
    hint: "Graphite and warm sand — nearly no colour at all",
    light: {
      brand: "#35403c",
      brandHover: "#2a332f",
      brandInk: "#ffffff",
      brandSoft: "#e7eae8",
      brandSoftInk: "#333d39",
      accent: "#a98a5c",
      accentInk: "#140d02",
      accentSoft: "#f1e9db",
      accentSoftInk: "#6a4f27",
      focus: "#a98a5c",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #59665f 0%, #35403c 42%, #1b211f 100%)",
      owwyBody: "#3f4b46",
      owwyBodyDark: "#2d3733",
    },
    dark: {
      brand: "#c3cec9",
      brandHover: "#d3dcd8",
      brandInk: "#141a18",
      brandSoft: "#242b28",
      brandSoftInk: "#cdd6d2",
      accent: "#d8bd92",
      accentInk: "#1a1205",
      accentSoft: "#2e2719",
      accentSoftInk: "#e3cdac",
      focus: "#d8bd92",
      heroBg: "radial-gradient(130% 120% at 100% 0%, #404b46 0%, #2c3431 40%, #171c1a 100%)",
      owwyBody: "#5b6a64",
      owwyBodyDark: "#43504a",
    },
  },
];

export const DEFAULT_PALETTE_ID = "evergreen";

export function getPalette(id: string | undefined): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** The two swatches shown in the picker, for a given resolved theme. */
export function paletteSwatches(palette: Palette, dark: boolean): [string, string] {
  const colors = dark ? palette.dark : palette.light;
  return [colors.brand, colors.accent];
}
