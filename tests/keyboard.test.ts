import { describe, expect, it } from "vitest";
import { isKeyboardOpen, KEYBOARD_MIN_PX, keyboardHeight, shouldRestoreScroll } from "@/lib/keyboard";

/**
 * These check the maths, not the browser.
 *
 * Whether a real on-screen keyboard fires the events needs a real device;
 * what can be pinned down here is that the numbers mean what the hook thinks
 * they mean — which is where this kind of code usually goes wrong, because a
 * sign error reads as "the keyboard is always open".
 */
describe("measuring the keyboard", () => {
  it("is the gap between the layout viewport and the visual one", () => {
    expect(keyboardHeight({ innerHeight: 852, viewportHeight: 516, viewportOffsetTop: 0 })).toBe(336);
  });

  it("counts the page the browser has already panned away", () => {
    // Pushed up 120px to reveal a field: the keyboard is still 336px tall.
    expect(keyboardHeight({ innerHeight: 852, viewportHeight: 396, viewportOffsetTop: 120 })).toBe(336);
  });

  it("is zero with nothing on screen", () => {
    expect(keyboardHeight({ innerHeight: 852, viewportHeight: 852, viewportOffsetTop: 0 })).toBe(0);
  });

  it("never goes negative, however the page is zoomed", () => {
    expect(keyboardHeight({ innerHeight: 400, viewportHeight: 900, viewportOffsetTop: 0 })).toBe(0);
  });

  it("ignores a browser toolbar sliding in and out", () => {
    const toolbar = keyboardHeight({ innerHeight: 852, viewportHeight: 796, viewportOffsetTop: 0 });
    expect(toolbar).toBe(56);
    expect(isKeyboardOpen(toolbar)).toBe(false);
  });

  it("treats anything keyboard-sized as the keyboard", () => {
    expect(isKeyboardOpen(KEYBOARD_MIN_PX)).toBe(true);
    expect(isKeyboardOpen(KEYBOARD_MIN_PX - 1)).toBe(false);
    expect(isKeyboardOpen(336)).toBe(true);
  });
});

describe("putting the page back", () => {
  it("restores where you were before the keyboard opened", () => {
    expect(shouldRestoreScroll({ remembered: 420, userScrolled: false })).toBe(true);
  });

  it("restores the top of the page too, which is not the same as 'nothing to do'", () => {
    expect(shouldRestoreScroll({ remembered: 0, userScrolled: false })).toBe(true);
  });

  it("leaves it alone if the reader scrolled while typing", () => {
    expect(shouldRestoreScroll({ remembered: 420, userScrolled: true })).toBe(false);
  });

  it("does nothing when there was never a position to go back to", () => {
    expect(shouldRestoreScroll({ remembered: null, userScrolled: false })).toBe(false);
  });
});
