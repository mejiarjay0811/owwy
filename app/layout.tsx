import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource-variable/fraunces/soft.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";

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
  themeColor: "#f6f3ec",
  colorScheme: "light dark",
};

/** Applies the saved theme before first paint so there's no light/dark flash. */
// Mirrors lib/theme.ts — keep the hours in step if they ever change there.
const themeScript = `(function(){try{var p=localStorage.getItem("owwy-theme")||"light";var h=new Date().getHours();var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches)||(p==="timeOfDay"&&(h<5||h>=18));document.documentElement.dataset.theme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"#0a1110":"#f6f3ec")}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
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
