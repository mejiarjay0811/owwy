"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OwwyMascot, OwwyMark } from "@/components/owwy/owwy-mascot";
import { useFinance, useFinanceError, useFinanceStatus } from "@/hooks/use-finance";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { useUI } from "@/stores/ui";
import { LockGate } from "./lock-screen";
import { BottomNav, Sidebar } from "./navigation";

// The transaction sheet is heavy and only needed on demand.
const TransactionSheet = dynamic(() => import("@/components/transactions/transaction-sheet").then((m) => m.TransactionSheet), { ssr: false });
const ReminderSync = dynamic(() => import("@/components/bills/reminder-sync").then((m) => m.ReminderSync), { ssr: false });
const WelcomeTour = dynamic(() => import("@/components/onboarding/welcome-tour").then((m) => m.WelcomeTour), { ssr: false });

export function AppShell({ children }: { children: React.ReactNode }) {
  const status = useFinanceStatus();
  const error = useFinanceError();
  if (status === "error") return <StorageError message={error ?? ""} />;
  if (status === "loading") return <Splash />;
  return <ReadyShell>{children}</ReadyShell>;
}

function ReadyShell({ children }: { children: React.ReactNode }) {
  const { settings } = useFinance();
  const router = useRouter();
  const openAdd = useUI((s) => s.openAddTransaction);
  const sheetOpen = useUI((s) => s.transactionSheet.open);

  useEffect(() => {
    if (!settings.onboarded) router.replace("/welcome/");
  }, [settings.onboarded, router]);

  // Desktop shortcut: N adds a transaction.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || sheetOpen) return;
      if (target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        openAdd();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAdd, sheetOpen]);

  // Top of the page when you go somewhere new; back where you were when you
  // press Back. See hooks/use-scroll-restoration.
  useScrollRestoration();

  // The tour shows once the app itself is on screen — not over the welcome
  // flow. Derived rather than set in an effect, so closing it is instant and
  // there's no second render pass to open it. Replays asked for elsewhere
  // (More) come through the same place, so there is only ever one tour.
  const [tourDismissed, setTourDismissed] = useState(false);
  const tourRequested = useUI((s) => s.tourRequested);
  const clearTour = useUI((s) => s.clearTour);
  const tourOpen = tourRequested || (settings.onboarded && !settings.tourSeen && !tourDismissed);

  if (!settings.onboarded) return <Splash />;

  return (
    <LockGate>
      <div className="lg:flex">
        <Sidebar />
        <main id="main" className="min-h-dvh min-w-0 flex-1 pb-nav lg:pb-12">
          {children}
        </main>
      </div>
      <BottomNav />
      <TransactionSheet />
      <ReminderSync />
      {/* Shown once, the first time someone reaches the app proper. */}
      <WelcomeTour
        open={tourOpen}
        onClose={() => {
          setTourDismissed(true);
          clearTour();
        }}
      />
    </LockGate>
  );
}

export function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg" role="status" aria-label="Opening Owwy">
      <div className="animate-pop">
        <OwwyMark size={56} />
      </div>
      <span className="text-title-3 font-extrabold tracking-tight text-ink">owwy</span>
    </div>
  );
}

function StorageError({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-8 text-center" role="alert">
      <OwwyMascot mood="concerned" size={96} />
      <h1 className="mt-5 text-title-2 font-bold">Owwy can&apos;t reach your data</h1>
      <p className="mt-2 max-w-sm text-body text-ink-2">{message}</p>
      <button type="button" onClick={() => window.location.reload()} className="press mt-6 h-11 rounded-full bg-brand px-6 font-semibold text-brand-ink">
        Try again
      </button>
    </div>
  );
}
