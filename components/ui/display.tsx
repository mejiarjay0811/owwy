"use client";

import { ChevronRight } from "lucide-react";
import Link from "@/components/ui/app-link";
import { useEffect, useRef, useState } from "react";
import { useOptionalFinance } from "@/hooks/use-finance";
import { formatMoney, type FormatMoneyOptions } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import type { CurrencyCode, Minor } from "@/types/models";
import { OwwyMascot, type OwwyMood } from "../owwy/owwy-mascot";

/* ---------------------------------------------------------------- Money */

interface MoneyProps extends FormatMoneyOptions {
  value: Minor;
  className?: string;
  /** Color by sign: income green, expense default. */
  tone?: "auto" | "positive" | "negative" | "muted" | "inherit";
  /** Ignore hide-balance mode (e.g. inside a form the user is typing). */
  alwaysShow?: boolean;
  /** Animate from the previous value. */
  animate?: boolean;
  /** Show in this currency instead of the main one (e.g. a USD account). */
  currency?: CurrencyCode;
}

/** Every amount in Owwy renders through this: currency-aware, tabular, and hideable. */
export function Money({ value, className, tone = "inherit", alwaysShow, animate, currency, ...options }: MoneyProps) {
  const finance = useOptionalFinance();
  const animated = useAnimatedNumber(value, Boolean(animate));
  if (!finance) return null;
  const hidden = finance.hidden && !alwaysShow;
  const format = (minor: number) => (currency && currency !== finance.currency ? formatMoney(minor, currency, { trimZeros: true, ...options }) : finance.fmt(minor, options));
  const text = format(animate ? animated : value);

  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        tone === "positive" && "text-positive",
        tone === "negative" && "text-negative",
        tone === "muted" && "text-ink-3",
        tone === "auto" && (value > 0 ? "text-positive" : value < 0 ? "text-negative" : ""),
        className,
      )}
      aria-label={hidden ? "Hidden amount" : format(value)}
    >
      {hidden ? <span aria-hidden>{options.signed && value !== 0 ? (value > 0 ? "+" : "−") : ""}••••••</span> : <span aria-hidden={animate || undefined}>{text}</span>}
    </span>
  );
}

function useAnimatedNumber(target: number, enabled: boolean): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const animate = enabled && typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!animate) {
      from.current = target;
      return;
    }
    const start = performance.now();
    const initial = from.current;
    const duration = Math.min(900, 350 + Math.abs(target - initial) / 5000);
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(initial + (target - initial) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, animate]);

  return animate ? value : target;
}

/* ---------------------------------------------------------------- Card & sections */

export function Card({ className, children, as: Tag = "div", ...props }: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "li" }) {
  return (
    <Tag className={cn("rounded-[22px] border border-line/70 bg-surface shadow-xs", className)} {...props}>
      {children}
    </Tag>
  );
}

export function SectionHeader({
  title,
  href,
  actionLabel = "See all",
  action,
  className,
  eyebrow,
  id,
}: {
  title: string;
  href?: string;
  actionLabel?: string;
  action?: React.ReactNode;
  className?: string;
  eyebrow?: boolean;
  id?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 id={id} className={cn(eyebrow ? "text-eyebrow font-bold tracking-[0.09em] text-ink-3 uppercase" : "font-display text-[1.1875rem] leading-snug text-ink")}>
        {title}
      </h2>
      {action ??
        (href ? (
          <Link href={href} className="press -mr-2 inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-callout font-semibold text-brand hover:bg-brand-soft">
            {actionLabel}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null)}
    </div>
  );
}

/* ---------------------------------------------------------------- Progress */

type ProgressTone = "brand" | "positive" | "warning" | "negative" | "accent" | "custom";

const TONE_BG: Record<Exclude<ProgressTone, "custom">, string> = {
  brand: "bg-brand",
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
  accent: "bg-accent",
};

export function ProgressBar({
  value,
  tone = "brand",
  color,
  className,
  label,
  marker,
  height = "h-2",
}: {
  /** 0–100; values above 100 render full with an overflow tone. */
  value: number;
  tone?: ProgressTone;
  color?: string;
  className?: string;
  label: string;
  /** Optional marker position (0–100), e.g. how far the month has elapsed. */
  marker?: number;
  height?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const width = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn("relative w-full overflow-hidden rounded-full bg-surface-3/80", height, className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-[var(--ease-soft)]", tone !== "custom" && TONE_BG[tone])}
        style={{ width: mounted ? `${width}%` : "0%", background: tone === "custom" ? color : undefined }}
      />
      {marker !== undefined && marker > 0 && marker < 100 ? (
        <span className="absolute top-0 h-full w-0.5 rounded-full bg-ink/25" style={{ left: `${marker}%` }} aria-hidden />
      ) : null}
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  color = "var(--brand)",
  track = "var(--surface-3)",
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
  label: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? circumference * (1 - pct / 100) : circumference}
          style={{ transition: "stroke-dashoffset 900ms var(--ease-soft)" }}
        />
      </svg>
      {children ? <div className="absolute inset-0 flex items-center justify-center">{children}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Badges, tiles */

type BadgeTone = "neutral" | "positive" | "negative" | "warning" | "brand" | "accent" | "info";

const BADGE: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  warning: "bg-warning-soft text-warning",
  brand: "bg-brand-soft text-brand-soft-ink",
  accent: "bg-accent-soft text-accent-soft-ink",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: BadgeTone; children: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-caption font-semibold whitespace-nowrap [&_svg]:size-3.5", BADGE[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** Emoji on a softly tinted tile, tinted by the category/goal color. */
export function EmojiTile({ emoji, color, size = "md", className }: { emoji: string; color?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[14px] leading-none",
        size === "sm" && "size-9 rounded-xl text-[18px]",
        size === "md" && "size-11 text-[22px]",
        size === "lg" && "size-14 rounded-[18px] text-[28px]",
        !color && "bg-surface-2",
        className,
      )}
      style={color ? { background: `color-mix(in srgb, ${color} 16%, transparent)` } : undefined}
      aria-hidden
    >
      {emoji}
    </span>
  );
}

/* ---------------------------------------------------------------- Empty state & Owwy bubble */

export function EmptyState({
  mood = "sleeping",
  title,
  description,
  action,
  className,
  compact,
}: {
  mood?: OwwyMood;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 text-center", compact ? "py-6" : "py-12", className)}>
      <OwwyMascot mood={mood} size={compact ? 64 : 96} animated className="text-ink" />
      <h3 className={cn("font-display mt-4 text-ink", compact ? "text-title-2" : "text-[1.5rem] leading-tight")}>{title}</h3>
      {description ? <p className="mt-1.5 max-w-xs text-body text-ink-2 text-balance">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function OwwySays({ mood, children, className, tone = "surface", size = 44 }: { mood: OwwyMood; children: React.ReactNode; className?: string; tone?: "surface" | "hero"; size?: number }) {
  return (
    <div className={cn("flex items-end gap-2.5", className)}>
      <OwwyMascot mood={mood} size={size} animated />
      <div
        className={cn(
          "relative mb-1 min-w-0 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-callout font-medium",
          tone === "hero" ? "bg-hero-fill text-hero-ink ring-1 ring-hero-line ring-inset" : "bg-surface-2 text-ink",
        )}
      >
        <span className="sr-only">Owwy says: </span>
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden />;
}

/** Small legend-style stat: label over value. */
export function Stat({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-caption font-semibold text-ink-3">{label}</p>
      <p className="mt-0.5 truncate text-title-3 font-bold">{children}</p>
      {hint ? <div className="mt-0.5 text-caption text-ink-3">{hint}</div> : null}
    </div>
  );
}
