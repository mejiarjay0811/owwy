import type { Metadata } from "next";
import { Prose } from "@/components/layout/prose";
import { SUPPORT_EMAIL } from "@/lib/app-info";

export const metadata: Metadata = { title: "Help & support" };

export default function SupportPage() {
  return (
    <Prose title="Help & support">
      <h2>How is Safe to Spend worked out?</h2>
      <p>Owwy starts with the money in your spending accounts, then sets aside upcoming bills, debt payments, your savings plan, goal money, your minimum balance and a small cushion. Open Safe to Spend on Home to see every line.</p>

      <h2>How do I move Owwy to a new phone?</h2>
      <p>Settings → Your data → Export backup (or Encrypted backup). On the new device, open Owwy and choose Import backup.</p>

      <h2>I forgot my PIN</h2>
      <p>For your privacy there&apos;s no reset link. Clear Owwy&apos;s data from your device settings and restore your latest backup.</p>

      <h2>Does Owwy connect to my bank?</h2>
      <p>No. Owwy never asks for bank logins or card numbers. You record balances and transactions yourself — which also means nothing about your finances is shared.</p>

      <h2>Is Ask Owwy using AI?</h2>
      <p>Only if you turn it on and add your own Claude API key. Otherwise every answer is worked out on your device, and you can always tap “Ran a query” to see exactly what was checked.</p>

      <h2>Still stuck?</h2>
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Please don&apos;t include backups or personal financial details.
      </p>
    </Prose>
  );
}
