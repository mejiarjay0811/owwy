import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Owwy — Private budget companion",
    short_name: "Owwy",
    description: "Know your money. Own your tomorrow. A private, offline-first budget app.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#0b1310",
    theme_color: "#14463f",
    categories: ["finance", "productivity", "lifestyle"],
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ask Owwy", short_name: "Ask", url: "/ask/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Log", short_name: "Log", url: "/transactions/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Safe to spend", short_name: "Safe to spend", url: "/safe-to-spend/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
