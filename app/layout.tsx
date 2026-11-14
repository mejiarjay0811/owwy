import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource-variable/fraunces/soft.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { HERO_STYLE_THEME } from "@/lib/defaults/card-styles";
import { DEFAULT_PALETTE_ID } from "@/lib/defaults/palettes";
import { themeCss } from "@/lib/defaults/theme-css";

export const metadata: Metadata = {
  title: {
    default: "Owwy — Know your money. Own your tomorrow.",
    template: "%s · Owwy",
  },
  description:
    "Owwy is a private, offline-first budget companion. See where your money goes, how much you can safely spend, and how you're progressing toward your goals.",
  applicationName: "Owwy",
  appleWebApp: { capable: true, title: "Owwy", statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The keyboard floats over the page rather than shrinking the layout, so
  // nothing is re-measured and nothing changes size when you start typing —
  // the same model iOS has always used, now on Android too. Making room where
  // it actually matters is deliberate: `--kb` carries the keyboard's height
  // (see hooks/use-keyboard-viewport) and the sheet and tab bar use it.
  // Pinch zoom is left alone — capping it would fail WCAG 1.4.4.
  interactiveWidget: "resizes-visual",
  themeColor: "#f6f3ec",
  colorScheme: "light dark",
};

/**
 * Applies the saved theme and palette before first paint, so there's no
 * light/dark flash and no flash of Owwy's green before yours arrives.
 */
// Mirrors lib/theme.ts — keep the hours in step if they ever change there.
const themeScript = `(function(){try{var p=localStorage.getItem("owwy-theme")||"light";var h=new Date().getHours();var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches)||(p==="timeOfDay"&&(h<5||h>=18));var r=document.documentElement;r.dataset.theme=d?"dark":"light";var c=localStorage.getItem("owwy-palette");if(c)r.dataset.palette=c;var hc=localStorage.getItem("owwy-hero");if(hc)r.dataset.hero=hc;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"#0a1110":"#f6f3ec")}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" data-palette={DEFAULT_PALETTE_ID} data-hero={HERO_STYLE_THEME} suppressHydrationWarning>
      <head>
        {/* Generated from the palette and finish catalogues, so the colour
            data has one home and a saved choice is on screen at first paint. */}
        <style id="owwy-theme" dangerouslySetInnerHTML={{ __html: themeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-ink"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
