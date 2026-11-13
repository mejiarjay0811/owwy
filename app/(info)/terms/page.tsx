import type { Metadata } from "next";
import { Prose } from "@/components/layout/prose";
import { SUPPORT_EMAIL } from "@/lib/app-info";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms that apply when you use Owwy — what it is, what it isn’t, and what each of us is responsible for.",
};

export default function TermsPage() {
  return (
    <Prose title="Terms of use" updated="November 2026">
      <p>
        These terms apply when you use Owwy, whether in a web browser, installed to your home screen, or installed from an app store. Owwy is published by @mjolnir_dev. By using Owwy you
        agree to what follows. If you do not agree, please do not use it.
      </p>

      <h2>What Owwy is</h2>
      <p>
        Owwy is a personal budgeting tool that runs on your own device. You record what you earn and spend, and Owwy does arithmetic on those records to show you balances, budgets,
        trends and what is safe to spend.
      </p>

      <h2>What Owwy is not</h2>
      <p>
        Owwy is <strong>not a bank, e-money issuer, e-wallet, lender, remittance service, payment processor or financial institution</strong>, and it is not regulated as one. It does
        not hold, move, transfer, invest or process money, and it does not connect to your bank or to any payment network. Every balance you see in Owwy is a record you entered
        yourself, not a real-world account balance. If your records and your bank disagree, your bank is right.
      </p>

      <h2>Not financial advice</h2>
      <p>
        Safe to Spend, Can I Afford It?, forecasts, projections, instalment tracking and Ask Owwy are calculations performed on the information you have recorded. They are{" "}
        <strong>not financial, investment, tax, accounting or legal advice</strong>, and they are not a recommendation to take or avoid any course of action. They can only be as
        accurate as what you entered, and they cannot know about anything you have not told Owwy. Please make significant financial decisions with care and, where it matters, with a
        qualified professional. Any report Owwy produces is a summary of your own records; it is not a bank statement and is not an audited or certified financial document.
      </p>

      <h2>Your licence to use Owwy</h2>
      <p>
        You may use Owwy for your own personal, non-commercial budgeting, on any number of devices you control. You may not resell it, rent it out, present it as your own product,
        or remove its branding. Owwy and its name, logo, design and code remain ours.
      </p>

      <h2>Your data is yours, and so are your backups</h2>
      <p>
        Your records are stored on your device, not with us. That is the point of Owwy, and it has one consequence you need to take seriously: <strong>we cannot recover anything for
        you.</strong>
      </p>
      <ul>
        <li>If you clear your browser’s site data, uninstall the app, reset Owwy, or lose or wipe the device, the data on it is gone.</li>
        <li>If you forget your app-lock PIN, we cannot unlock it or reset it for you.</li>
        <li>If you forget the passphrase on an encrypted backup, that backup cannot be opened by us or by anyone else.</li>
        <li>We hold no copy of your records, so there is no server-side backup to restore from.</li>
      </ul>
      <p>
        Keeping backups is therefore your responsibility. Owwy makes it one tap in Settings, and keeps seven days of on-device snapshots as a safety net for mistakes — but snapshots
        live on the same device and will not survive losing it. Export a backup and keep it somewhere safe.
      </p>

      <h2>Optional AI mode</h2>
      <p>
        Ask Owwy works on your device by default. If you choose to add your own Anthropic (Claude) API key, requests go directly from your device to Anthropic under your own account.
        That use is subject to Anthropic’s own terms, and any charges Anthropic bills for it are between you and Anthropic — we neither receive nor control them. AI-generated answers
        can be wrong or incomplete; treat them as a starting point and check anything that matters against the underlying figures, which Owwy always shows you.
      </p>

      <h2>Purchases</h2>
      <p>
        Owwy is free to use, and every feature is currently available to everyone. There are no advertisements, and there is no subscription.
      </p>
      <p>
        If a paid option is offered in future it is intended as a one-time purchase rather than a recurring one. Any such purchase made through the App Store or Google Play is
        processed by Apple or Google, and payment, billing, restoration and refunds are handled under their terms and refund policies, not ours. We will not remove a feature you
        already rely on and put it behind a payment.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Please do not use Owwy to break the law, attempt to gain access to parts of the software or anyone’s device you are not entitled to, interfere with its security features, or
        try to disrupt its availability for other people.
      </p>

      <h2>Availability and changes</h2>
      <p>
        Owwy is provided as it is, and we may change, add or remove features over time. Because the app runs on your device and keeps working offline, an interruption to our website
        or hosting does not stop an installed copy from working. We do not promise uninterrupted availability of the download or of any future online component.
      </p>

      <h2>Disclaimers</h2>
      <p>
        To the fullest extent permitted by law, Owwy is provided <strong>“as is” and “as available”</strong>, without warranties of any kind, whether express or implied, including
        implied warranties of merchantability, fitness for a particular purpose and non-infringement. We do not warrant that Owwy will be error-free, that its calculations will suit
        your circumstances, or that it will meet your requirements.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential or exemplary damages, nor for lost profits, lost savings, lost
        opportunity, or loss or corruption of data, arising out of or relating to your use of Owwy — including decisions you make on the basis of figures it displays. Where liability
        cannot lawfully be excluded, it is limited to the greater of the amount you paid for Owwy in the twelve months before the claim, or PHP 1,000.
      </p>
      <p>
        <strong>Nothing in these terms limits rights you have under consumer protection law that cannot be waived</strong>, and nothing here excludes liability for fraud, for death
        or personal injury caused by negligence, or for anything else that cannot lawfully be excluded.
      </p>

      <h2>Ending these terms</h2>
      <p>
        You may stop using Owwy at any time; deleting the app and resetting your data ends this agreement. The sections on disclaimers, limitation of liability and governing law
        continue to apply afterwards.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the Republic of the Philippines, and the courts of the Philippines have jurisdiction over any dispute. If you use Owwy from another
        country, you are responsible for complying with any local laws that apply to you. If any part of these terms is found unenforceable, the rest continues to apply.
      </p>

      <h2>Changes to these terms</h2>
      <p>If these terms change, the date at the top of this page changes with them, and the current version always lives here. Continuing to use Owwy means accepting the current terms.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </Prose>
  );
}
