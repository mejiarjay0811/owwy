"use client";

import { Camera, ImageIcon, RefreshCw, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/display";
import { AmountInput, Chip, Field, TextInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useFinance } from "@/hooks/use-finance";
import { minorToInput, parseAmount } from "@/lib/money";
import { haptic } from "@/lib/platform";
import { readPriceTag } from "@/lib/receipts/price-tag";
import { readReceiptText, releaseScanner, scanningSupported, type ScanProgress } from "@/lib/receipts";
import type { Minor } from "@/types/models";

export interface ScannedPrice {
  label: string;
  price: Minor;
}

/** Point the camera at a shelf tag; Owwy reads the price on the device. */
export function ScanPriceSheet({ open, onOpenChange, onUse }: { open: boolean; onOpenChange: (open: boolean) => void; onUse: (item: ScannedPrice) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Scan a price tag" description="Read on this device — the photo never leaves your phone." size="sm">
      {open ? <ScanPrice onUse={onUse} onDone={() => onOpenChange(false)} /> : null}
    </Sheet>
  );
}

function ScanPrice({ onUse, onDone }: { onUse: (item: ScannedPrice) => void; onDone: () => void }) {
  const { currency, fmt } = useFinance();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"choose" | "reading" | "review" | "failed">("choose");
  const [progress, setProgress] = useState<ScanProgress>({ label: "Getting ready", progress: 0 });
  const [alternatives, setAlternatives] = useState<Minor[]>([]);
  const [price, setPrice] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void releaseScanner(), []);

  const start = async (file: File) => {
    setStage("reading");
    setError(null);
    try {
      const text = await readReceiptText(file, setProgress);
      const reading = readPriceTag(text, currency);
      setPrice(reading.price ? minorToInput(reading.price, currency) : "");
      setLabel(reading.label ?? "");
      setAlternatives(reading.alternatives);
      setStage("review");
      void haptic(reading.price ? "success" : "warning");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Owwy couldn't read that tag.");
      setStage("failed");
    }
  };

  const inputs = (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void start(f); }} />
      <input ref={gallery} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void start(f); }} />
    </>
  );

  if (!scanningSupported()) {
    return (
      <div className="py-6 text-center">
        <p className="text-body text-ink-2">This browser can&apos;t scan. Type the price instead — it&apos;s just as quick.</p>
        <Button className="mt-4" onClick={onDone}>
          Type it
        </Button>
      </div>
    );
  }

  if (stage === "reading") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <OwwyMascot mood="thinking" size={56} animated />
        <p className="text-body font-semibold">{progress.label}…</p>
        <ProgressBar value={Math.round(progress.progress * 100)} label={progress.label} className="max-w-xs" />
      </div>
    );
  }

  if (stage === "failed") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        {inputs}
        <OwwyMascot mood="concerned" size={56} />
        <p className="text-body font-semibold">{error}</p>
        <Button size="lg" onClick={() => camera.current?.click()}>
          <RefreshCw />
          Try again
        </Button>
        <Button size="lg" variant="secondary" onClick={onDone}>
          Type it instead
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
          <p className="mt-3 text-body font-semibold">Fill the frame with the tag</p>
          <p className="mt-1 text-callout text-ink-2">Owwy takes the largest number as the price, and shows you the others in case it picked wrong.</p>
        </div>
        <Button size="xl" onClick={() => camera.current?.click()}>
          <Camera />
          Take a photo
        </Button>
        <Button size="xl" variant="secondary" onClick={() => gallery.current?.click()}>
          <ImageIcon />
          Choose a photo
        </Button>
      </div>
    );
  }

  const minor = parseAmount(price, currency) ?? 0;
  return (
    <div className="flex flex-col gap-4">
      {inputs}
      <Field label="Price">
        {(props) => <AmountInput {...props} size="xl" value={price} onValueChange={setPrice} currency={currency} autoFocus={!minor} />}
      </Field>
      {alternatives.length ? (
        <div>
          <p className="mb-1.5 text-caption text-ink-3">Other numbers on the tag:</p>
          <div className="flex flex-wrap gap-2">
            {alternatives.map((value) => (
              <Chip key={value} selected={minor === value} onClick={() => setPrice(minorToInput(value, currency))}>
                {fmt(value)}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      <Field label="Item">{(props) => <TextInput {...props} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Rice 5kg" maxLength={60} autoFocus={Boolean(minor)} />}</Field>
      <div className="flex gap-2">
        <Button variant="secondary" size="xl" onClick={() => camera.current?.click()} aria-label="Scan another tag" className="px-4">
          <RefreshCw />
        </Button>
        <Button
          size="xl"
          className="flex-1"
          disabled={minor <= 0 || !label.trim()}
          onClick={() => {
            onUse({ label: label.trim(), price: minor });
            onDone();
          }}
        >
          {minor > 0 ? `Add ${fmt(minor)}` : "Enter a price"}
        </Button>
      </div>
    </div>
  );
}
