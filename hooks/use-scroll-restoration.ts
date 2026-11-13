"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Remembers where each screen was scrolled to and puts you back there.
 *
 * Going somewhere new should start at the top; going *back* should return you
 * to the row you were looking at. A blanket `scrollTo(0)` on every route change
 * gets the first half right and the second half wrong — you tap into a
 * transaction, come back, and you're at the top of a long list again.
 *
 * Browser-native restoration can't help: the App Router swaps the page's
 * contents without a document load, so the browser has nothing to restore
 * against. We track it ourselves, and switch the browser's own handling off so
 * the two don't fight.
 */
export function useScrollRestoration(): void {
  const pathname = usePathname();
  const positions = useRef(new Map<string, number>());
  const cameFromHistory = useRef(false);

  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const onPopState = () => {
      cameFromHistory.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      history.scrollRestoration = previous;
    };
  }, []);

  // Keep the current screen's offset up to date while it's on screen, so the
  // value is already stored by the time a navigation starts.
  useEffect(() => {
    const key = pathname;
    const remember = () => positions.current.set(key, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [pathname]);

  useEffect(() => {
    if (!cameFromHistory.current) {
      window.scrollTo({ top: 0 });
      return;
    }
    cameFromHistory.current = false;
    const target = positions.current.get(pathname) ?? 0;
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
