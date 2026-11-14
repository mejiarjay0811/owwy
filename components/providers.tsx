"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { FinanceProvider, useOptionalFinance } from "@/hooks/use-finance";
import { useKeyboardViewport } from "@/hooks/use-keyboard-viewport";
import { syncStatusBar } from "@/lib/platform";
import { msUntilNextThemeChange, resolveTheme } from "@/lib/theme";

const loadMotionFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <FinanceProvider>
          <KeyboardViewport />
          <ThemeSync />
          <ServiceWorkerRegistration />
          {children}
          <Toaster />
        </FinanceProvider>
      </MotionConfig>
    </LazyMotion>
  );
}

/** Keeps the keyboard from rearranging the app. See the hook for why. */
function KeyboardViewport() {
  useKeyboardViewport();
  return null;
}

export const THEME_STORAGE_KEY = "owwy-theme";
export const PALETTE_STORAGE_KEY = "owwy-palette";
export const HERO_STORAGE_KEY = "owwy-hero";

/** Applies the theme preference and keeps it in sync with the OS setting. */
function ThemeSync() {
  const finance = useOptionalFinance();
  const preference = finance?.settings.theme;
  const palette = finance?.settings.palette;
  const hero = finance?.settings.heroStyle;

  // The palette and the balance-card finish are plain CSS (see
  // lib/defaults/theme-css), so switching either is one attribute. Both are
  // mirrored into localStorage for the pre-paint script, which runs long
  // before IndexedDB has opened.
  useEffect(() => {
    const root = document.documentElement;
    if (palette) root.dataset.palette = palette;
    if (hero) root.dataset.hero = hero;
    try {
      if (palette) localStorage.setItem(PALETTE_STORAGE_KEY, palette);
      if (hero) localStorage.setItem(HERO_STORAGE_KEY, hero);
    } catch {
      // Private mode: both still apply for this session.
    }
  }, [palette, hero]);

  useEffect(() => {
    if (!preference) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Private mode: theme still applies for this session.
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let timer: number | undefined;
    const apply = () => {
      const resolved = resolveTheme(preference, { prefersDark: media.matches });
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#0a1110" : "#f6f3ec");
      void syncStatusBar(resolved);
      // Following the clock: wake up again when day turns to evening, or back.
      if (preference === "timeOfDay") {
        window.clearTimeout(timer);
        timer = window.setTimeout(apply, msUntilNextThemeChange());
      }
    };
    apply();
    media.addEventListener("change", apply);
    // A phone that slept through the boundary catches up when it comes back.
    document.addEventListener("visibilitychange", apply);
    return () => {
      media.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", apply);
      window.clearTimeout(timer);
    };
  }, [preference]);

  return null;
}

function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    if ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Offline caching is an enhancement; the app still works online.
    });
  }, []);
  return null;
}
