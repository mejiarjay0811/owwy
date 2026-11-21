"use client";

import { Check, Globe, Smartphone } from "lucide-react";
import { Page, PageHeader } from "@/components/layout/page";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { isNative } from "@/lib/platform";
import { STORE_LINKS, STORE_PRICE_PHP, WHAT_YOU_GET } from "@/lib/premium";

/**
 * Owwy is a paid app on the stores and free on the web.
 *
 * Both of those are true at once, so the page says both. It used to describe
 * a purchase *inside* the app — "the one-time purchase will be available in
 * the Google Play and App Store versions" — which is a different model from
 * the one Owwy actually uses, and a promise the app had no way to keep.
 */
export default function GetOwwyPage() {
  const native = isNative();
  const links = [
    { id: "play", label: "Google Play", href: STORE_LINKS.play },
    { id: "appStore", label: "App Store", href: STORE_LINKS.appStore },
  ].filter((l) => l.href);

  return (
    <Page width="narrow">
      <PageHeader title={native ? "Thanks for buying Owwy" : "Get Owwy on your phone"} back="/more/" />

      <Card className="hero-surface overflow-hidden border-0 p-6 text-center">
        <OwwyMascot mood={native ? "celebrating" : "happy"} size={104} animated className="mx-auto" />
        <p className="font-display mt-4 text-[1.875rem] leading-tight">
          {native ? "You have all of it." : `One payment. ₱${STORE_PRICE_PHP}.`}
        </p>
        <p className="mx-auto mt-2 max-w-sm text-body text-hero-ink-2">
          {native
            ? "No subscription, no second tier, nothing held back. Updates are included."
            : "Owwy on Google Play and the App Store is a one-time purchase. No subscription, no ads, nothing held back."}
        </p>
      </Card>

      <Card className="mt-5 p-5">
        <ul className="flex flex-col gap-4">
          {WHAT_YOU_GET.map((f) => (
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

      {native ? null : (
        <>
          {/* Saying the web version is free is the honest part: someone
              reading this *is* using the free one. */}
          <Card className="mt-5 flex items-start gap-3 p-5">
            <Globe className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
            <p className="text-callout text-ink-2">
              <span className="block font-semibold text-ink">This web version is free, and stays free.</span>
              It is the same app — install it from your browser&apos;s menu and it works offline too. The paid store builds add
              on-device notifications and the system share sheet, and they pay for Owwy&apos;s development.
            </p>
          </Card>

          <div className="mt-5 flex flex-col gap-2">
            {links.length ? (
              links.map((l) => (
                <ButtonLink key={l.id} href={l.href as string} size="xl">
                  <Smartphone />
                  {l.label} · &#8369;{STORE_PRICE_PHP}
                </ButtonLink>
              ))
            ) : (
              <div className="rounded-2xl bg-surface-2 p-4 text-center text-callout text-ink-2">
                <p className="font-semibold text-ink">Not on the stores yet.</p>
                <p className="mt-1">The Android and iOS builds are being prepared. Nothing here changes when they arrive.</p>
              </div>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
