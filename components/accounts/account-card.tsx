"use client";

import { OwwyMark } from "@/components/owwy/owwy-mascot";
import { Money } from "@/components/ui/display";
import { ACCOUNT_TYPES, getCardStyle } from "@/lib/defaults/card-styles";
import { cn } from "@/lib/utils/cn";
import type { AccountType, CardPattern, CurrencyCode, Minor } from "@/types/models";

export interface AccountCardData {
  name: string;
  type: AccountType;
  balance: Minor;
  cardStyle: string;
  cardPattern: CardPattern;
  last4?: string;
  creditLimit?: Minor;
  includeInSafeToSpend?: boolean;
  archived?: boolean;
  currency?: CurrencyCode;
  dueDay?: number;
  interestRate?: number;
}

interface AccountCardProps {
  account: AccountCardData;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  /** Accessible description when the card is interactive. */
  label?: string;
  /** Optional overlay control, e.g. a "…" quick-actions menu. */
  menu?: React.ReactNode;
  /** Lets a stacked card drop out of the tab order while it sits behind others. */
  tabIndex?: number;
  hidden?: boolean;
}

/**
 * A conceptual financial card — Owwy's own finish, never a replica of a real
 * bank or e-wallet card. No chip, no network logo, no full numbers.
 */
export function AccountCard({ account, size = "md", className, onClick, label, menu, tabIndex, hidden }: AccountCardProps) {
  const style = getCardStyle(account.cardStyle);
  const info = ACCOUNT_TYPES[account.type];
  const light = style.tone === "light";
  const owed = info.liability ? Math.max(0, -account.balance) : 0;
  const usage = info.liability && account.creditLimit ? Math.min(100, (owed / account.creditLimit) * 100) : null;
  const available = info.liability && account.creditLimit ? Math.max(0, account.creditLimit - owed) : null;

  const Tag = onClick ? "button" : "div";

  // The menu is a sibling of the card button (never nested inside it) for valid, accessible markup.
  const card = (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={onClick ? label : undefined}
      tabIndex={tabIndex}
      aria-hidden={hidden || undefined}
      className={cn(
        "group relative isolate flex aspect-[1.62] w-full flex-col overflow-hidden text-left outline-none select-none",
        size === "sm" ? "rounded-[18px] p-3.5" : size === "md" ? "rounded-[24px] p-5" : "rounded-[28px] p-6",
        onClick && "press cursor-pointer transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5",
        light ? "text-[#2b2418]" : "text-white",
        account.archived && "opacity-60 grayscale-[35%]",
        className,
      )}
      style={{ background: style.background, boxShadow: `0 1px 1px rgba(0,0,0,0.06), 0 14px 32px -14px ${style.glow}` }}
    >
      <CardPattern pattern={account.cardPattern} light={light} />
      <span className="card-sheen pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <span className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] ring-1 ring-white/10 ring-inset" aria-hidden />

      <span className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full font-semibold backdrop-blur-sm",
            size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-caption",
            light ? "bg-black/5" : "bg-white/14",
          )}
        >
          <span aria-hidden>{info.emoji}</span>
          {info.label}
          {account.currency ? <span className="opacity-80">· {account.currency}</span> : null}
        </span>
        {menu ? (
          <span className={size === "sm" ? "size-7" : "size-9"} aria-hidden />
        ) : (
          <span className={cn("flex items-center gap-1 font-extrabold tracking-[0.14em]", size === "sm" ? "text-[9px]" : "text-[11px]", light ? "opacity-70" : "opacity-85")}>
            <OwwyMark size={size === "sm" ? 14 : 18} tone={light ? "dark" : "light"} />
            OWWY
          </span>
        )}
      </span>

      <span className="mt-auto flex flex-col">
        <span className={cn("truncate font-semibold", size === "sm" ? "text-caption" : "text-callout", light ? "opacity-75" : "opacity-80")}>
          {account.name}
          {account.interestRate ? <span className="opacity-80"> · {account.interestRate}% yearly</span> : null}
        </span>
        <span className={cn("font-bold tracking-tight", size === "sm" ? "text-title-3" : size === "md" ? "text-[1.75rem] leading-tight" : "text-[2.125rem] leading-tight")}>
          <Money value={info.liability ? owed : account.balance} currency={account.currency} />
          {info.liability ? <span className={cn("ml-1.5 font-semibold opacity-70", size === "sm" ? "text-caption" : "text-callout")}>owed</span> : null}
        </span>
      </span>

      <span className={cn("mt-2 flex items-center justify-between gap-2 font-medium", size === "sm" ? "text-[10px]" : "text-caption", light ? "opacity-70" : "opacity-75")}>
        <span className="tabular truncate tracking-[0.18em]">
          {account.last4 ? `•••• ${account.last4}` : info.liability && account.dueDay ? "" : info.hint}
          {info.liability && account.dueDay ? <span className="tracking-normal">{account.last4 ? " · " : ""}due day {account.dueDay}</span> : null}
        </span>
        {usage !== null ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <span className={cn("h-1 w-12 overflow-hidden rounded-full", light ? "bg-black/10" : "bg-white/20")}>
              <span className="block h-full rounded-full bg-current" style={{ width: `${usage}%` }} />
            </span>
            {available !== null && size !== "sm" ? (
              <>
                <Money value={available} currency={account.currency} /> left
              </>
            ) : (
              `${Math.round(usage)}% used`
            )}
          </span>
        ) : account.includeInSafeToSpend === false && !info.liability ? (
          <span className="shrink-0">Not in spending</span>
        ) : null}
      </span>
    </Tag>
  );

  if (!menu) return card;
  return (
    <div className="relative">
      {card}
      <div className={cn("absolute z-10", size === "sm" ? "top-2.5 right-2.5" : "top-3.5 right-3.5")}>{menu}</div>
    </div>
  );
}

function CardPattern({ pattern, light }: { pattern: CardPattern; light: boolean }) {
  if (pattern === "none") return null;
  const stroke = light ? "rgba(90,70,40,0.14)" : "rgba(255,255,255,0.13)";
  return (
    <svg className="pointer-events-none absolute inset-0 -z-10 size-full" viewBox="0 0 340 210" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {pattern === "feathers" && (
        <g fill="none" stroke={stroke} strokeWidth="1.4">
          {Array.from({ length: 6 }).map((_, row) =>
            Array.from({ length: 6 - Math.max(0, row - 1) }).map((__, col) => {
              const x = 340 - col * 26 - (row % 2) * 13;
              const y = 210 - row * 17;
              return <path key={`${row}-${col}`} d={`M${x - 13} ${y} a13 13 0 0 1 26 0`} />;
            }),
          )}
        </g>
      )}
      {pattern === "waves" && (
        <g fill="none" stroke={stroke} strokeWidth="1.4">
          {Array.from({ length: 7 }).map((_, i) => (
            <path key={i} d={`M-10 ${120 + i * 14} C 70 ${90 + i * 14}, 150 ${160 + i * 14}, 230 ${118 + i * 14} S 330 ${100 + i * 14}, 360 ${112 + i * 14}`} />
          ))}
        </g>
      )}
      {pattern === "dots" && (
        <g fill={stroke}>
          {[
            [250, 40, 1.6], [290, 70, 1.1], [318, 30, 2], [270, 110, 1.3], [210, 60, 1], [305, 140, 1.6], [230, 150, 1.1],
            [180, 30, 1.2], [330, 180, 1.2], [150, 90, 0.9], [120, 170, 1.4], [200, 190, 1],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r * 1.6} />
          ))}
          <circle cx="292" cy="58" r="26" fill="none" stroke={stroke} strokeWidth="1.2" />
        </g>
      )}
    </svg>
  );
}

/** Horizontally scrolling wallet of cards. */
export function AccountCarousel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pt-1 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6", className)}
      role="list"
    >
      {children}
    </div>
  );
}
