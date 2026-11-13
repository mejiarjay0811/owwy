"use client";

import { ChevronRight, Compass, Crown, FileText, Info, Lock, ScanLine, ScrollText, Settings, Sparkles } from "lucide-react";
import { useState } from "react";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import Link from "@/components/ui/app-link";
import { MORE_ITEMS } from "@/components/layout/nav-items";
import { Page, PageHeader } from "@/components/layout/page";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Card } from "@/components/ui/display";
import { useFinance } from "@/hooks/use-finance";
import { addMonthKey, monthName } from "@/lib/dates";
import { cn } from "@/lib/utils/cn";
import { useUI } from "@/stores/ui";

export default function MorePage() {
  const { settings, state } = useFinance();
  const openAdd = useUI((s) => s.openAddTransaction);
  const lastMonth = addMonthKey(state.month, -1);
  const [tour, setTour] = useState(false);

  return (
    <Page>
      <PageHeader title="More" subtitle="Everything else Owwy can do." />

      <Link href="/settings/" className="press mb-5 block">
        <Card className="flex items-center gap-4 p-4 hover:bg-surface-2/50">
          <OwwyMascot mood="happy" size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-title-3 font-bold">{settings.displayName || "Your Owwy"}</p>
            <p className="flex items-center gap-1.5 text-callout text-ink-3">
              <Lock className="size-3.5" aria-hidden />
              {settings.security.pinEnabled ? "App lock on" : "Private"} · stored on this device
            </p>
          </div>
          <Settings className="size-5 text-ink-3" aria-hidden />
        </Card>
      </Link>

      {/* Each destination is its own card rather than a row in a divided list:
          a bigger target, room for the description to breathe, and a layout
          that stays scannable as the list grows. */}
      <ul className="mb-3 grid gap-2.5">
        <MenuCard onClick={() => openAdd({ scan: true })} icon={<ScanLine />} label="Scan a receipt" description="Owwy reads it and picks the category" />
        {MORE_ITEMS.map((item) => (
          <MenuCard key={item.href} href={item.href} icon={<item.icon />} label={item.label} description={item.description} />
        ))}
        <MenuCard href={`/review/?month=${lastMonth}`} icon={<Sparkles />} label={`${monthName(lastMonth)} review`} description="Your month, explained" />
      </ul>

      <ul className="mb-3 grid gap-2.5">
        <MenuCard href="/settings/" icon={<Settings />} label="Settings" description="Appearance, security, backup" />
        <MenuCard href="/premium/" icon={<Crown />} label="Owwy Premium" description="One purchase. No ads. No subscription." />
      </ul>

      {/* Secondary destinations pair up — they need a name, not a sentence. */}
      <ul className="grid grid-cols-2 gap-2.5">
        <MenuCard compact onClick={() => setTour(true)} icon={<Compass />} label="Take the tour" />
        <MenuCard compact href="/about/" icon={<Info />} label="About Owwy" />
        <MenuCard compact href="/privacy/" icon={<ScrollText />} label="Privacy" />
        <MenuCard compact href="/terms/" icon={<FileText />} label="Terms" />
      </ul>

      <WelcomeTour open={tour} onClose={() => setTour(false)} />
    </Page>
  );
}

const CARD_CLASS =
  "press flex w-full items-center gap-3.5 rounded-[20px] border border-line/70 bg-surface p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-2/50";

function MenuCard({
  href,
  icon,
  label,
  description,
  onClick,
  compact,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  compact?: boolean;
}) {
  const content = (
    <>
      <span
        className={cn(
          "flex items-center justify-center rounded-2xl bg-brand-soft text-brand-soft-ink",
          compact ? "size-10 [&_svg]:size-[18px]" : "size-12 [&_svg]:size-[22px]",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block font-bold", compact ? "text-callout" : "text-body")}>{label}</span>
        {description ? <span className="mt-0.5 block text-caption leading-snug text-ink-3">{description}</span> : null}
      </span>
      {!compact ? <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden /> : null}
    </>
  );

  return (
    <li className="min-w-0">
      {onClick ? (
        <button type="button" onClick={onClick} className={cn(CARD_CLASS, compact && "gap-3 p-3.5")}>
          {content}
        </button>
      ) : (
        <Link href={href ?? "/"} className={cn(CARD_CLASS, compact && "gap-3 p-3.5")}>
          {content}
        </Link>
      )}
    </li>
  );
}
