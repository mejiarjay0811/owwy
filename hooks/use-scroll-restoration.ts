"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { recordNavigation } from "@/lib/nav-history";

/**
 * Remembers where each screen was scrolled to and puts you back there.
 *
 * Going somewhere new should start at the top; going *back* should return you
 * to the row you were looking at. A blanket `scrollTo(0)` on every route
 * change gets the first half right and the second half wrong — you tap into a
 * transaction, come back, and you're at the top of a long list again.
 *
 * Browser-native restoration can't help: the App Router swaps the page's
 * contents without a document load, so the browser has nothing to restore
 * against. We track it ourselves, and switch the browser's own handling off
 * so the two don't fight.
 *
 * Two things here are deliberate, because the obvious versions don't work:
 *
 * **The position is captured when you act, not while you scroll.** A `scroll`
 * listener keyed on the current path looks right and isn't: the router scrolls
 * the document to the top as part of navigating, and that event arrives while
 * the old path's listener is still attached — overwriting the position you
 * were at with 0, every single time. Capturing on the click or key press that
 * starts the navigation runs before any of that, and is the position the user
 * actually left from.
 *
 * **The direction comes from our own trail, not from `popstate`.** Next
 * registers its own `popstate` listener when the router starts, before this
 * hook ever mounts, and flushes React inside that handler — so the effect
 * below can run before a listener here would have set a flag. Comparing the
 * destination against the trail in lib/nav-history needs no event ordering.
 */
export function useScrollRestoration(): void {
  const pathname = usePathname();
  const positions = useRef(new Map<string, number>());

  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);

  // Snapshot this screen's offset the moment the user does something that
  // could navigate — a tap, a key press, or the Back button.
  useEffect(() => {
    const key = pathname;
    const snapshot = () => positions.current.set(key, window.scrollY);
    // Capture phase, so each runs before the handler that navigates.
    // `pointerdown` catches a tap at the earliest possible moment; `click`
    // also covers activation by keyboard and by code, which fires no pointer
    // events at all.
    for (const type of ["pointerdown", "click", "keydown"] as const) {
      document.addEventListener(type, snapshot, true);
    }
    window.addEventListener("popstate", snapshot);
    return () => {
      for (const type of ["pointerdown", "click", "keydown"] as const) {
        document.removeEventListener(type, snapshot, true);
      }
      window.removeEventListener("popstate", snapshot);
    };
  }, [pathname]);

  useEffect(() => {
    const direction = recordNavigation(pathname);
    const target = direction === "back" ? (positions.current.get(pathname) ?? 0) : 0;
    if (target === 0) {
      window.scrollTo({ top: 0 });
      return;
    }
    // Two frames: the first lets the new screen mount, the second lets it
    // reach full height, or the scroll lands short on a long list.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => window.scrollTo({ top: target }));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [pathname]);
}
