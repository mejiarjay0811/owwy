"use client";

import { ChevronRight, Compass, Crown, Info, Lock, ScanLine, ScrollText, Settings, Sparkles } from "lucide-react";
import { useState } from "react";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import Link from "@/components/ui/app-link";
import { MORE_ITEMS } from "@/components/layout/nav-items";
import { Page, PageHeader } from "@/components/layout/page";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Card } from "@/components/ui/display";
import { useFinance } from "@/hooks/use-finance";
import { addMonthKey, monthName } from "@/lib/dates";
import { useUI } from "@/stores/ui";

export default function MorePage() {
  const { settings, state } = useFinance();
  const openAdd = useUI((s) => s.openAddTransaction);
  const lastMonth = addMonthKey(state.month, -1);
  const [tour, setTour] = useState(false);

  return (
    <Page>
      <PageHeader title="More" />

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

      <Card as="section" className="mb-5 divide-y divide-line/60">
        <MenuRow onClick={() => openAdd({ scan: true })} icon={<ScanLine />} label="Scan a receipt" description="Owwy reads it and picks the category" />
        {MORE_ITEMS.map((item) => (
          <MenuRow key={item.href} href={item.href} icon={<item.icon />} label={item.label} description={item.description} />
        ))}
        <MenuRow href={`/review/?month=${lastMonth}`} icon={<Sparkles />} label={`${monthName(lastMonth)} review`} description="Your month, explained" />
      </Card>

      <Card as="section" className="divide-y divide-line/60">
        <MenuRow href="/settings/" icon={<Settings />} label="Settings" description="Appearance, security, backup" />
        <MenuRow href="/premium/" icon={<Crown />} label="Owwy Premium" description="One purchase. No ads. No subscription." />
        <MenuRow onClick={() => setTour(true)} icon={<Compass />} label="Take the tour" description="What each part of Owwy does" />
        <MenuRow href="/about/" icon={<Info />} label="About Owwy" />
        <MenuRow href="/privacy/" icon={<ScrollText />} label="Privacy" />
      </Card>

      <WelcomeTour open={tour} onClose={() => setTour(false)} />
    </Page>
  );
}

const ROW_CLASS = "press flex w-full items-center gap-3.5 px-4 py-3 text-left first:rounded-t-[22px] last:rounded-b-[22px] hover:bg-surface-2/60";

function MenuRow({ href, icon, label, description, onClick }: { href?: string; icon: React.ReactNode; label: string; description?: string; onClick?: () => void }) {
  const content = (
    <>
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-ink [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {description ? <span className="block truncate text-caption text-ink-3">{description}</span> : null}
      </span>
      <ChevronRight className="size-5 text-ink-3" aria-hidden />
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={ROW_CLASS}>
      {content}
    </button>
  ) : (
    <Link href={href ?? "/"} className={ROW_CLASS}>
      {content}
    </Link>
  );
}
