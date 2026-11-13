import type { NextConfig } from "next";

/**
 * Owwy ships as a fully static, offline-first bundle:
 * - `output: "export"` produces plain HTML/JS/CSS in `out/` that a service worker
 *   can precache and that Capacitor can package for Android/iOS.
 * - `trailingSlash` emits `/route/index.html`, which resolves cleanly on static
 *   hosts and inside native WebViews.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  // A package-lock.json in a parent folder confuses workspace-root detection; pin it here.
  turbopack: { root: process.cwd() },
  // Development only: let a phone on the same Wi-Fi reach `next dev` by LAN address.
  // Without this, Next blocks the HMR socket as cross-origin and the page never refreshes.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
};

export default nextConfig;
