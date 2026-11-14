"use client";

import { ArrowDownToLine, Pencil, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { GoalCelebration, GoalDetailSheet, GoalFormSheet, GoalMoneySheet, GOAL_TEMPLATES } from "@/components/goals/goal-sheets";
import { Page, PageHeader } from "@/components/layout/page";
import { Button, IconButton } from "@/components/ui/button";
import { Badge, Card, EmojiTile, EmptyState, Money, ProgressBar } from "@/components/ui/display";
import { Chip } from "@/components/ui/form";
import { useFinance } from "@/hooks/use-finance";
import { formatShortDate } from "@/lib/dates";
import { totalRequiredMonthly, type GoalProgress } from "@/lib/finance/goals";
import { GOAL_PACE_LABEL } from "@/lib/finance/labels";
import type { SavingsGoal } from "@/types/models";

export default function GoalsPage() {
  return (
    <Suspense>
      <GoalsScreen />
    </Suspense>
  );
}

function GoalsScreen() {
  const { state } = useFinance();
  const params = useSearchParams();
  const [form, setForm] = useState<{ goal?: SavingsGoal; template?: { emoji: string; name: string } } | null>(() => (params.get("new") ? {} : null));
  const [money, setMoney] = useState<{ goal: SavingsGoal; mode: "add" | "withdraw" } | null>(null);
  const [celebrate, setCelebrate] = useState<SavingsGoal | null>(null);
  const [detail, setDetail] = useState<SavingsGoal | null>(null);

  const active = state.goalProgress.filter((g) => g.pace !== "complete");
  const complete = state.goalProgress.filter((g) => g.pace === "complete");
  const totalSaved = state.goalProgress.reduce((t, g) => t + g.saved, 0);
  const totalTarget = state.goalProgress.reduce((t, g) => t + g.goal.targetAmount, 0);
  const monthly = totalRequiredMonthly(active);

  return (
    <Page>
      <PageHeader
        title="Goals"
        subtitle="Save for the things that matter, one step at a time."
        actions={
          <Button size="sm" onClick={() => setForm({})}>
            <Plus />
            Goal
          </Button>
        }
      />

      {state.goalProgress.length === 0 ? (
        <Card>
          <EmptyState
            mood="encouraging"
            title="What's something you're saving for?"
            description="Pick one to start. Owwy will work out how much to set aside each month."
            action={
              <div className="flex max-w-sm flex-wrap justify-center gap-2">
                {GOAL_TEMPLATES.map((t) => (
                  <Chip key={t.name} onClick={() => setForm({ template: t })}>
                    {t.emoji} {t.name}
                  </Chip>
                ))}
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="hero-surface mb-5 border-0 p-5">
            <p className="text-eyebrow font-bold tracking-[0.12em] text-hero-ink-2 uppercase">Saved toward goals</p>
            <p className="mt-1 text-[2.25rem] leading-none font-extrabold tracking-tight">
              <Money value={totalSaved} animate />
            </p>
            <p className="mt-2 text-callout text-hero-ink-2">
              of <Money value={totalTarget} /> across {state.goalProgress.length} goal{state.goalProgress.length > 1 ? "s" : ""}
            </p>
            <ProgressBar className="mt-4" height="h-2.5" tone="accent" value={(totalSaved / Math.max(1, totalTarget)) * 100} label="Share of all goal targets saved" />
            <dl className="mt-4 grid grid-cols-3 gap-2">
              <HeroStat label="Active" value={String(active.length)} />
              <HeroStat label="Completed" value={String(complete.length)} />
              <HeroStat label="To go" value={<Money value={Math.max(0, totalTarget - totalSaved)} compact={totalTarget - totalSaved >= 1_000_000_00} />} />
            </dl>
            {monthly > 0 ? (
              <p className="mt-4 rounded-2xl bg-hero-fill px-3.5 py-2.5 text-callout">
                Setting aside <Money value={monthly} className="font-bold" /> a month keeps every dated goal on track.
              </p>
            ) : null}
          </Card>

          <ul className="grid gap-4 md:grid-cols-2">
            {active.map((g) => (
              <GoalCard
                key={g.goal.id}
                progress={g}
                onAdd={() => setMoney({ goal: g.goal, mode: "add" })}
                onWithdraw={() => setMoney({ goal: g.goal, mode: "withdraw" })}
                onEdit={() => setForm({ goal: g.goal })}
                onOpen={() => setDetail(g.goal)}
              />
            ))}
          </ul>

          {complete.length ? (
            <section className="mt-8" aria-labelledby="done">
              <h2 id="done" className="mb-3 text-title-3 font-bold">
                Completed
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {complete.map((g) => (
                  <GoalCard key={g.goal.id} progress={g} onAdd={() => setMoney({ goal: g.goal, mode: "add" })} onWithdraw={() => setMoney({ goal: g.goal, mode: "withdraw" })} onEdit={() => setForm({ goal: g.goal })} onOpen={() => setDetail(g.goal)} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <GoalFormSheet open={Boolean(form)} onOpenChange={(o) => !o && setForm(null)} goal={form?.goal} template={form?.template} />
      <GoalMoneySheet goal={money?.goal ?? null} mode={money?.mode ?? "add"} onOpenChange={(o) => !o && setMoney(null)} onCompleted={setCelebrate} />
      <GoalCelebration goal={celebrate} onClose={() => setCelebrate(null)} />
      <GoalDetailSheet
        goal={detail}
        onOpenChange={(o) => !o && setDetail(null)}
        onAdd={(goal) => {
          setDetail(null);
          setMoney({ goal, mode: "add" });
        }}
      />
    </Page>
  );
}

function HeroStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-hero-fill px-3 py-2">
      <dt className="text-caption text-hero-ink-2">{label}</dt>
      <dd className="truncate text-body font-bold">{value}</dd>
    </div>
  );
}

function GoalCard({ progress: g, onAdd, onWithdraw, onEdit, onOpen }: { progress: GoalProgress; onAdd: () => void; onWithdraw: () => void; onEdit: () => void; onOpen: () => void }) {
  const { state, today } = useFinance();
  const account = state.accountsById.get(g.goal.accountId);
  const tone = g.pace === "complete" || g.pace === "onTrack" ? "positive" : g.pace === "behind" || g.pace === "overdue" ? "warning" : "neutral";

  return (
    // min-w-0: grid items default to min-width:auto, which kept this card
    // wider than a 320px screen.
    <Card as="li" className="flex min-w-0 flex-col p-5">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onOpen} className="press -m-1 flex min-w-0 flex-1 items-start gap-3 rounded-2xl p-1 text-left hover:bg-surface-2/60" aria-label={`${g.goal.name}, see history`}>
          <EmojiTile emoji={g.goal.emoji} color={g.goal.color} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-title-3 font-bold">{g.goal.name}</span>
            <span className="block text-caption text-ink-3">
              {g.goal.targetDate ? `By ${formatShortDate(g.goal.targetDate, today)}` : "No deadline"} · {account?.name ?? "Account removed"}
            </span>
          </span>
        </button>
        <IconButton size="sm" label={`Edit ${g.goal.name}`} onClick={onEdit}>
          <Pencil />
        </IconButton>
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="text-title-2 font-extrabold tracking-tight">
          <Money value={g.saved} />
          <span className="ml-1.5 text-callout font-semibold text-ink-3">
            of <Money value={g.goal.targetAmount} />
          </span>
        </p>
        {/* The goal's colour is picked for a progress bar, not for type — the
            lighter swatches fall to ~2:1 as text. It stays on the bar and the
            tile; the number reads in ink. */}
        <span className="text-title-3 font-bold text-ink">
          {Math.round(g.percent)}%
        </span>
      </div>
      <ProgressBar className="mt-2" height="h-3" value={g.percent} tone="custom" color={g.goal.color} label={`${g.goal.name}: ${Math.round(g.percent)}% saved`} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{GOAL_PACE_LABEL[g.pace]}</Badge>
        {g.requiredMonthly > 0 ? (
          <span className="text-caption text-ink-2">
            <Money value={g.requiredMonthly} className="font-bold text-ink" /> / month needed
          </span>
        ) : g.remaining > 0 ? (
          <span className="text-caption text-ink-2">
            <Money value={g.remaining} className="font-bold text-ink" /> to go
          </span>
        ) : null}
      </div>
      {g.remaining > 0 && g.projectedDate && g.averageMonthly > 0 ? (
        <p className="mt-2 text-caption text-ink-3">At your recent pace, you&apos;ll get there around {formatShortDate(g.projectedDate, today)}.</p>
      ) : null}

      {/* Both labels are nowrap, so side by side they overflowed a 320px card.
          A basis wider than half the row makes them stack instead of spill. */}
      <div className="mt-4 flex flex-wrap gap-2 pt-1">
        <Button size="md" className="flex-1 basis-36" onClick={onAdd}>
          <Plus />
          Add money
        </Button>
        <Button size="md" variant="secondary" className="flex-1 basis-36" onClick={onWithdraw} disabled={g.saved <= 0}>
          <ArrowDownToLine />
          Withdraw
        </Button>
      </div>
    </Card>
  );
}
