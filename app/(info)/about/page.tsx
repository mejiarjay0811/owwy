import type { Metadata } from "next";
import { Prose } from "@/components/layout/prose";
import { OwwyMascot } from "@/components/owwy/owwy-mascot";
import { APP_TAGLINE, APP_VERSION } from "@/lib/app-info";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <Prose title="About Owwy">
      <div className="mt-6 flex items-center gap-4">
        <OwwyMascot mood="happy" size={88} />
        <p className="!mt-0 font-display text-[1.375rem] leading-snug text-ink">{APP_TAGLINE}</p>
      </div>
      <p>
        Owwy is a beautiful, private, offline-first budget companion that tells you where your money is going, how much you can safely spend, and how you&apos;re progressing toward your
        goals — with a friendly owl by your side.
      </p>
      <h2>Why Owwy</h2>
      <ul>
        <li>
          <strong>Safe to Spend</strong> — a real answer to “how much can I actually spend?”
        </li>
        <li>
          <strong>Type it, done</strong> — “lunch 250 and grab home 120” becomes two entries.
        </li>
        <li>
          <strong>Ask Owwy</strong> — questions answered from your own data, showing their work.
        </li>
        <li>
          <strong>The Grove</strong> — your month, growing like a forest.
        </li>
        <li>
          <strong>Private by design</strong> — no account, no ads, no server holding your money data.
        </li>
      </ul>
      <p className="text-caption text-ink-3">Version {APP_VERSION}</p>
    </Prose>
  );
}
