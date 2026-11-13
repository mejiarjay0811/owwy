"use client";

import { Check, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { Page, PageHeader } from "@/components/layout/page";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { getBillingProvider, PREMIUM_FEATURES, type StoreProduct } from "@/lib/premium";
import { toast } from "@/stores/ui";

export default function PremiumPage() {
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const billing = getBillingProvider();
    void billing.isAvailable().then(async (ok) => {
      setAvailable(ok);
      if (ok) setProduct(await billing.getProduct());
    });
  }, []);

  return (
    <Page width="narrow">
      <PageHeader title="Owwy Premium" back="/more/" />
      <Card className="hero-surface overflow-hidden border-0 p-6 text-center">
        <OwwyMascot mood="celebrating" size={104} animated className="mx-auto" />
        <p className="font-display mt-4 text-[1.875rem] leading-tight">Private budgeting. One purchase.</p>
        <p className="mx-auto mt-2 max-w-sm text-body text-hero-ink-2">No ads. No subscription. Your data stays with you.</p>
      </Card>

      <Card className="mt-5 p-5">
        <ul className="flex flex-col gap-4">
          {PREMIUM_FEATURES.map((f) => (
            <li key={f.id} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-positive-soft text-positive">
                <Check className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">{f.title}</span>
                <span className="block text-callout text-ink-3">{f.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-5 flex flex-col gap-2">
        {available && product ? (
          <Button size="xl" onClick={() => getBillingProvider().purchase().then(() => toast.success("Thank you for supporting Owwy!")).catch((e) => toast.error(e))}>
            <Crown />
            Get Owwy for {product.price}
          </Button>
        ) : (
          <div className="rounded-2xl bg-surface-2 p-4 text-center text-callout text-ink-2">
            <p className="font-semibold text-ink">Everything is unlocked during early access.</p>
            <p className="mt-1">The one-time purchase will be available in the Google Play and App Store versions of Owwy.</p>
          </div>
        )}
        {available ? (
          <Button variant="ghost" onClick={() => getBillingProvider().restore().then((e) => toast.show(e.tier === "lifetime" ? "Purchase restored" : "No purchase found for this account"))}>
            Restore purchase
          </Button>
        ) : null}
      </div>
    </Page>
  );
}
