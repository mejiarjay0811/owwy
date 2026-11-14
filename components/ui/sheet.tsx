"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AnimatePresence, m, useDragControls, type PanInfo } from "motion/react";
import { useIsTabletUp } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils/cn";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Visually hide the title (still announced to screen readers). */
  hideTitle?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  headerAction?: React.ReactNode;
}

/**
 * Bottom sheet on phones (drag the handle down to dismiss), centered dialog on
 * tablets and desktop. Built on Radix Dialog for focus trapping, Escape, and
 * screen reader semantics.
 */
export function Sheet({ open, onOpenChange, title, description, hideTitle, children, footer, size = "md", className, headerAction }: SheetProps) {
  const wide = useIsTabletUp();
  const controls = useDragControls();

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            {/* The keyboard no longer shrinks the layout, so the sheet makes
                its own room: it sits above the keyboard and loses the same
                height from its cap, which keeps the footer on screen. */}
            <div
              className={cn("pointer-events-none fixed inset-0 z-50 flex justify-center", wide ? "items-center p-6" : "items-end")}
              style={{ paddingBottom: wide ? undefined : "var(--kb)" }}
            >
              <Dialog.Content
                asChild
                forceMount
                {...(description ? {} : { "aria-describedby": undefined })}
                // On phones, don't pop the keyboard open the moment a sheet appears.
                onOpenAutoFocus={(e) => wide || e.preventDefault()}
              >
                <m.div
                  className={cn(
                    "pointer-events-auto relative flex w-full flex-col bg-bg-elevated text-ink shadow-lg outline-none",
                    wide
                      ? cn("max-h-[min(88dvh,860px)] rounded-2xl border border-line", size === "sm" && "max-w-md", size === "md" && "max-w-lg", size === "lg" && "max-w-2xl")
                      : "max-h-[calc(92dvh-var(--kb))] rounded-t-[28px] border-t border-line",
                    className,
                  )}
                  initial={wide ? { opacity: 0, scale: 0.96, y: 8 } : { y: "100%" }}
                  animate={wide ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
                  exit={wide ? { opacity: 0, scale: 0.97, y: 6 } : { y: "100%" }}
                  transition={wide ? { duration: 0.2, ease: [0.22, 1, 0.36, 1] } : { type: "spring", damping: 34, stiffness: 380, mass: 0.9 }}
                  drag={wide ? false : "y"}
                  dragControls={controls}
                  dragListener={false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.6 }}
                  onDragEnd={onDragEnd}
                >
                  {!wide && (
                    <div
                      className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                      onPointerDown={(e) => controls.start(e)}
                      aria-hidden
                    >
                      <span className="h-1.5 w-10 rounded-full bg-line-strong" />
                    </div>
                  )}
                  <div className={cn("flex shrink-0 items-start gap-3 px-5", wide ? "pt-5 pb-3" : "pb-3", hideTitle && "pb-0")}
                    onPointerDown={(e) => !wide && controls.start(e)}
                  >
                    <div className={cn("min-w-0 flex-1", hideTitle && "sr-only")}>
                      <Dialog.Title className="font-display text-[1.375rem] leading-tight text-ink">{title}</Dialog.Title>
                      {description ? <Dialog.Description className="mt-0.5 text-callout text-ink-2">{description}</Dialog.Description> : null}
                    </div>
                    {headerAction}
                    <Dialog.Close
                      className={cn("press -mr-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2 hover:text-ink", hideTitle && "ml-auto")}
                      aria-label="Close"
                    >
                      <X className="size-[18px]" />
                    </Dialog.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
                  {footer ? (
                    <div className={cn("shrink-0 border-t border-line/70 bg-bg-elevated px-5 pt-3", wide ? "pb-5 rounded-b-2xl" : "pb-[calc(12px+var(--safe-bottom))]")}>
                      {footer}
                    </div>
                  ) : (
                    !wide && <div className="h-[var(--safe-bottom)] shrink-0" />
                  )}
                </m.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
