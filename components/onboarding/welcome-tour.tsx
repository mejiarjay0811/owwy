"use client";

import { AnimatePresence, m } from "motion/react";
import { Check, Lock, ScanLine, SlidersHorizontal, Sparkles, Trees, Wallet } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Button } from "@/components/ui/button";
import { updateSettings } from "@/lib/storage/repositories/settings";

interface Step {
  /** `data-tour` value of the element to spotlight, or null for a plain card. */
  target: string | null;
  icon: React.ReactNode;
  title: string;
  body: string;
  /** Extra breathing room around the cut-out, for targets that sit flush. */
  pad?: number;
}

/**
 * The first-run guide, as coach marks over the real screen.
 *
 * A carousel of screenshots can describe the app; it can't point at it. Each
 * step here dims everything except one actual element and explains that
 * element in place, so "the Grove" is learned by seeing the Grove lit up
 * rather than by reading a description of it.
 *
 * A step whose target is missing from the page is skipped rather than
 * spotlighting empty space — the nav and the hero are not on every route.
 */
const STEPS: Step[] = [
  {
    target: "grove",
    icon: <Trees className="size-5" />,
    title: "This is the Grove",
    body: "Every category you spend on grows into a tree. One look tells you the shape of your month before you read a number — and you can drag back through earlier days.",
    pad: 0,
  },
  {
    target: "composer",
    icon: <Sparkles className="size-5" />,
    title: "Type it the way you'd say it",
    body: "“coffee at a shop 180 gcash” fills in the amount, the note, the category and the account by itself. Check it, save it.",
  },
  {
    target: "safe",
    icon: <Wallet className="size-5" />,
    title: "Safe to Spend is the real number",
    body: "Your balance minus bills, debt minimums, savings and goal money, up to your next payday. Tap it to see every line that was subtracted.",
  },
  {
    target: "add",
    icon: <ScanLine className="size-5" />,
    title: "Add anything from here",
    body: "Log an expense by hand, or photograph a receipt — Owwy reads the shop, total and date on the device and never uploads the photo.",
    pad: 6,
  },
  {
    target: "customize",
    icon: <SlidersHorizontal className="size-5" />,
    title: "Make this screen yours",
    body: "Home is built from sections — Safe to Spend, bills, goals. Tap Customize home to hide the ones you don't use and drag the rest into the order you want. The Grove, a forest of your spending, lives here too — it's off on phones because it fills the screen. Settings › Appearance has the colours.",
    pad: 6,
  },
  {
    target: null,
    icon: <Lock className="size-5" />,
    title: "All of it stays on this device",
    body: "No account, no server, no ads. Which also means the backups are yours: Settings has a one-tap export, and Owwy keeps seven days of snapshots.",
  },
];

interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

const GAP = 14;
const CARD_MAX = 420;

/** The steps that have something to point at right now. */
const stepsOn = (doc: Document) => STEPS.filter((s) => !s.target || doc.querySelector(`[data-tour="${s.target}"]`));

const sameSteps = (a: Step[], b: Step[]) => a.length === b.length && a.every((s, i) => s.title === b[i].title);

export function WelcomeTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [steps, setSteps] = useState<Step[]>(STEPS);

  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  const finish = useCallback(() => {
    void updateSettings({ tourSeen: true });
    setIndex(0);
    setSpot(null);
    setSteps(STEPS);
    onClose();
  }, [onClose]);

  const next = useCallback(() => {
    if (last) finish();
    else setIndex((i) => i + 1);
  }, [last, finish]);

  // A step with nothing to point at would dim the screen and explain the
  // Grove while no Grove is on it. Drop those, and keep re-checking for a
  // second: a replay asked for from More sends you home first, and the
  // targets only exist once that route has mounted.
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    let ticks = 0;
    const resolve = () => {
      const present = stepsOn(document);
      setSteps((current) => (sameSteps(current, present) ? current : present));
      if (++ticks < 60) frame = requestAnimationFrame(resolve);
    };
    frame = requestAnimationFrame(resolve);
    return () => cancelAnimationFrame(frame);
  }, [open, pathname]);

  // Measure the target once it has scrolled into view. Every state write goes
  // through the animation frame — measuring is an effect's job, but setting
  // state synchronously inside one costs an extra render pass.
  useLayoutEffect(() => {
    if (!open) return;
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });

    const measure = () => {
      if (!el) {
        setSpot(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const pad = step.pad ?? 8;
      setSpot({
        top: r.top - pad,
        left: r.left - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
        radius: Math.min(28, Number.parseFloat(getComputedStyle(el).borderRadius) || 20) + pad,
      });
    };

    // Keep re-measuring for a few frames while the smooth scroll settles.
    let frame = 0;
    let ticks = 0;
    const tick = () => {
      measure();
      if (++ticks < 40) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [open, step]);

  // The page behind must not scroll away from the thing being pointed at.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, finish, next]);

  if (!open) return null;

  // Below the spotlight when there's room, otherwise above it.
  const viewportH = typeof window === "undefined" ? 800 : window.innerHeight;
  const below = spot ? spot.top + spot.height + GAP : 0;
  const placeBelow = spot ? viewportH - below > 300 : false;

  // Positioning lives on a plain wrapper, never on the animated element:
  // Motion writes its own `transform` for the entrance, which would wipe out
  // any translate used for centring and shove the card off-screen.
  const anchorStyle: React.CSSProperties = spot
    ? placeBelow
      ? { top: below }
      : { bottom: viewportH - spot.top + GAP }
    : { top: 0, bottom: 0, alignItems: "center" };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`Tour step ${index + 1} of ${steps.length}: ${step.title}`}>
      {/* The dim is one enormous shadow around the cut-out, so the real screen
          shows through the hole rather than being covered by a copy of it. */}
      <m.div
        key={step.target ?? "centered"}
        className="absolute"
        initial={false}
        animate={
          spot
            ? { top: spot.top, left: spot.left, width: spot.width, height: spot.height, borderRadius: spot.radius }
            : { top: viewportH / 2, left: "50%", width: 0, height: 0, borderRadius: 0 }
        }
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        style={{ boxShadow: "0 0 0 9999px rgb(5 12 10 / 0.76)", pointerEvents: "none" }}
      />

      {/* Tapping the dim advances, the way a coach mark should. */}
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Next step" onClick={next} />

      <div className="absolute right-4 left-4 flex justify-center" style={anchorStyle}>
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full rounded-[24px] border border-line/70 bg-bg-elevated p-5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)]"
            style={{ maxWidth: CARD_MAX }}
          >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-soft-ink">{step.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-caption font-bold tracking-wide text-brand uppercase">
                Step {index + 1} of {steps.length}
              </p>
              <h2 className="mt-0.5 text-title-3 font-extrabold tracking-tight">{step.title}</h2>
            </div>
          </div>

          <p className="mt-3 text-callout text-ink-2">{step.body}</p>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1.5" aria-hidden>
              {steps.map((s, i) => (
                <span key={s.title} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-brand" : "w-1.5 bg-line-strong"}`} />
              ))}
            </div>
            {!last ? (
              <button type="button" onClick={finish} className="press min-h-11 px-3 text-callout font-semibold text-ink-3">
                Skip
              </button>
            ) : null}
            <Button size="md" onClick={next}>
              {last ? (
                <>
                  <Check />
                  Start
                </>
              ) : (
                "Next"
              )}
            </Button>
          </div>

          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-caption text-ink-3">
            <OwwyMascot mood="happy" size={16} />
              Replay this any time from More.
            </p>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
