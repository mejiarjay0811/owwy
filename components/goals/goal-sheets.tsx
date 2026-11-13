"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "motion/react";
import { useMemo, useState } from "react";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Button } from "@/components/ui/button";
import { Money, ProgressBar, ProgressRing } from "@/components/ui/display";
import { ColorPicker, EmojiPicker } from "@/components/ui/emoji-picker";
import { AmountInput, Field, Select, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { formatShortDate } from "@/lib/dates";
import { isSavingsAccount } from "@/lib/finance/balances";
import { computeGoalProgress, goalContribution, goalSaved } from "@/lib/finance/goals";
import { minorFactor, minorToInput, parseAmount } from "@/lib/money";
import { haptic } from "@/lib/platform";
import { createAccount } from "@/lib/storage/repositories/accounts";
import { contributeToGoal, createGoal, deleteGoal, updateGoal, withdrawFromGoal } from "@/lib/storage/repositories/goals";
import { deleteTransaction } from "@/lib/storage/repositories/transactions";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { SavingsGoal } from "@/types/models";

export const GOAL_EMOJIS = ["📱", "🏠", "🚗", "✈️", "🏝️", "🎓", "🛟", "💻", "💍", "👶", "🎁", "🏍️", "🎮", "🩺", "🐶", "🌱", "🎸", "📷"];
export const GOAL_COLORS = ["#E8A33D", "#2F8FA3", "#3C6E8F", "#6E8B3D", "#C0573F", "#7A5AA6", "#D0668A", "#14463F"];

export const GOAL_TEMPLATES = [
  { emoji: "📱", name: "New phone" },
  { emoji: "🏠", name: "House" },
  { emoji: "🚗", name: "Car" },
  { emoji: "✈️", name: "Vacation" },
  { emoji: "🎓", name: "Education" },
  { emoji: "🛟", name: "Emergency fund" },
  { emoji: "💻", name: "Laptop" },
  { emoji: "💍", name: "Wedding" },
];

const NEW_ACCOUNT = "__new__";

export function GoalFormSheet({
  open,
  onOpenChange,
  goal,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: SavingsGoal;
  template?: { emoji: string; name: string };
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={goal ? "Edit goal" : "New savings goal"} description={goal ? undefined : "Owwy works out how much to set aside each month."}>
      {open ? <GoalForm goal={goal} template={template} onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function GoalForm({ goal, template, onDone }: { goal?: SavingsGoal; template?: { emoji: string; name: string }; onDone: () => void }) {
  const { state, currency, today, fmt, data } = useFinance();
  const savingsAccounts = state.mainAccounts.filter((a) => a.type !== "credit");
  const preferred = savingsAccounts.find(isSavingsAccount);

  const [name, setName] = useState(goal?.name ?? template?.name ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? template?.emoji ?? "🎯");
  const [target, setTarget] = useState(goal ? minorToInput(goal.targetAmount, currency) : "");
  const [already, setAlready] = useState(goal ? minorToInput(goal.startingAmount, currency) : "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [accountId, setAccountId] = useState(goal?.accountId ?? preferred?.id ?? NEW_ACCOUNT);
  const [color, setColor] = useState(goal?.color ?? GOAL_COLORS[data.goals.length % GOAL_COLORS.length]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const targetMinor = parseAmount(target, currency) ?? 0;
  const preview = useMemo(() => {
    if (!targetMinor) return null;
    const draft: SavingsGoal = {
      id: goal?.id ?? "preview",
      name,
      emoji,
      targetAmount: targetMinor,
      startingAmount: parseAmount(already, currency) ?? 0,
      targetDate: targetDate || undefined,
      accountId,
      color,
      archived: false,
      createdAt: 0,
      updatedAt: 0,
    };
    return computeGoalProgress(draft, goal ? data.transactions : [], today);
  }, [targetMinor, already, targetDate, accountId, color, name, emoji, goal, data.transactions, currency, today]);

  const save = async () => {
    if (!name.trim()) return setError("Give your goal a name.");
    if (!targetMinor) return setError("How much do you want to save?");
    setSaving(true);
    try {
      let finalAccount = accountId;
      if (accountId === NEW_ACCOUNT) {
        const account = await createAccount({ name: "Savings", type: "savings", openingBalance: parseAmount(already, currency) ?? 0 });
        finalAccount = account.id;
      }
      const input = { name, emoji, targetAmount: targetMinor, startingAmount: parseAmount(already, currency) ?? 0, targetDate: targetDate || undefined, accountId: finalAccount, color };
      if (goal) await updateGoal(goal.id, { ...input, targetDate: targetDate || "" });
      else await createGoal(input);
      void haptic("success");
      toast.success(goal ? "Goal updated" : `${emoji} ${name} goal created`);
      onDone();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <EmojiPicker label="Icon" value={emoji} onChange={setEmoji} options={GOAL_EMOJIS} />
      <Field label="Goal name" error={error && !name.trim() ? error : null}>
        {(props) => <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New phone" maxLength={40} />}
      </Field>
      <Field label="Target amount" error={error && name.trim() && !targetMinor ? error : null}>
        {(props) => <AmountInput {...props} size="xl" value={target} onValueChange={setTarget} currency={currency} />}
      </Field>
      <Field label="Target date (optional)" hint="Without a date, Owwy tracks progress without a monthly plan.">
        {(props) => <TextInput {...props} type="date" min={today} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />}
      </Field>
      <Field label="Where is this money kept?" hint="Adding money moves it into this account, so your balances stay accurate.">
        {(props) => (
          <Select {...props} value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={Boolean(goal)}>
            {savingsAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value={NEW_ACCOUNT}>+ Create a Savings card</option>
          </Select>
        )}
      </Field>
      <Field label="Already saved (optional)" hint={accountId === NEW_ACCOUNT ? "Becomes the new Savings card's starting balance." : "Money already set aside before tracking in Owwy."}>
        {(props) => <AmountInput {...props} value={already} onValueChange={setAlready} currency={currency} />}
      </Field>
      <ColorPicker label="Color" value={color} onChange={setColor} options={GOAL_COLORS} />

      {preview && preview.requiredMonthly > 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-accent-soft p-4 text-accent-soft-ink">
          <OwwyMascot mood="thinking" size={44} />
          <p className="text-callout">
            Save about <span className="font-bold">{fmt(preview.requiredMonthly)}</span> a month to reach it by {formatShortDate(targetDate, today)}.
          </p>
        </div>
      ) : null}

      <div className="flex gap-2">
        {goal ? (
          <Button
            variant="dangerSoft"
            size="xl"
            onClick={async () => {
              await deleteGoal(goal.id);
              toast.show(`${goal.name} goal removed`, { description: "The money stays in its account." });
              onDone();
            }}
          >
            Delete
          </Button>
        ) : null}
        <Button size="xl" className="flex-1" onClick={save} loading={saving}>
          {goal ? "Save changes" : "Create goal"}
        </Button>
      </div>
    </div>
  );
}

export function GoalMoneySheet({
  goal,
  mode,
  onOpenChange,
  onCompleted,
}: {
  goal: SavingsGoal | null;
  mode: "add" | "withdraw";
  onOpenChange: (open: boolean) => void;
  onCompleted: (goal: SavingsGoal) => void;
}) {
  return (
    <Sheet open={Boolean(goal)} onOpenChange={onOpenChange} title={mode === "add" ? `Add to ${goal?.name ?? "goal"}` : `Withdraw from ${goal?.name ?? "goal"}`} size="sm">
      {goal ? <GoalMoneyForm goal={goal} mode={mode} onDone={() => onOpenChange(false)} onCompleted={onCompleted} /> : null}
    </Sheet>
  );
}

function GoalMoneyForm({ goal, mode, onDone, onCompleted }: { goal: SavingsGoal; mode: "add" | "withdraw"; onDone: () => void; onCompleted: (goal: SavingsGoal) => void }) {
  const { state, data, currency, today, fmt } = useFinance();
  const others = state.mainAccounts.filter((a) => a.id !== goal.accountId && a.type !== "credit");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(others.find((a) => a.includeInSafeToSpend)?.id ?? others[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saved = goalSaved(goal, data.transactions);
  const minor = parseAmount(amount, currency) ?? 0;
  const after = mode === "add" ? saved + minor : saved - minor;
  const goalAccount = state.accountsById.get(goal.accountId);
  const fromBalance = state.balances.get(mode === "add" ? accountId : goal.accountId) ?? 0;
  const remaining = Math.max(0, goal.targetAmount - saved);

  const submit = async () => {
    if (!minor) return setError("Enter an amount.");
    if (!accountId) return setError("Choose an account.");
    if (mode === "withdraw" && minor > saved) return setError(`You can withdraw up to ${fmt(saved)}.`);
    setSaving(true);
    try {
      const fn = mode === "add" ? contributeToGoal : withdrawFromGoal;
      const result = await fn({ goalId: goal.id, accountId, amount: minor, date });
      void haptic("success");
      toast.success(mode === "add" ? `${fmt(minor)} added to ${goal.name}` : `${fmt(minor)} withdrawn`, {
        description: mode === "add" ? `Moved from ${state.accountsById.get(accountId)?.name} to ${goalAccount?.name}` : undefined,
        action: { label: "Undo", onClick: () => void deleteTransaction(result.transaction.id) },
      });
      onDone();
      if (result.completed) onCompleted(goal);
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!others.length) {
    return <p className="py-4 text-body text-ink-2">Add another account first — contributions move money from one account into {goalAccount?.name ?? "the goal's account"}.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Amount" error={error}>
        {(props) => <AmountInput {...props} size="xl" value={amount} onValueChange={(v) => { setAmount(v); setError(null); }} currency={currency} autoFocus />}
      </Field>
      {mode === "add" && remaining > 0 ? (
        <div className="-mt-1 flex flex-wrap gap-2">
          {[0.1, 0.25].map((f) => Math.round((remaining * f) / (minorFactor(currency) * 100)) * minorFactor(currency) * 100).filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).map((v) => (
            <Button key={v} size="sm" variant="secondary" onClick={() => setAmount(minorToInput(v, currency))}>
              {fmt(v)}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setAmount(minorToInput(remaining, currency))}>
            All {fmt(remaining)}
          </Button>
        </div>
      ) : null}
      <Field label={mode === "add" ? "From" : "Move to"} hint={mode === "add" ? `Balance: ${fmt(fromBalance)}` : undefined}>
        {(props) => (
          <Select {...props} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {others.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Date">{(props) => <TextInput {...props} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}</Field>

      <div className="rounded-2xl bg-surface-2 p-4">
        <div className="mb-2 flex justify-between text-callout">
          <span className="text-ink-2">After this</span>
          <span className="font-bold">
            <Money value={Math.max(0, after)} /> <span className="font-normal text-ink-3">of</span> <Money value={goal.targetAmount} />
          </span>
        </div>
        <ProgressBar value={(Math.max(0, after) / goal.targetAmount) * 100} tone="custom" color={goal.color} label="Goal progress after this change" />
      </div>

      <Button size="xl" onClick={submit} loading={saving}>
        {mode === "add" ? "Add money" : "Withdraw"}
      </Button>
    </div>
  );
}

/** A goal's story: progress, pace and every contribution or withdrawal. */
export function GoalDetailSheet({ goal, onOpenChange, onAdd }: { goal: SavingsGoal | null; onOpenChange: (open: boolean) => void; onAdd: (goal: SavingsGoal) => void }) {
  const { state, today } = useFinance();
  const live = goal ? (state.goalProgress.find((g) => g.goal.id === goal.id) ?? null) : null;
  const history = useMemo(() => {
    if (!live) return [];
    return state.transactions.map((t) => ({ tx: t, amount: goalContribution(live.goal, t) })).filter((h) => h.amount !== 0);
  }, [live, state.transactions]);

  return (
    <Sheet open={Boolean(goal)} onOpenChange={onOpenChange} title={live?.goal.name ?? "Goal"} size="sm">
      {live ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <ProgressRing value={live.percent} size={96} stroke={9} color={live.goal.color} label={`${Math.round(live.percent)}% saved`}>
              <span className="flex flex-col items-center leading-none">
                <span className="text-[26px]" aria-hidden>
                  {live.goal.emoji}
                </span>
                <span className="mt-1 text-callout font-extrabold">{Math.round(live.percent)}%</span>
              </span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-title-2 font-extrabold tracking-tight">
                <Money value={live.saved} />
              </p>
              <p className="text-callout text-ink-3">
                of <Money value={live.goal.targetAmount} />
                {live.goal.targetDate ? ` by ${formatShortDate(live.goal.targetDate, today)}` : ""}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-surface-2 p-3">
              <dt className="text-caption text-ink-3">To go</dt>
              <dd className="truncate font-bold">
                <Money value={live.remaining} />
              </dd>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <dt className="text-caption text-ink-3">Per month</dt>
              <dd className="truncate font-bold">
                <Money value={live.averageMonthly} whole />
              </dd>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <dt className="text-caption text-ink-3">Needed</dt>
              <dd className="truncate font-bold">{live.requiredMonthly > 0 ? <Money value={live.requiredMonthly} whole /> : "—"}</dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-1 text-caption font-bold tracking-wider text-ink-3 uppercase">History</h3>
            <ul className="flex flex-col divide-y divide-line/60">
              {history.map(({ tx, amount }) => (
                <li key={tx.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn("flex size-9 items-center justify-center rounded-xl text-callout font-bold", amount > 0 ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning")} aria-hidden>
                    {amount > 0 ? "+" : "−"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-callout font-semibold">{tx.note || (amount > 0 ? "Added money" : "Withdrew")}</span>
                    <span className="block text-caption text-ink-3">{formatShortDate(tx.date, today)}</span>
                  </span>
                  <Money value={amount} signed className={cn("text-callout font-bold", amount > 0 ? "text-positive" : "text-ink")} />
                </li>
              ))}
              {live.goal.startingAmount > 0 ? (
                <li className="flex items-center gap-3 py-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-[16px]" aria-hidden>
                    🌱
                  </span>
                  <span className="min-w-0 flex-1 text-callout font-semibold">Already saved when you started</span>
                  <Money value={live.goal.startingAmount} className="text-callout font-bold" />
                </li>
              ) : null}
            </ul>
            {!history.length && !live.goal.startingAmount ? <p className="py-3 text-callout text-ink-3">No money added yet — your first step starts the story.</p> : null}
          </div>

          {live.remaining > 0 ? (
            <Button size="xl" onClick={() => onAdd(live.goal)}>
              Add money
            </Button>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

export function GoalCelebration({ goal, onClose }: { goal: SavingsGoal | null; onClose: () => void }) {
  return (
    <Dialog.Root open={Boolean(goal)} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {goal ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div className="fixed inset-0 z-[60] bg-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-6">
              <Dialog.Content asChild forceMount>
                <m.div
                  className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-[28px] bg-bg-elevated p-8 text-center shadow-lg"
                  initial={{ opacity: 0, scale: 0.85, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", damping: 20, stiffness: 260 }}
                >
                  <Confetti />
                  <div className="relative">
                    <OwwyMascot mood="celebrating" size={120} animated className="mx-auto" />
                    <Dialog.Title className="mt-4 text-title-1 font-extrabold">You did it! {goal.emoji}</Dialog.Title>
                    <Dialog.Description className="mt-2 text-body text-ink-2">
                      Your <span className="font-semibold text-ink">{goal.name}</span> goal is fully funded. That took real discipline.
                    </Dialog.Description>
                    <Button size="lg" className="mt-6 w-full" onClick={onClose}>
                      Celebrate
                    </Button>
                  </div>
                </m.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 7) * 0.08,
    color: ["#E39A35", "#6CC7B3", "#F0967A", "#14463F", "#F2B458"][i % 5],
    rotate: (i * 53) % 360,
  }));
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {pieces.map((p, i) => (
        <m.span
          key={i}
          className="absolute top-0 h-3 w-1.5 rounded-sm"
          style={{ left: `${p.left}%`, background: p.color }}
          initial={{ y: -20, opacity: 0, rotate: p.rotate }}
          animate={{ y: 420, opacity: [0, 1, 1, 0], rotate: p.rotate + 360 }}
          transition={{ duration: 1.8, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
