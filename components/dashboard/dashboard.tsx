"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, FlaskConical, Search, Settings2, SlidersHorizontal } from "lucide-react";
import Link from "@/components/ui/app-link";
import { useMemo, useState } from "react";
import { Page } from "@/components/layout/page";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Card, OwwySays } from "@/components/ui/display";
import { SwitchRow } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Sheet } from "@/components/ui/sheet";
import { AccountFormSheet } from "@/components/accounts/account-sheets";
import { useFinance } from "@/hooks/use-finance";
import { addMonthKey, greetingFor, monthName, weekdayName, formatShortDate } from "@/lib/dates";
import { DASHBOARD_WIDGET_LABELS } from "@/lib/defaults/settings";
import { pickOwwyMessage } from "@/lib/finance/owwy-voice";
import { clearFinancialData } from "@/lib/services/demo";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { DashboardWidget, DashboardWidgetId } from "@/types/models";
import { GroveScene } from "@/components/grove/grove-scene";
import { PendingAutomationsWidget } from "./pending-automations";
import { RemindersButton } from "./reminders";
import { SafeToSpendHero } from "./safe-to-spend-hero";
import { PaydayWidget, SpendingWidget, UpcomingMovesWidget } from "./glance-widgets";
import { AccountsWidget, BudgetsWidget, GoalsWidget, RecentWidget, ThisMonthWidget } from "./widgets";

const SIDE_WIDGETS = new Set<DashboardWidgetId>(["pending", "upcoming", "budgets", "goals"]);
/** Small widgets that sit side by side when they're next to each other. */
const TILE_WIDGETS = new Set<DashboardWidgetId>(["payday", "spending"]);

/** Groups consecutive tile widgets into rows of two. */
function layoutRows(ids: DashboardWidgetId[]): DashboardWidgetId[][] {
  const rows: DashboardWidgetId[][] = [];
  for (const id of ids) {
    const last = rows[rows.length - 1];
    if (TILE_WIDGETS.has(id) && last && last.length === 1 && TILE_WIDGETS.has(last[0])) last.push(id);
    else rows.push([id]);
  }
  return rows;
}

export function Dashboard() {
  const finance = useFinance();
  const { state, settings, data, fmt, today } = finance;
  const [customizing, setCustomizing] = useState(false);

  const message = useMemo(
    () =>
      pickOwwyMessage({
        today,
        hasAccounts: state.activeAccounts.length > 0,
        transactionCount: data.transactions.length,
        spentToday: state.spentToday,
        monthToDateSpent: state.thisMonth.spent,
        previousMonthToDateSpent: state.lastMonthToDate.spent,
        safeToSpend: state.safeToSpend,
        budgets: state.budgetProgress,
        goals: state.goalProgress,
        upcomingBills: state.upcomingBills,
        format: fmt,
      }),
    [today, state, data.transactions.length, fmt],
  );

  const widgets = settings.dashboard.filter((w) => w.visible);
  const groveVisible = widgets.some((w) => w.id === "grove");
  const render = (id: DashboardWidgetId) => {
    switch (id) {
      case "grove":
        return null; // Rendered above the grid so it can span the page.
      case "pending":
        return <PendingAutomationsWidget key={id} />;
      case "safeToSpend":
        return <SafeToSpendHero key={id} message={message} compact={groveVisible} />;
      case "payday":
        return <PaydayWidget key={id} />;
      case "spending":
        return <SpendingWidget key={id} />;
      case "accounts":
        return <AccountsWidget key={id} />;
      case "thisMonth":
        return <ThisMonthWidget key={id} />;
      case "upcoming":
        return <UpcomingMovesWidget key={id} />;
      case "budgets":
        return <BudgetsWidget key={id} />;
      case "goals":
        return <GoalsWidget key={id} />;
      case "recent":
        return <RecentWidget key={id} />;
    }
  };
  const renderRows = (ids: DashboardWidgetId[], gap: string) =>
    layoutRows(ids).map((row) =>
      row.length === 2 ? (
        <div key={row.join("+")} className={cn("grid grid-cols-2", gap)}>
          {row.map(render)}
        </div>
      ) : (
        render(row[0])
      ),
    );

  const reviewMonth = addMonthKey(state.month, -1);
  const reviewReady = data.snapshots.find((s) => s.id === reviewMonth && !s.seen);
  const noAccounts = state.activeAccounts.length === 0;

  return (
    <Page width="wide" className={groveVisible ? "sm:pt-6 lg:pt-8" : "pt-[var(--safe-top)]"}>
      {groveVisible ? (
        <div className="mb-5">
          <GroveScene message={message} />
        </div>
      ) : (
        <DashboardHeader />
      )}

      {settings.demoMode ? <DemoBanner /> : null}
      {reviewReady ? <ReviewReadyCard month={reviewMonth} /> : null}

      {noAccounts ? (
        <FirstAccountCard />
      ) : (
        <>
          {/* Phones & tablets: one column in the user's order */}
          <div className="flex flex-col gap-5 lg:hidden">{renderRows(widgets.map((w) => w.id), "gap-3")}</div>

          {/* Desktop: main story on the left, glanceable plans on the right */}
          <div className="hidden gap-6 lg:grid lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-7 xl:col-span-8">{renderRows(widgets.filter((w) => !SIDE_WIDGETS.has(w.id)).map((w) => w.id), "gap-6")}</div>
            <div className="flex flex-col gap-6 lg:col-span-5 xl:col-span-4">{widgets.filter((w) => SIDE_WIDGETS.has(w.id)).map((w) => render(w.id))}</div>
          </div>
        </>
      )}

      <div className="mt-8 flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => setCustomizing(true)}>
          <SlidersHorizontal />
          Customize home
        </Button>
      </div>

      <CustomizeSheet open={customizing} onOpenChange={setCustomizing} widgets={settings.dashboard} />
    </Page>
  );
}

function DashboardHeader() {
  const { settings, today } = useFinance();
  const name = settings.displayName.trim();

  return (
    <header className="flex items-center gap-2 pt-4 pb-5 lg:pt-8">
      <div className="min-w-0 flex-1">
        <p className="text-caption font-semibold text-ink-3">
          {weekdayName(today)}, {formatShortDate(today)}
        </p>
        <h1 className="line-clamp-2 text-[1.5rem] leading-tight font-extrabold tracking-tight sm:text-title-1">
          {greetingFor()}
          {name ? `, ${name}` : ""}
        </h1>
      </div>
      <RemindersButton />
      <IconButton
        label={settings.hideBalances ? "Show balances" : "Hide balances"}
        variant="surface"
        onClick={() => void updateSettings({ hideBalances: !settings.hideBalances })}
        aria-pressed={settings.hideBalances}
      >
        {settings.hideBalances ? <EyeOff /> : <Eye />}
      </IconButton>
      <Link href="/transactions/?search=1" aria-label="Search transactions" className="press hidden size-11 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-xs hover:bg-surface-2 sm:inline-flex [&_svg]:size-[20px]">
        <Search aria-hidden />
      </Link>
      <Link href="/settings/" aria-label="Settings" className="press inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-xs hover:bg-surface-2 lg:hidden [&_svg]:size-[20px]">
        <Settings2 aria-hidden />
      </Link>
    </header>
  );
}

function DemoBanner() {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3">
        <FlaskConical className="size-5 shrink-0 text-accent-soft-ink" aria-hidden />
        <p className="min-w-0 flex-1 text-callout text-accent-soft-ink">
          <span className="font-bold">You&apos;re exploring sample data.</span> <span className="max-sm:hidden">Nothing here is real.</span>
        </p>
        <Button size="sm" variant="outline" onClick={() => setConfirm(true)} className="shrink-0">
          Start fresh
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove sample data?"
        description="All sample accounts, transactions, budgets, bills and goals will be removed so you can add your own. Your preferences stay."
        confirmLabel="Remove sample data"
        destructive
        onConfirm={async () => {
          await clearFinancialData();
          toast.success("Sample data removed. Let's add your real accounts.");
        }}
      />
    </>
  );
}

function ReviewReadyCard({ month }: { month: string }) {
  return (
    <Link
      href={`/review/?month=${month}`}
      className="press mb-5 flex items-center gap-3 rounded-[22px] border border-line/70 bg-surface p-3 pr-4 shadow-xs hover:bg-surface-2/60"
    >
      <OwwyMascot mood="celebrating" size={52} animated />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Your {monthName(month)} review is ready</p>
        <p className="text-callout text-ink-2">See how the month went, in a minute.</p>
      </div>
      <span className="rounded-full bg-brand px-3 py-1.5 text-caption font-bold text-brand-ink">Open</span>
    </Link>
  );
}

function FirstAccountCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <OwwySays mood="encouraging" size={72}>
        Let&apos;s start with where your money lives.
      </OwwySays>
      <h2 className="mt-6 text-title-2 font-bold">Add your first account</h2>
      <p className="mt-1 max-w-sm text-body text-ink-2">Cash, a bank account or an e-wallet. You can add more any time — everything stays on this device.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={() => setOpen(true)}>Add account</Button>
        <ButtonLink href="/settings/#data" variant="secondary">
          Import a backup
        </ButtonLink>
      </div>
      <AccountFormSheet open={open} onOpenChange={setOpen} />
    </Card>
  );
}

export function CustomizeSheet({ open, onOpenChange, widgets }: { open: boolean; onOpenChange: (o: boolean) => void; widgets: DashboardWidget[] }) {
  const save = (next: DashboardWidget[]) => void updateSettings({ dashboard: next });
  const move = (index: number, delta: number) => {
    const next = [...widgets];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    save(next);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Customize home" description="Choose what you see and in what order." size="sm">
      <ul className="flex flex-col divide-y divide-line/70">
        {widgets.map((w, index) => (
          <li key={w.id} className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <SwitchRow
                checked={w.visible}
                onCheckedChange={(visible) => save(widgets.map((x) => (x.id === w.id ? { ...x, visible } : x)))}
                label={DASHBOARD_WIDGET_LABELS[w.id].title}
                description={DASHBOARD_WIDGET_LABELS[w.id].description}
              />
            </div>
            <div className="flex flex-col">
              <IconButton size="sm" label={`Move ${DASHBOARD_WIDGET_LABELS[w.id].title} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp />
              </IconButton>
              <IconButton size="sm" label={`Move ${DASHBOARD_WIDGET_LABELS[w.id].title} down`} disabled={index === widgets.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
      <p className={cn("mt-3 text-caption text-ink-3")}>On larger screens, bills, budgets and goals appear in the right column.</p>
    </Sheet>
  );
}
