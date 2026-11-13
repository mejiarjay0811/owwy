"use client";

import { ChevronDown } from "lucide-react";
import { m } from "motion/react";
import { forwardRef, useId } from "react";
import { getCurrency } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import type { CurrencyCode } from "@/types/models";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
  className?: string;
  hideLabel?: boolean;
  trailing?: React.ReactNode;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, children, className, hideLabel, trailing }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className={cn("flex items-center justify-between", hideLabel && "sr-only")}>
        <label htmlFor={id} className="text-callout font-semibold text-ink-2">
          {label}
        </label>
        {trailing}
      </div>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption font-medium text-negative">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-[14px] border border-transparent bg-surface-2 px-4 text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-brand focus:bg-surface aria-[invalid=true]:border-negative";

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(inputClass, "appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  );
});

interface AmountInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "size"> {
  value: string;
  onValueChange: (value: string) => void;
  currency: CurrencyCode;
  size?: "md" | "xl";
}

/** Large, friendly amount field. Accepts "1,240.50" and keeps only valid characters. */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { value, onValueChange, currency, size = "md", className, ...props },
  ref,
) {
  const info = getCurrency(currency);
  const sanitize = (raw: string) => {
    let next = raw.replace(/[^\d.,]/g, "").replace(/,/g, "");
    if (info.decimals === 0) next = next.replace(/\./g, "");
    const [whole, ...rest] = next.split(".");
    if (rest.length) next = `${whole}.${rest.join("").slice(0, info.decimals)}`;
    return next.slice(0, 13);
  };
  const display = formatWithGrouping(value);

  return (
    <div
      className={cn(
        "flex items-center rounded-[18px] border border-transparent bg-surface-2 transition-colors focus-within:border-brand focus-within:bg-surface has-[input[aria-invalid=true]]:border-negative",
        size === "xl" ? "h-[76px] px-5" : "h-12 px-4",
        className,
      )}
    >
      <span className={cn("font-semibold text-ink-3", size === "xl" ? "mr-2 text-[2rem]" : "mr-1.5 text-body")} aria-hidden>
        {info.symbol}
      </span>
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        placeholder="0"
        value={display}
        onChange={(e) => onValueChange(sanitize(e.target.value))}
        // Opts out of the 16px floor in globals.css: this field is far
        // larger than 16px, so it never triggers iOS focus zoom anyway.
        data-text-size={size === "xl" ? "xl" : undefined}
        className={cn(
          "tabular w-full min-w-0 bg-transparent font-bold tracking-tight text-ink outline-none placeholder:text-ink-3/60",
          size === "xl" ? "text-[2.5rem] leading-none" : "text-body",
        )}
        {...props}
      />
    </div>
  );
});

function formatWithGrouping(value: string): string {
  if (!value) return "";
  const [whole, decimals] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals !== undefined ? `${grouped}.${decimals}` : grouped;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}

export function Segmented<T extends string>({ value, onChange, options, label, className, size = "md" }: SegmentedProps<T>) {
  const group = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-full bg-surface-2 p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              const index = options.findIndex((o) => o.value === value);
              if (e.key === "ArrowRight" || e.key === "ArrowDown") onChange(options[(index + 1) % options.length].value);
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") onChange(options[(index - 1 + options.length) % options.length].value);
            }}
            tabIndex={active ? 0 : -1}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors outline-none [&_svg]:size-4",
              size === "md" ? "h-10 px-3 text-callout" : "h-8 px-2.5 text-caption",
              active ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {active && (
              <m.span
                layoutId={`seg-${group}`}
                className="absolute inset-0 rounded-full bg-surface shadow-sm"
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function SwitchRow({ checked, onCheckedChange, label, description, disabled, icon }: SwitchProps) {
  const id = useId();
  return (
    <div className={cn("flex min-h-14 items-center gap-3 py-2", disabled && "opacity-50")}>
      {icon}
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-body font-semibold">
          {label}
        </label>
        {description ? <p className="text-callout text-ink-3">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200 outline-none",
          checked ? "bg-brand" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] left-[3px] size-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-soft)]",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  tone?: "default" | "brand";
}

export function Chip({ selected, className, children, tone = "default", ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-callout font-semibold outline-none",
        selected
          ? tone === "brand"
            ? "border-brand bg-brand text-brand-ink"
            : "border-ink bg-ink text-ink-inverse"
          : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
