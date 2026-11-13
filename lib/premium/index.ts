"use client";

/**
 * Premium licensing architecture.
 *
 * Owwy is designed as a one-time purchase: no ads, no subscription. Store
 * billing (Google Play Billing, StoreKit) lives in the native shell and is
 * exposed to the web layer through a small bridge. Until a real store product
 * is connected, every feature stays available and no payment UI pretends to work.
 */

export type EntitlementSource = "none" | "play" | "appstore" | "web";

export interface Entitlement {
  tier: "free" | "lifetime";
  source: EntitlementSource;
  /** When the store last confirmed the purchase. */
  verifiedAt?: number;
}

export interface StoreProduct {
  id: string;
  title: string;
  /** Localized price string provided by the store, e.g. "₱499.00". */
  price: string;
}

export interface BillingProvider {
  readonly id: EntitlementSource;
  isAvailable(): Promise<boolean>;
  getProduct(): Promise<StoreProduct | null>;
  purchase(): Promise<Entitlement>;
  restore(): Promise<Entitlement>;
}

export const LIFETIME_PRODUCT_ID = "owwy_lifetime";

/** Features that a future Premium tier could include. Nothing is gated today. */
export const PREMIUM_FEATURES = [
  { id: "ai", title: "Ask Owwy with AI", description: "Bring your own key; answers show their work." },
  { id: "automations", title: "Unlimited automations", description: "Salary, savings, rent — logged for you." },
  { id: "reports", title: "Reports & exports", description: "PDF monthly reports, CSV and encrypted backups." },
  { id: "themes", title: "Card finishes & themes", description: "Every card style and pattern." },
] as const;

export type PremiumFeature = (typeof PREMIUM_FEATURES)[number]["id"];

/** Early access: everything is unlocked. Flip per feature when store billing ships. */
const GATED: ReadonlySet<PremiumFeature> = new Set();

export function canUse(feature: PremiumFeature, entitlement: Entitlement): boolean {
  return !GATED.has(feature) || entitlement.tier === "lifetime";
}

class UnavailableBilling implements BillingProvider {
  readonly id = "none" as const;
  async isAvailable() {
    return false;
  }
  async getProduct() {
    return null;
  }
  async purchase(): Promise<Entitlement> {
    throw new Error("Purchases aren't available in this version of Owwy.");
  }
  async restore(): Promise<Entitlement> {
    return { tier: "free", source: "none" };
  }
}

/** Native shells register `window.OwwyBilling` implementing BillingProvider. */
export function getBillingProvider(): BillingProvider {
  if (typeof window !== "undefined") {
    const bridge = (window as unknown as { OwwyBilling?: BillingProvider }).OwwyBilling;
    if (bridge) return bridge;
  }
  return new UnavailableBilling();
}
