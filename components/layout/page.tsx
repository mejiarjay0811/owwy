"use client";

import { ChevronLeft } from "lucide-react";
import Link from "@/components/ui/app-link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

export function Page({ children, width = "default", className }: { children: React.ReactNode; width?: "narrow" | "default" | "wide"; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-10",
        width === "narrow" && "max-w-[640px]",
        width === "default" && "max-w-[640px] lg:max-w-[880px]",
        width === "wide" && "max-w-[640px] md:max-w-[760px] lg:max-w-[1180px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Shows a back button on phones (desktop uses the sidebar). */
  back?: string;
  actions?: React.ReactNode;
  className?: string;
}

/** Sticky, translucent header that tightens once the page scrolls. */
export function PageHeader({ title, subtitle, back, actions, className }: PageHeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "no-print sticky top-0 z-30 -mx-4 mb-2 px-4 pt-[var(--safe-top)] transition-[background-color,box-shadow] duration-200 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mb-4 lg:px-0 lg:pt-8",
        scrolled ? "bg-bg/85 shadow-[0_1px_0_var(--line)] backdrop-blur-xl lg:bg-transparent lg:shadow-none lg:backdrop-blur-none" : "bg-transparent",
        className,
      )}
    >
      <div className="flex min-h-14 items-center gap-2 py-2">
        {back ? (
          <Link
            href={back}
            aria-label="Back"
            className="press -ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface-2 lg:hidden"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-[1.75rem] leading-tight">{title}</h1>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {subtitle ? <div className={cn("-mt-1 pb-2 text-callout text-ink-2 transition-opacity", scrolled && "max-lg:hidden")}>{subtitle}</div> : null}
    </header>
  );
}

/** Month switcher: ‹ September 2026 › */
export function MonthSwitcher({
  label,
  onPrevious,
  onNext,
  nextDisabled,
  className,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-xs", className)}>
      <button type="button" onClick={onPrevious} aria-label="Previous month" className="press inline-flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2">
        <ChevronLeft className="size-[18px]" aria-hidden />
      </button>
      <span className="min-w-[8.5rem] text-center text-callout font-bold" aria-live="polite">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label="Next month"
        className="press inline-flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 disabled:opacity-30"
      >
        <ChevronLeft className="size-[18px] rotate-180" aria-hidden />
      </button>
    </div>
  );
}
