"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/app-link";
import { isBackTo, previousPath } from "@/lib/nav-history";
import { cn } from "@/lib/utils/cn";

/**
 * The header's back chevron.
 *
 * A plain `<Link>` here is a forward navigation: it pushes a new entry, so
 * the screen you return to starts at the top and you've lost your place in a
 * long list. When the chevron points at exactly the screen you came from,
 * this goes back through history instead, which restores the scroll position
 * with it (see hooks/use-scroll-restoration).
 *
 * It stays a real link: a deep link, a reload, or a long-press to open in a
 * new tab all still work, and the decision is made at the moment of the tap.
 */
export function BackLink({
  href,
  label = "Back",
  className,
  anyPrevious = false,
}: {
  href: string;
  label?: string;
  className?: string;
  /**
   * Go back to whatever the previous screen was, not only when it matches
   * `href`. For headers whose `href` is a sensible default rather than a
   * true parent — Privacy is reachable from both Settings and More, and
   * either is a correct place to return to.
   */
  anyPrevious?: boolean;
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      aria-label={label}
      onClick={(event) => {
        // Let the browser handle modified clicks (new tab, download, …).
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (!(anyPrevious ? Boolean(previousPath()) : isBackTo(href))) return;
        event.preventDefault();
        router.back();
      }}
      className={cn(
        "press hit -ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface-2",
        className,
      )}
    >
      <ChevronLeft className="size-6" aria-hidden />
    </Link>
  );
}
