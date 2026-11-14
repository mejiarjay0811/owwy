"use client";

import { ChevronRight, CircleCheck, OctagonAlert, Scale, TriangleAlert } from "lucide-react";
import Link from "@/components/ui/app-link";
import { ButtonLink } from "@/components/ui/button";
import { Money, OwwySays } from "@/components/ui/display";
import { HeroPattern } from "@/components/ui/hero-pattern";
import { useFinance } from "@/hooks/use-finance";
import { formatShortDate } from "@/lib/dates";
import type { OwwyMessage } from "@/lib/finance/owwy-voice";
import type { SafeToSpendStatus } from "@/lib/finance/safe-to-spend";

/**
 * The status pill's tint carries the state; its text is always the card's own
 * ink. Pinning the text to a fixed pale green or amber was readable on the
 * evergreen card and nothing else — on a parchment finish it vanished.
 */
const STATUS: Record<SafeToSpendStatus, { label: string; icon: React.ReactNode; tint: string }> = {
  healthy: { label: "On track", icon: <CircleCheck />, tint: "#4bb89d" },
  tight: { label: "Tight", icon: <TriangleAlert />, tint: "#e0a33f" },
  short: { label: "Nothing spare", icon: <TriangleAlert />, tint: "#e0a33f" },
  atRisk: { label: "Bills at risk", icon: <OctagonAlert />, tint: "#e06a54" },
};

/** `compact` drops Owwy's speech bubble when the Grove already shows it. */
export function SafeToSpendHero({ message, compact = false }: { message: OwwyMessage; compact?: boolean }) {
  const { state, settings, today } = useFinance();
  const sts = state.safeToSpend;
  const status = STATUS[sts.status];
  const untilLabel = sts.daysLeft <= 1 ? "until tomorrow" : `until ${formatShortDate(sts.periodEnd, today)}`;

  return (
    <section data-tour="safe" aria-labelledby="sts-title" className="hero-surface relative isolate overflow-hidden rounded-[28px] p-5 shadow-md sm:p-6">
      <HeroPattern pattern={settings.heroPattern} />

      {compact ? null : message.href ? (
        <Link href={message.href} className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-white/60">
          <OwwySays mood={message.mood} tone="hero">{message.text}</OwwySays>
        </Link>
      ) : (
        <OwwySays mood={message.mood} tone="hero">{message.text}</OwwySays>
      )}

      <div className={compact ? "flex items-center justify-between gap-3" : "mt-5 flex items-center justify-between gap-3"}>
        <h2 id="sts-title" className="text-eyebrow font-bold tracking-[0.12em] text-hero-ink-2 uppercase">
          Safe to spend
        </h2>
        <span
          className="inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-caption font-semibold text-hero-ink [&_svg]:size-3.5"
          style={{ background: `color-mix(in srgb, ${status.tint} 34%, transparent)` }}
        >
          {status.icon}
          {status.label}
        </span>
      </div>

      <p className="mt-1 text-[2.75rem] leading-none font-extrabold tracking-[-0.035em] sm:text-[3.25rem]">
        <Money value={sts.amount} animate whole />
      </p>
      <p className="mt-2 text-callout text-hero-ink-2">
        {sts.amount > 0 ? (
          <>
            About <Money value={sts.perDay} whole className="font-semibold text-hero-ink" /> a day · {untilLabel}
          </>
        ) : sts.status === "atRisk" ? (
          <>Upcoming bills need <Money value={-sts.rawAmount} className="font-semibold text-hero-ink" /> more than you have</>
        ) : (
          <>Your bills are covered, but there&apos;s nothing extra {untilLabel}</>
        )}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <ButtonLink href="/afford/" variant="hero" size="sm">
          <Scale />
          Can I afford it?
        </ButtonLink>
        <ButtonLink href="/safe-to-spend/" variant="hero" size="sm" className="bg-transparent ring-0 hover:bg-hero-fill">
          How it&apos;s worked out
          <ChevronRight />
        </ButtonLink>
      </div>
    </section>
  );
}
