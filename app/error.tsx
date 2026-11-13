"use client";

import Link from "@/components/ui/app-link";
import { useEffect } from "react";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";

/** Route-level error boundary. Data is safe on the device; only this view failed. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-bg px-8 text-center" role="alert">
      <OwwyMascot mood="concerned" size={104} />
      <h1 className="font-display mt-5 text-[1.75rem]">Something went sideways</h1>
      <p className="mt-2 max-w-sm text-body text-ink-2">This screen hit a problem. Your data is still safely stored on this device.</p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={reset} className="press h-11 rounded-full bg-brand px-6 font-semibold text-brand-ink">
          Try again
        </button>
        <Link href="/" className="press inline-flex h-11 items-center rounded-full bg-surface-2 px-6 font-semibold">
          Go home
        </Link>
      </div>
    </main>
  );
}
