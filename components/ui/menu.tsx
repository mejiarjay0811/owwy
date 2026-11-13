"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
}

/**
 * A small popover menu: opens from its trigger, closes on outside press or
 * Escape, and supports arrow-key navigation.
 */
export function Menu({ label, items, children, className, align = "end", tone = "surface" }: { label: string; items: MenuItem[]; children: React.ReactNode; className?: string; align?: "start" | "end"; tone?: "surface" | "glass" }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    const frame = requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus());
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  const move = (delta: number) => {
    const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(index + delta + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          "press inline-flex size-9 items-center justify-center rounded-full [&_svg]:size-[18px]",
          tone === "glass" ? "bg-black/20 text-white backdrop-blur-md hover:bg-black/30" : "text-ink-2 hover:bg-surface-2",
        )}
      >
        {children}
      </button>
      <AnimatePresence>
        {open ? (
          <m.div
            ref={list}
            id={id}
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
            transition={{ type: "spring", damping: 28, stiffness: 520 }}
            style={{ transformOrigin: align === "end" ? "top right" : "top left" }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                move(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                move(-1);
              } else if (e.key === "Tab") setOpen(false);
            }}
            className={cn("absolute top-full z-30 mt-1.5 min-w-[196px] rounded-2xl border border-line/80 bg-bg-elevated p-1.5 shadow-lg", align === "end" ? "right-0" : "left-0")}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-callout font-semibold outline-none hover:bg-surface-2 focus-visible:bg-surface-2 [&_svg]:size-[18px]",
                  item.destructive ? "text-negative" : "text-ink",
                )}
              >
                <span className={cn("shrink-0", item.destructive ? "text-negative" : "text-ink-3")} aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
