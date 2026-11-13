"use client";

import { AnimatePresence, m } from "motion/react";
import { Check, ChevronLeft, Lock, MessageCircleQuestion, ScanLine, Sparkles, Trees, Wallet } from "lucide-react";
import { useState } from "react";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { updateSettings } from "@/lib/storage/repositories/settings";

interface Step {
  icon: React.ReactNode;
  title: string;
  body: string;
  /** Where in the app this lives, so the tour points somewhere real. */
  where: string;
}

/**
 * The first-run guide.
 *
 * Owwy puts a lot on one screen, and most of it is not self-explanatory — a
 * forest that stands for a budget least of all. Six cards, each naming one
 * part and where to find it. Every claim here matches something the app
 * actually does; nothing is aspirational.
 */
const STEPS: Step[] = [
  {
    icon: <Trees className="size-6" />,
    title: "The Grove is your month",
    body: "Each category you spend on grows into a tree. A glance tells you the shape of your month before you read a single number, and you can drag back through earlier days.",
    where: "Home",
  },
  {
    icon: <Sparkles className="size-6" />,
    title: "Type it the way you'd say it",
    body: "“coffee at a shop 180 gcash” fills in the amount, the note, the category and the account by itself. Check it, save it — faster than any form.",
    where: "The box under the Grove",
  },
  {
    icon: <ScanLine className="size-6" />,
    title: "Or photograph the receipt",
    body: "Owwy reads the shop, the total and the date on your device — the photo never leaves it. It shows you the line it took the total from, and saves nothing until you confirm.",
    where: "The scan icon when adding",
  },
  {
    icon: <Wallet className="size-6" />,
    title: "Safe to Spend is the real number",
    body: "Your balance minus bills, debt minimums, savings and goal money, up to your next payday. Tap it to see every line that was subtracted and why.",
    where: "Home, under the Grove",
  },
  {
    icon: <MessageCircleQuestion className="size-6" />,
    title: "Ask, and see the working",
    body: "“Where did my money go last month?” gets an answer from your own records — along with the exact query Owwy ran to get it. No guessing, no made-up totals.",
    where: "The Ask tab",
  },
  {
    icon: <Lock className="size-6" />,
    title: "All of it stays here",
    body: "No account, no server, no ads. Everything lives on this device, which means backups are yours to keep — Settings has a one-tap export, and seven days of automatic snapshots.",
    where: "More → Your data",
  },
];

export function WelcomeTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const finish = () => {
    void updateSettings({ tourSeen: true });
    setIndex(0);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && finish()}
      title="A quick tour"
      description={`Step ${index + 1} of ${STEPS.length}`}
      size="md"
    >
      <div className="flex flex-col">
        <div className="relative min-h-[232px]">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={index}
              initial={{ opacity: 0, x: 22 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -22 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center"
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-soft-ink">{step.icon}</span>
              <h3 className="mt-4 text-title-2 font-extrabold tracking-tight">{step.title}</h3>
              <p className="mt-1 text-caption font-semibold tracking-wide text-brand uppercase">{step.where}</p>
              <p className="mt-3 max-w-sm text-body text-ink-2">{step.body}</p>
            </m.div>
          </AnimatePresence>
        </div>

        {/* Progress, and a way back to a step you skimmed. */}
        {/* The dots are small on purpose; the padding gives each one a real
            touch target without making the row look heavy. */}
        <div className="mt-3 flex items-center justify-center" aria-hidden>
          {STEPS.map((s, i) => (
            <button key={s.title} type="button" onClick={() => setIndex(i)} className="flex size-11 items-center justify-center" tabIndex={-1}>
              <span className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-brand" : "w-1.5 bg-line-strong"}`} />
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {index > 0 ? (
            <Button variant="secondary" size="lg" onClick={() => setIndex((i) => i - 1)} aria-label="Previous step" className="px-4">
              <ChevronLeft />
            </Button>
          ) : null}
          <Button size="lg" className="flex-1" onClick={() => (last ? finish() : setIndex((i) => i + 1))}>
            {last ? (
              <>
                <Check />
                Start using Owwy
              </>
            ) : (
              "Next"
            )}
          </Button>
        </div>
        {!last ? (
          <button type="button" onClick={finish} className="press mx-auto mt-3 min-h-11 px-3 text-callout font-semibold text-ink-3">
            Skip the tour
          </button>
        ) : null}

        <p className="mt-2 flex items-center justify-center gap-1.5 text-caption text-ink-3">
          <OwwyMascot mood="happy" size={18} />
          You can replay this any time from More.
        </p>
      </div>
    </Sheet>
  );
}

export { STEPS as TOUR_STEPS };
