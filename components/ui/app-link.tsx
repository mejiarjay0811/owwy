"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * `next/link` with prefetching off.
 *
 * Next 16's static export writes each route's RSC payload to a nested path —
 * `out/settings/__next.!KGFwcCk/settings/__PAGE__.txt` — but the client router
 * asks for the segments joined with dots:
 * `/settings/__next.!KGFwcCk.settings.__PAGE__.txt`. Nothing is served at that
 * URL, so every prefetch 404s: once per link in the viewport, on every page,
 * in the browser and on Vercel alike.
 *
 * The prefetch was never arriving, so turning it off costs nothing and removes
 * the failed requests. Navigation is unaffected — the service worker precaches
 * every route, so it is already served from disk.
 *
 * Re-enable by deleting this file and restoring the `next/link` imports once
 * the export writes the payload where the router looks for it.
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
