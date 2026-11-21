"use client";

/**
 * How Owwy is sold.
 *
 * It is a **paid app**, not an app with a purchase inside it: the store takes
 * the money before the download, so there is no billing code here, nothing to
 * unlock, and no entitlement to check. Everyone running Owwy has all of it.
 *
 * This file used to describe the other model — a `BillingProvider` bridge for
 * Google Play Billing and StoreKit, with a `GATED` set that was always empty.
 * None of it was ever wired up, and keeping a purchase flow that can't happen
 * around is how an app ends up with a button that lies. The price and the
 * store links are what's actually true, so that's what's left.
 */

/** One-time price on the stores, in pesos. Set per store, mirrored here for copy. */
export const STORE_PRICE_PHP = 199;

/** Set once the listings exist. Until then the page says "coming soon" rather than linking nowhere. */
export const STORE_LINKS: { play?: string; appStore?: string } = {};

export const WHAT_YOU_GET = [
  { id: "offline", title: "The whole app, offline", description: "Every screen, the receipt reader included, with no account and no server." },
  { id: "noads", title: "No ads, ever", description: "Nothing to upsell, nothing sold on, no notifications designed to pull you back." },
  { id: "private", title: "Your data stays yours", description: "It lives on your phone. Export or back it up whenever you like." },
  { id: "updates", title: "Updates included", description: "One payment. No subscription, no second tier, nothing held back." },
] as const;
