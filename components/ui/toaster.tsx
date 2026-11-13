"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { useUI, type ToastItem } from "@/stores/ui";

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 bottom-[calc(var(--nav-height)+var(--safe-bottom)+24px)] lg:bottom-6 lg:left-auto lg:right-6 lg:items-end"
      aria-live="polite"
      aria-relevant="additions"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastView({ toast }: { toast: ToastItem }) {
  const dismiss = useUI((s) => s.dismissToast);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ type: "spring", damping: 30, stiffness: 420 }}
      role={toast.tone === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-2xl py-3 pr-2 pl-4 shadow-lg",
        "bg-[#15211f] text-[#f4f1e8] dark:bg-[#eef2ef] dark:text-[#0f1817]",
      )}
    >
      {toast.tone === "success" ? <CircleCheck className="size-5 shrink-0 text-[#6cc7b3] dark:text-[#1d7f55]" aria-hidden /> : null}
      {toast.tone === "error" ? <CircleAlert className="size-5 shrink-0 text-[#f08270] dark:text-[#c2412f]" aria-hidden /> : null}
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-callout font-semibold">{toast.message}</p>
        {toast.description ? <p className="text-caption opacity-75">{toast.description}</p> : null}
      </div>
      {toast.action ? (
        <button
          type="button"
          className="press h-9 shrink-0 rounded-full px-3.5 text-callout font-bold text-[#f2b458] hover:bg-white/10 dark:text-[#b9700f] dark:hover:bg-black/5"
          onClick={async () => {
            dismiss(toast.id);
            await toast.action?.onClick();
          }}
        >
          {toast.action.label}
        </button>
      ) : (
        <span className="w-2" />
      )}
    </m.div>
  );
}
