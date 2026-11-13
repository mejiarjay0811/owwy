"use client";

import { ChartColumn, Ellipsis, House, Lock, Plus, Wallet } from "lucide-react";
import Link from "@/components/ui/app-link";
import { usePathname, useRouter } from "next/navigation";
import { OwwyMark } from "@/components/owwy/owwy-mascot";
import { useFinance } from "@/hooks/use-finance";
import { haptic } from "@/lib/platform";
import { cn } from "@/lib/utils/cn";
import { useUI } from "@/stores/ui";
import { isActive, MORE_ITEMS, SETTINGS_ITEM, SIDEBAR_PRIMARY, SIDEBAR_SECONDARY, type NavItem } from "./nav-items";

/**
 * Mobile navigation: a floating glass pill (Home · Wallet · Ask · Stats · More)
 * with a separate round Add button, so logging is always one tap away.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const openAdd = useUI((s) => s.openAddTransaction);
  const askActive = isActive(pathname, "/ask/");
  const moreActive = pathname.startsWith("/more") || [...MORE_ITEMS, SETTINGS_ITEM].some((i) => isActive(pathname, i.href) && i.href !== "/accounts/");

  const tabs = [
    { href: "/", label: "Home", icon: House, active: isActive(pathname, "/") },
    { href: "/accounts/", label: "Wallet", icon: Wallet, active: isActive(pathname, "/accounts/") },
    null,
    { href: "/insights/", label: "Stats", icon: ChartColumn, active: isActive(pathname, "/insights/") || pathname.startsWith("/review") },
    { href: "/more/", label: "More", icon: Ellipsis, active: moreActive },
  ];

  return (
    <nav aria-label="Main" className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(10px+var(--safe-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-2.5">
        <ul className="glass pointer-events-auto flex h-[var(--nav-height)] flex-1 items-stretch gap-0.5 rounded-[28px] border border-line/80 p-1.5 shadow-lg">
          {tabs.map((tab) =>
            tab === null ? (
              <li key="ask" className="flex flex-1">
                <button
                  type="button"
                  onClick={() => {
                    void haptic("light");
                    router.push("/ask/");
                  }}
                  aria-label="Ask Owwy — log or ask anything"
                  aria-current={askActive ? "page" : undefined}
                  className={cn("press flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[11px] font-semibold", askActive ? "bg-brand-soft text-brand-soft-ink" : "text-ink-3")}
                >
                  <OwwyMark size={24} />
                  Ask
                </button>
              </li>
            ) : (
              <li key={tab.href} className="flex flex-1">
                <Link
                  href={tab.href}
                  aria-current={tab.active ? "page" : undefined}
                  className={cn(
                    "press flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[11px] font-semibold transition-colors",
                    tab.active ? "bg-brand-soft text-brand-soft-ink" : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  <tab.icon className="size-[21px]" strokeWidth={tab.active ? 2.3 : 2} aria-hidden />
                  {tab.label}
                </Link>
              </li>
            ),
          )}
        </ul>
        <button
          type="button"
          onClick={() => {
            void haptic("light");
            openAdd();
          }}
          aria-label="Add transaction"
          className="press pointer-events-auto flex size-[var(--nav-height)] shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink shadow-[0_12px_28px_-10px_rgb(20_70_63/0.7)] dark:shadow-[0_12px_28px_-10px_rgb(0_0_0/0.8)]"
        >
          <Plus className="size-7" strokeWidth={2.4} />
        </button>
      </div>
    </nav>
  );
}

/** Desktop sidebar: the full app, one click away. */
export function Sidebar() {
  const pathname = usePathname();
  const openAdd = useUI((s) => s.openAddTransaction);
  const { settings } = useFinance();

  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-r border-line/70 bg-bg-elevated/60 px-4 pt-6 pb-5 lg:flex">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-2" aria-label="Owwy home">
        <OwwyMark size={34} />
        <span className="text-[1.375rem] font-extrabold tracking-tight">owwy</span>
      </Link>

      <button
        type="button"
        onClick={() => openAdd()}
        className="press mb-6 flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-brand-ink shadow-sm hover:bg-brand-hover"
      >
        <Plus className="size-5" strokeWidth={2.4} aria-hidden />
        Add transaction
        <kbd className="ml-1 rounded-md bg-white/15 px-1.5 text-caption font-medium">N</kbd>
      </button>

      <nav aria-label="Main" className="no-scrollbar -mx-1 flex-1 overflow-y-auto px-1">
        <NavList items={SIDEBAR_PRIMARY} pathname={pathname} />
        <p className="mt-6 mb-2 px-3 text-eyebrow font-bold tracking-[0.09em] text-ink-3 uppercase">Plan</p>
        <NavList items={SIDEBAR_SECONDARY} pathname={pathname} />
      </nav>

      <div className="mt-4 border-t border-line/70 pt-4">
        <NavList items={[SETTINGS_ITEM]} pathname={pathname} />
        <p className="mt-3 flex items-center gap-2 px-3 text-caption text-ink-3">
          <Lock className="size-3.5" aria-hidden />
          {settings.security.pinEnabled ? "App lock on · " : ""}Stored on this device
        </p>
      </div>
    </aside>
  );
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href) || (item.href === "/insights/" && pathname.startsWith("/review"));
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-callout font-semibold transition-colors",
                active ? "bg-brand-soft text-brand-soft-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <item.icon className="size-[18px]" strokeWidth={active ? 2.3 : 2} aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
