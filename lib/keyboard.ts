/**
 * The arithmetic behind "is the keyboard up, and how tall is it".
 *
 * Pulled out of the hook so it can be checked without a browser. What it
 * cannot check is whether a real on-screen keyboard fires the events — that
 * needs a real device, and the browser pass in scripts/verify-round4.mjs
 * covers the app's *response* to the state instead.
 */

/** Below this, a visual-viewport change is a toolbar or a rounding error. */
export const KEYBOARD_MIN_PX = 120;

export interface ViewportProbe {
  /** The layout viewport, which `interactive-widget=resizes-visual` holds still. */
  innerHeight: number;
  /** `visualViewport.height`, which the keyboard does shrink. */
  viewportHeight: number;
  /** `visualViewport.offsetTop` — non-zero once the browser has panned the page. */
  viewportOffsetTop: number;
}

/**
 * How much of the window the keyboard covers.
 *
 * The gap between the layout viewport and the visual one *is* the keyboard,
 * which only holds because the layout viewport no longer resizes with it. A
 * negative result (a pinch-zoomed-out page) means no keyboard, not a
 * negative one.
 */
export function keyboardHeight({ innerHeight, viewportHeight, viewportOffsetTop }: ViewportProbe): number {
  return Math.max(0, innerHeight - viewportHeight - viewportOffsetTop);
}

export function isKeyboardOpen(height: number): boolean {
  return height >= KEYBOARD_MIN_PX;
}

/**
 * Whether to put the page back where it was before the keyboard opened.
 *
 * The browser pans the page to reveal the focused field and doesn't always pan
 * back, which is what leaves the screen looking shifted after you dismiss the
 * keyboard. But if the reader scrolled while typing, where they are is where
 * they want to be — restoring then would be the app fighting them.
 */
export function shouldRestoreScroll({ remembered, userScrolled }: { remembered: number | null; userScrolled: boolean }): boolean {
  return remembered !== null && !userScrolled;
}
