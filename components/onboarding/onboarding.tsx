"use client";

import { ChevronLeft, Lock } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountCard } from "@/components/accounts/account-card";
import { Splash } from "@/components/layout/app-shell";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Button } from "@/components/ui/button";
import { AmountInput, Chip, Field, TextInput } from "@/components/ui/form";
import { useFinanceStatus, useOptionalFinance } from "@/hooks/use-finance";
import { ACCOUNT_TYPES } from "@/lib/defaults/card-styles";
import { CURRENCY_LIST, getCurrency, parseAmount } from "@/lib/money";
import { requestPersistentStorage } from "@/lib/platform";
import { loadDemoData } from "@/lib/services/demo";
import { createAccount } from "@/lib/storage/repositories/accounts";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";
import type { AccountType, CurrencyCode, MainGoal, PayFrequency } from "@/types/models";

const STEPS = 5;

const FREQUENCIES: { value: PayFrequency; label: string; hint: string }[] = [
  { value: "monthly", label: "Monthly", hint: "Once a month" },
  { value: "semimonthly", label: "Twice a month", hint: "e.g. every 15th and 30th" },
  { value: "biweekly", label: "Every two weeks", hint: "Every other Friday, say" },
  { value: "weekly", label: "Weekly", hint: "Every week" },
  { value: "irregular", label: "Irregular", hint: "Freelance, business, or it varies" },
];

const GOALS: { value: MainGoal; emoji: string; label: string; hint: string }[] = [
  { value: "save", emoji: "🐷", label: "Save money", hint: "Build up savings for something" },
  { value: "control", emoji: "🧭", label: "Control spending", hint: "Stop wondering where it went" },
  { value: "debt", emoji: "🪜", label: "Pay off debt", hint: "Get to zero, step by step" },
  { value: "understand", emoji: "🔍", label: "Understand my finances", hint: "See the full picture" },
  { value: "other", emoji: "✨", label: "Something else", hint: "Owwy will adapt" },
];

const FIRST_ACCOUNT_TYPES: AccountType[] = ["cash", "bank", "ewallet", "credit"];

export function Onboarding() {
  const status = useFinanceStatus();
  const finance = useOptionalFinance();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("PHP");
  const [frequency, setFrequency] = useState<PayFrequency>("semimonthly");
  const [paydays, setPaydays] = useState<number[]>([15, 31]);
  const [anchorDate, setAnchorDate] = useState("");
  const [goal, setGoal] = useState<MainGoal>("understand");
  const [accountType, setAccountType] = useState<AccountType>("bank");
  const [accountName, setAccountName] = useState("");
  const [balance, setBalance] = useState("");
  const [busy, setBusy] = useState(false);

  const onboarded = finance?.settings.onboarded;
  useEffect(() => {
    if (onboarded && !busy) router.replace("/");
  }, [onboarded, busy, router]);

  if (status !== "ready" || onboarded) return <Splash />;

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const finish = async (withAccount: boolean) => {
    setBusy(true);
    try {
      await updateSettings({
        displayName: name.trim(),
        currency,
        locale: getCurrency(currency).locale,
        mainGoal: goal,
        income: { frequency, paydays: frequency === "monthly" ? paydays.slice(0, 1) : frequency === "semimonthly" ? paydays.slice(0, 2) : [], anchorDate: anchorDate || undefined },
      });
      if (withAccount) {
        await createAccount({
          name: accountName.trim() || defaultAccountName(accountType),
          type: accountType,
          openingBalance: parseAmount(balance, currency) ?? 0,
        });
      }
      await updateSettings({ onboarded: true });
      void requestPersistentStorage();
      router.replace("/");
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    await updateSettings({ onboarded: true, displayName: name.trim(), currency });
    router.replace("/");
  };

  const explore = async () => {
    setBusy(true);
    try {
      await loadDemoData(finance!.today);
      void requestPersistentStorage();
      router.replace("/");
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5">
        {step > 0 ? (
          <div className="flex items-center gap-3 pt-3">
            <button type="button" onClick={() => go(step - 1)} aria-label="Back" className="press -ml-2 inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-2">
              <ChevronLeft className="size-6" />
            </button>
            <div className="flex flex-1 gap-1.5" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1}>
              {Array.from({ length: STEPS }).map((_, i) => (
                <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-brand" : "bg-surface-3")} />
              ))}
            </div>
            <button type="button" onClick={skip} className="text-callout font-semibold text-ink-3 hover:text-ink" disabled={busy}>
              Skip
            </button>
          </div>
        ) : null}

        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <m.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -28 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-1 flex-col"
          >
            {step === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <OwwyMascot mood="happy" size={148} animated label="Owwy the owl" />
                <p className="mt-6 text-eyebrow font-bold tracking-[0.14em] text-accent-soft-ink uppercase">Meet Owwy</p>
                <h1 className="font-display mt-2 text-[2.5rem] leading-tight text-balance">Hi! I&apos;m Owwy.</h1>
                <p className="mt-3 max-w-xs text-[1.0625rem] text-ink-2 text-balance">Let&apos;s make your money easier to understand — and figure out where it&apos;s going.</p>
                <div className="mt-10 flex w-full flex-col gap-2.5">
                  <Button size="xl" onClick={() => go(1)}>
                    Let&apos;s go
                  </Button>
                  <Button size="xl" variant="secondary" onClick={explore} loading={busy}>
                    Explore with sample data
                  </Button>
                  <button type="button" onClick={skip} disabled={busy} className="mt-1 h-10 text-callout font-semibold text-ink-3 hover:text-ink">
                    Skip setup
                  </button>
                </div>
                <p className="mt-6 flex items-center gap-1.5 text-caption text-ink-3">
                  <Lock className="size-3.5" aria-hidden />
                  No account needed. Your data stays on this device.
                </p>
              </div>
            )}

            {step === 1 && (
              <StepLayout title="First, the basics" subtitle="What should I call you, and which currency do you use?" onNext={() => go(2)}>
                <Field label="Your name (optional)">
                  {(props) => <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Arjay" maxLength={40} autoComplete="given-name" />}
                </Field>
                <fieldset className="mt-5">
                  <legend className="mb-2 text-callout font-semibold text-ink-2">Currency</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {CURRENCY_LIST.map((c) => (
                      <OptionCard key={c.code} selected={currency === c.code} onClick={() => setCurrency(c.code)}>
                        <span className="text-[22px]" aria-hidden>{c.flag}</span>
                        <span className="min-w-0 text-left">
                          <span className="block font-bold">
                            {c.symbol} {c.code}
                          </span>
                          <span className="block truncate text-caption text-ink-3">{c.name}</span>
                        </span>
                      </OptionCard>
                    ))}
                  </div>
                </fieldset>
              </StepLayout>
            )}

            {step === 2 && (
              <StepLayout title="How often do you get paid?" subtitle="This tells Owwy how long your money needs to last." onNext={() => go(3)}>
                <div className="flex flex-col gap-2">
                  {FREQUENCIES.map((f) => (
                    <OptionCard
                      key={f.value}
                      selected={frequency === f.value}
                      onClick={() => {
                        setFrequency(f.value);
                        if (f.value === "monthly") setPaydays([30]);
                        if (f.value === "semimonthly") setPaydays([15, 31]);
                      }}
                    >
                      <span className="text-left">
                        <span className="block font-bold">{f.label}</span>
                        <span className="block text-caption text-ink-3">{f.hint}</span>
                      </span>
                    </OptionCard>
                  ))}
                </div>
                {frequency === "monthly" && (
                  <PaydayPicker label="Payday" options={[[1], [5], [10], [15], [25], [30]]} value={paydays} onChange={setPaydays} />
                )}
                {frequency === "semimonthly" && (
                  <PaydayPicker label="Paydays" options={[[15, 31], [10, 25], [5, 20], [1, 15]]} value={paydays} onChange={setPaydays} />
                )}
                {(frequency === "weekly" || frequency === "biweekly") && (
                  <Field label="Your next payday" className="mt-5">
                    {(props) => <TextInput {...props} type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />}
                  </Field>
                )}
              </StepLayout>
            )}

            {step === 3 && (
              <StepLayout title="What matters most right now?" subtitle="Owwy will focus its tips on this." onNext={() => go(4)}>
                <div className="flex flex-col gap-2">
                  {GOALS.map((g) => (
                    <OptionCard key={g.value} selected={goal === g.value} onClick={() => setGoal(g.value)}>
                      <span className="text-[26px]" aria-hidden>{g.emoji}</span>
                      <span className="text-left">
                        <span className="block font-bold">{g.label}</span>
                        <span className="block text-caption text-ink-3">{g.hint}</span>
                      </span>
                    </OptionCard>
                  ))}
                </div>
              </StepLayout>
            )}

            {step === 4 && (
              <StepLayout
                title="Add your first account"
                subtitle="Where do you keep most of your everyday money?"
                nextLabel="Finish"
                onNext={() => finish(true)}
                busy={busy}
                secondary={
                  <button type="button" onClick={() => finish(false)} disabled={busy} className="h-10 text-callout font-semibold text-ink-3 hover:text-ink">
                    I&apos;ll do this later
                  </button>
                }
              >
                <div className="mx-auto mb-5 w-full max-w-[300px]">
                  <AccountCard
                    account={{
                      name: accountName || defaultAccountName(accountType),
                      type: accountType,
                      balance: (parseAmount(balance, currency) ?? 0) * (ACCOUNT_TYPES[accountType].liability ? -1 : 1),
                      cardStyle: ACCOUNT_TYPES[accountType].defaultStyle,
                      cardPattern: "feathers",
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {FIRST_ACCOUNT_TYPES.map((t) => (
                    <Chip key={t} selected={accountType === t} onClick={() => setAccountType(t)}>
                      {ACCOUNT_TYPES[t].emoji} {ACCOUNT_TYPES[t].label}
                    </Chip>
                  ))}
                </div>
                <Field label="Account name" className="mt-5">
                  {(props) => <TextInput {...props} value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder={defaultAccountName(accountType)} maxLength={40} />}
                </Field>
                <Field label={ACCOUNT_TYPES[accountType].liability ? "Amount owed" : "Current balance"} className="mt-4" hint="A rough number is fine — you can adjust it later.">
                  {(props) => <AmountInput {...props} value={balance} onValueChange={setBalance} currency={currency} />}
                </Field>
              </StepLayout>
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function defaultAccountName(type: AccountType): string {
  return { cash: "Cash", bank: "Main Wallet", ewallet: "E-wallet", credit: "Credit Card" }[type as "cash"] ?? ACCOUNT_TYPES[type].label;
}

function StepLayout({
  title,
  subtitle,
  children,
  onNext,
  nextLabel = "Continue",
  busy,
  secondary,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onNext: () => void;
  nextLabel?: string;
  busy?: boolean;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col pt-6">
      <h1 className="font-display text-[2rem] leading-tight text-balance">{title}</h1>
      <p className="mt-2 text-body text-ink-2">{subtitle}</p>
      <div className="mt-6 flex-1">{children}</div>
      <div className="sticky bottom-0 mt-6 flex flex-col items-center gap-1 bg-bg pt-3 pb-4">
        <Button size="xl" className="w-full" onClick={onNext} loading={busy}>
          {nextLabel}
        </Button>
        {secondary}
      </div>
    </div>
  );
}

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "press flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 outline-none",
        selected ? "border-brand bg-brand-soft/60" : "border-line/70 bg-surface hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}

function PaydayPicker({ label, options, value, onChange }: { label: string; options: number[][]; value: number[]; onChange: (v: number[]) => void }) {
  const text = (days: number[]) => days.map((d) => (d >= 30 ? (days.length > 1 ? "30th/end" : "30th") : ordinal(d))).join(" & ");
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-callout font-semibold text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.join("-")} selected={o.join() === value.join()} onClick={() => onChange(o)}>
            {text(o)}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
