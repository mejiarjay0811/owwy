"use client";

import { Camera, ChevronDown, ImageIcon, RefreshCw, ScanLine, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Button } from "@/components/ui/button";
import { Money, ProgressBar } from "@/components/ui/display";
import { AmountInput, Chip, Field, Select, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { addDays, formatShortDate } from "@/lib/dates";
import { minorToInput, parseAmount } from "@/lib/money";
import { haptic } from "@/lib/platform";
import { releaseScanner, scanningSupported, scanReceipt, type ReceiptScan, type ScanProgress } from "@/lib/receipts";
import { cn } from "@/lib/utils/cn";
import type { ID, ISODate } from "@/types/models";

export interface ScannedReceipt {
  /** The photo, so it can be attached to the transaction. */
  file: File;
  amount: string;
  note: string;
  date: ISODate;
  categoryId?: ID;
}

type Stage = "choose" | "reading" | "review" | "failed";

/**
 * Scan a receipt: Owwy reads the photo on this device, then fills in the shop,
 * the total, the date and the category for you to confirm.
 */
export function ScanReceiptSheet({ open, onOpenChange, onUse }: { open: boolean; onOpenChange: (open: boolean) => void; onUse: (result: ScannedReceipt) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Scan a receipt" description="The photo is read on this device and never leaves it." size="sm">
      {open ? <ScanReceipt onUse={onUse} onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function ScanReceipt({ onUse, onDone }: { onUse: (result: ScannedReceipt) => void; onDone: () => void }) {
  const { state, data, currency, today, fmt } = useFinance();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("choose");
  const [progress, setProgress] = useState<ScanProgress>({ label: "Getting ready", progress: 0 });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<ReceiptScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);

  // Editable review fields.
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState<ISODate>(today);
  const [categoryId, setCategoryId] = useState<ID | undefined>();

  const expenseCategories = state.categories.filter((c) => c.kind === "expense" && !c.archived);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);
  // The OCR engine holds a few MB; let it go when the sheet closes.
  useEffect(() => () => void releaseScanner(), []);

  const start = async (chosen: File) => {
    setFile(chosen);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(chosen);
    });
    setStage("reading");
    setError(null);
    setProgress({ label: "Getting ready", progress: 0 });
    try {
      const result = await scanReceipt(chosen, { categories: state.categories, transactions: data.transactions, currency, today }, setProgress);
      setScan(result);
      setAmount(result.total ? minorToInput(result.total, currency) : "");
      setNote(result.merchant ?? "");
      setDate(result.date ?? today);
      setCategoryId(result.guess.confidence >= 0.6 ? (result.guess.categoryId ?? undefined) : undefined);
      setStage("review");
      void haptic(result.total ? "success" : "warning");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Owwy couldn't read this photo.");
      setStage("failed");
    }
  };

  const pick = (input: HTMLInputElement | null) => input?.click();

  const inputs = (
    <>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          e.target.value = "";
          if (chosen) void start(chosen);
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          e.target.value = "";
          if (chosen) void start(chosen);
        }}
      />
    </>
  );

  if (!scanningSupported()) {
    return (
      <div className="py-6 text-center">
        <p className="text-body text-ink-2">This browser can&apos;t scan receipts. You can still add the expense by hand and attach the photo.</p>
        <Button className="mt-4" onClick={onDone}>
          Add it by hand
        </Button>
      </div>
    );
  }

  if (stage === "choose") {
    return (
      <div className="flex flex-col gap-4">
        {inputs}
        <div className="flex flex-col items-center rounded-[22px] bg-surface-2 px-5 py-6 text-center">
          <ScanLine className="size-8 text-brand" aria-hidden />
          <p className="mt-3 text-body font-semibold">Point at the whole receipt</p>
          <p className="mt-1 text-callout text-ink-2">Flat, well lit, edge to edge. Owwy reads the shop, the total and the date, then picks a category from how you usually file it.</p>
        </div>
        <Button size="xl" onClick={() => pick(cameraInput.current)}>
          <Camera />
          Take a photo
        </Button>
        <Button size="xl" variant="secondary" onClick={() => pick(galleryInput.current)}>
          <ImageIcon />
          Choose from photos
        </Button>
        <p className="text-caption text-ink-3">The first scan downloads Owwy&apos;s reader (about 7 MB). After that it works offline.</p>
      </div>
    );
  }

  if (stage === "reading") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL
          <img src={preview} alt="" className="max-h-44 rounded-2xl border border-line/70 object-contain" />
        ) : null}
        <OwwyMascot mood="thinking" size={56} animated />
        <p className="text-body font-semibold">{progress.label}…</p>
        <ProgressBar value={Math.round(progress.progress * 100)} label={progress.label} className="max-w-xs" />
        <p className="text-caption text-ink-3">Reading happens on your device, so it can take a few seconds.</p>
      </div>
    );
  }

  if (stage === "failed") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <OwwyMascot mood="concerned" size={56} />
        <p className="text-body font-semibold">{error}</p>
        <p className="text-callout text-ink-2">Try again with more light, or add the expense by hand.</p>
        <div className="flex w-full flex-col gap-2">
          {inputs}
          <Button size="lg" onClick={() => pick(cameraInput.current)}>
            <RefreshCw />
            Try another photo
          </Button>
          <Button size="lg" variant="secondary" onClick={onDone}>
            Add it by hand
          </Button>
        </div>
      </div>
    );
  }

  const minor = parseAmount(amount, currency) ?? 0;
  const guess = scan?.guess;
  const chips = [...new Set([...(guess?.categoryId ? [guess.categoryId] : []), ...(guess?.alternatives ?? [])])].slice(0, 4);
  const unreadTotal = !scan?.total;
  const doubtful = Boolean(scan?.totalLooksOff);

  return (
    <div className="flex flex-col gap-4">
      {inputs}
      <div className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL
          <img src={preview} alt="Receipt" className="size-16 shrink-0 rounded-xl border border-line/70 object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-callout font-bold">
            <Sparkles className="size-4 text-accent" aria-hidden />
            {unreadTotal ? "I couldn't find the total" : doubtful ? "Please check this total" : "Here's what I read"}
          </p>
          <p className="text-caption text-ink-2">
            {unreadTotal
              ? "Type the amount and I'll take care of the rest."
              : doubtful
                ? "It's smaller than one of the lines on the receipt, so I may have misread it."
                : guess?.detail ?? "Check the details below — nothing is saved until you confirm."}
          </p>
          {/* The line the amount came from: the fastest way to spot a misread. */}
          {scan?.totalLine && !unreadTotal ? <p className="mt-1 truncate font-mono text-caption text-ink-3">“{scan.totalLine}”</p> : null}
        </div>
      </div>

      <Field label="Amount">
        {(props) => <AmountInput {...props} size="xl" value={amount} onValueChange={setAmount} currency={currency} autoFocus={unreadTotal} />}
      </Field>

      <Field label="Shop or note">{(props) => <TextInput {...props} value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="e.g. Puregold" />}</Field>

      <fieldset>
        <legend className="mb-2 text-callout font-semibold text-ink-2">Category</legend>
        {chips.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {chips.map((id) => {
              const category = state.categoriesById.get(id);
              if (!category) return null;
              return (
                <Chip key={id} selected={categoryId === id} onClick={() => setCategoryId(id)}>
                  {category.emoji} {category.name}
                  {id === guess?.categoryId && guess.confidence >= 0.8 ? <span aria-label="Owwy's pick">✦</span> : null}
                </Chip>
              );
            })}
          </div>
        ) : null}
        <Select value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value || undefined)} aria-label="Category">
          <option value="">Choose a category…</option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </Select>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-callout font-semibold text-ink-2">Date</legend>
        <div className="flex flex-wrap items-center gap-2">
          <Chip selected={date === today} onClick={() => setDate(today)}>
            Today
          </Chip>
          <Chip selected={date === addDays(today, -1)} onClick={() => setDate(addDays(today, -1))}>
            Yesterday
          </Chip>
          <label
            className={cn(
              "relative inline-flex h-9 items-center rounded-full border px-3.5 text-callout font-semibold",
              date !== today && date !== addDays(today, -1) ? "border-ink bg-ink text-ink-inverse" : "border-line bg-surface text-ink-2",
            )}
          >
            {date !== today && date !== addDays(today, -1) ? formatShortDate(date, today) : "Pick a date"}
            <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Receipt date" />
          </label>
          {scan?.date ? <span className="text-caption text-ink-3">Printed: {formatShortDate(scan.date, today)}</span> : null}
        </div>
      </fieldset>

      {scan?.items.length ? (
        <div>
          <button type="button" onClick={() => setShowText((v) => !v)} className="inline-flex items-center gap-1 text-callout font-semibold text-brand" aria-expanded={showText}>
            {showText ? "Hide" : `What I read · ${scan.items.length} lines`}
            <ChevronDown className={cn("size-4 transition-transform", showText && "rotate-180")} aria-hidden />
          </button>
          {showText ? (
            <ul className="mt-2 flex flex-col divide-y divide-line/60 rounded-2xl bg-surface-2 px-3">
              {scan.items.map((item, i) => (
                <li key={`${item.label}-${i}`} className="flex items-center justify-between gap-3 py-2 text-callout">
                  <span className="min-w-0 flex-1 truncate text-ink-2">{item.label}</span>
                  <Money value={item.amount} className="font-semibold" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line/60 bg-bg-elevated px-5 pt-3 pb-1">
        <Button variant="secondary" size="xl" onClick={() => pick(cameraInput.current)} aria-label="Scan another photo" className="px-4">
          <RefreshCw />
        </Button>
        <Button
          size="xl"
          className="flex-1"
          disabled={minor <= 0}
          onClick={() => {
            if (!file || minor <= 0) return;
            onUse({ file, amount, note, date, categoryId });
            onDone();
          }}
        >
          {minor > 0 ? `Use ${fmt(minor)}` : "Enter an amount"}
        </Button>
      </div>
    </div>
  );
}
