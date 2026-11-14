"use client";

import { useEffect, useState } from "react";

/**
 * Whether the app is currently dark.
 *
 * Reads the attribute the theme actually set rather than re-deriving it from
 * the preference, so "System" and "Clock" can't disagree with what's on
 * screen. Starts light, which is what the server rendered, and corrects
 * itself after mount — no hydration mismatch.
 */
export function useResolvedTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
