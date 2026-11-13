import Link from "@/components/ui/app-link";
import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger" | "dangerSoft" | "hero";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink shadow-sm hover:bg-brand-hover",
  accent: "bg-accent text-accent-ink shadow-sm hover:brightness-105",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3",
  outline: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-negative text-white shadow-sm hover:brightness-110",
  dangerSoft: "bg-negative-soft text-negative hover:brightness-95",
  hero: "bg-white/14 text-hero-ink backdrop-blur-sm hover:bg-white/20 ring-1 ring-inset ring-white/15",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 rounded-full px-3.5 text-callout",
  md: "h-11 gap-2 rounded-full px-5 text-body",
  lg: "h-12 gap-2 rounded-2xl px-6 text-body",
  xl: "h-14 gap-2 rounded-2xl px-6 text-[1.0625rem]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "press inline-flex select-none items-center justify-center whitespace-nowrap font-semibold outline-none",
    "disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "ghost" | "secondary" | "surface" | "hero";
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = "md", className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "press inline-flex shrink-0 items-center justify-center rounded-full outline-none disabled:opacity-40",
        size === "md" ? "size-11 [&_svg]:size-[22px]" : "size-9 [&_svg]:size-[18px]",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        variant === "secondary" && "bg-surface-2 text-ink hover:bg-surface-3",
        variant === "surface" && "border border-line bg-surface text-ink shadow-xs hover:bg-surface-2",
        variant === "hero" && "bg-white/12 text-hero-ink hover:bg-white/20",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
