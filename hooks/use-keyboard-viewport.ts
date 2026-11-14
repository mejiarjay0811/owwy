"use client";

import { useEffect } from "react";
import { isKeyboardOpen, keyboardHeight, shouldRestoreScroll } from "@/lib/keyboard";

/**
 * Keeps the on-screen keyboard from rearranging the app.
 *
 * The viewport meta asks for `resizes-visual`, so opening the keyboard no
 * longer shrinks the layout: nothing is re-measured, nothing reflows, and the
 * page is exactly the size it was. That is the fix for "the app changes size
 * when I start typing" — but it leaves two things to do by hand.
 *
 * First, make room on purpose. `--kb` carries the keyboard's height, which is
 * all the two places that genuinely need it take: a sheet, whose Save button
 * has to stay reachable while you type, and `--nav-inset`, so a composer
 * pinned above the tab bar ends up pinned above the keyboard instead.
 *
 * Second, put the page back. The browser pans the page to reveal the focused
 * field and does not always pan back, which is the other half of the report:
 * close the keyboard and the screen stays where the browser left it. So the
 * scroll position is taken when the field is focused — before the browser has
 * moved anything — and restored when the keyboard goes away, unless the
 * reader scrolled themselves in the meantime, in which case where they are is
 * where they want to be.
 */

/** Keys that scroll a page. Everything else, while typing, is typing. */
const SCROLL_KEYS = new Set(["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " ", "Spacebar"]);
/** A touch has to travel this far before it counts as a scroll, not a tap. */
const DRAG_SLOP_PX = 24;

export function useKeyboardViewport(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    /**
     * Only a touch device gets the scroll restore.
     *
     * The making-room half is universal — if a viewport ever shrinks, the
     * sheet should lift. The putting-back half is not: on a desktop nothing
     * pans the page for a focused field, so arming it there would mean
     * dragging the scrollbar while a field is focused, clicking away, and
     * watching the page jump back to where you started.
     */
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;

    let open = false;
    /** Where the page was when the field was focused. */
    let restoreTo: number | null = null;
    let userScrolled = false;
    let touchStart: number | null = null;
    let settle: number | undefined;
    let blurTimer: number | undefined;

    const setHeight = (px: number) => root.style.setProperty("--kb", `${Math.round(px)}px`);

    const isTextField = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.matches("textarea, [contenteditable='true']") ||
        (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "reset", "range", "file", "color"].includes(el.type)));

    const opened = () => {
      open = true;
      root.dataset.keyboard = "open";
    };

    const closed = () => {
      open = false;
      root.dataset.keyboard = "closed";
      setHeight(0);
      const target = restoreTo;
      const restore = shouldRestoreScroll({ remembered: restoreTo, userScrolled });
      restoreTo = null;
      userScrolled = false;
      if (!restore || target === null) return;
      // The viewport is still settling while the keyboard slides away, and a
      // scroll written during that is overwritten by the browser's own. Two
      // frames and a backstop timeout cover both the instant and the
      // animated case.
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: target, behavior: "auto" });
          window.clearTimeout(settle);
          settle = window.setTimeout(() => window.scrollTo({ top: target, behavior: "auto" }), 260);
        }),
      );
    };

    /**
     * The keyboard's height, from the gap between the two viewports.
     *
     * Without `visualViewport` (old WebViews) there is no height to read, so
     * the state comes from focus alone: less precise, but the scroll position
     * is still restored, which is the part that was actually broken.
     */
    const measure = () => {
      if (!vv) return;
      const height = keyboardHeight({ innerHeight: window.innerHeight, viewportHeight: vv.height, viewportOffsetTop: vv.offsetTop });
      if (isKeyboardOpen(height)) {
        if (!open) opened();
        setHeight(height);
      } else if (open) {
        closed();
      }
    };

    /**
     * Focus is the earliest and most reliable signal.
     *
     * It arrives before the browser scrolls the field into view, so this is
     * the one moment the page is still where the reader left it.
     */
    const onFocusIn = (e: FocusEvent) => {
      if (!coarse || !isTextField(e.target)) return;
      window.clearTimeout(blurTimer);
      if (restoreTo === null) {
        restoreTo = window.scrollY;
        userScrolled = false;
      }
      if (!vv) opened();
    };

    const onFocusOut = () => {
      if (!coarse) return;
      // Moving between two fields is not the keyboard closing, so give focus
      // a moment to land somewhere before deciding.
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (isTextField(document.activeElement)) return;
        if (vv) measure();
        else if (open) closed();
        // With a floating keyboard the viewport may never change, so a blur
        // with nothing focused still means there's nothing left to restore.
        if (!open) {
          const target = restoreTo;
          const restore = shouldRestoreScroll({ remembered: restoreTo, userScrolled });
          restoreTo = null;
          if (restore && target !== null) window.scrollTo({ top: target, behavior: "auto" });
        }
      }, 150);
    };

    /**
     * A deliberate scroll beats the restore — but only a deliberate one.
     *
     * The browser's own panning arrives as an ordinary scroll event, and
     * every keystroke arrives as a keydown, so neither of those can count as
     * intent: a tap of a letter would otherwise cancel the restore every
     * single time. What counts is a drag that actually travels, a wheel, or
     * a key that scrolls a page while nothing is being typed into.
     */
    const onTouchStart = (e: TouchEvent) => {
      touchStart = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (restoreTo === null || touchStart === null) return;
      const y = e.touches[0]?.clientY;
      if (y !== undefined && Math.abs(y - touchStart) > DRAG_SLOP_PX) userScrolled = true;
    };
    const onWheel = () => {
      if (restoreTo !== null) userScrolled = true;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (restoreTo === null || !SCROLL_KEYS.has(e.key)) return;
      // Arrows and space move the caret inside a field, not the page.
      if (isTextField(e.target)) return;
      userScrolled = true;
    };

    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    measure();

    return () => {
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(settle);
      window.clearTimeout(blurTimer);
      root.dataset.keyboard = "closed";
      root.style.removeProperty("--kb");
    };
  }, []);
}
