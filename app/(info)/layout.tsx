import Link from "@/components/ui/app-link";
import { BackLink } from "@/components/ui/back-link";
import { OwwyMark } from "@/components/owwy/owwy-mascot";

export default function InfoLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-bg/85 pt-[var(--safe-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          {/* These pages are reachable from Settings and from More, so the
              chevron returns wherever you actually came from; Settings is
              only the fallback for a deep link or a reload. */}
          <BackLink href="/settings/" anyPrevious />
          <Link href="/" className="flex items-center gap-2">
            <OwwyMark size={24} />
            <span className="font-extrabold tracking-tight">owwy</span>
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-2xl px-5 py-8 pb-[calc(40px+var(--safe-bottom))]">
        {children}
      </main>
    </div>
  );
}
