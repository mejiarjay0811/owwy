import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The app's own type scale, declared in app/globals.css as `--text-*`.
 *
 * tailwind-merge has to be told about these. Without it, it reads `text-body`
 * and `text-brand-ink` as two values of one `text-*` group and keeps only the
 * last — silently dropping the colour. That is how every primary button ended
 * up rendering near-black text on a dark green fill: `buttonClass` sets
 * `text-brand-ink`, the size then adds `text-body`, and the colour vanished.
 */
const FONT_SIZES = ["display", "title-1", "title-2", "title-3", "body", "callout", "caption", "eyebrow"] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
