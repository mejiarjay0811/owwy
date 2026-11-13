import type { Metadata } from "next";
import { Prose } from "@/components/layout/prose";
import { SUPPORT_EMAIL } from "@/lib/app-info";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "Owwy keeps your financial records on your own device. No account, no server, no analytics, no advertising.",
};

export default function PrivacyPage() {
  return (
    <Prose title="Privacy policy" updated="November 2026">
      <p>
        <strong>Owwy does not collect your personal information.</strong> There is no account to create, no server that receives your financial records, no analytics, and no
        advertising. Everything you record stays in your device’s own storage until you choose to export it. This policy explains exactly how that works, and the few narrow
        situations in which anything leaves your device.
      </p>
      <p>
        This policy covers the Owwy app, whether you use it in a web browser, install it to your home screen, or install it from an app store. Owwy is published by @mjolnir_dev. You can
        reach us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>What we collect</h2>
      <p>
        Nothing. We do not operate a server that receives your data, and we have no way to see what you record in Owwy. Specifically, Owwy contains no analytics, no crash reporting,
        no advertising identifiers, no tracking pixels, no marketing cookies, and no third-party SDKs that profile you.
      </p>
      <p>
        Because we never receive your information, we cannot sell it, share it, use it to train anything, hand it to a data broker, or produce it in response to a request — there is
        nothing on our side to produce.
      </p>

      <h2>What Owwy stores on your device</h2>
      <p>Owwy writes to your device’s own storage and nowhere else. That includes:</p>
      <ul>
        <li>
          <strong>Your records</strong> — accounts, transactions, budgets, bills, goals, debts, money owed to you, shopping trips, automations, notes and settings. These are kept in
          your browser’s IndexedDB storage, or in the app’s private storage on a mobile device.
        </li>
        <li>
          <strong>Receipt photos</strong> you attach to a transaction, stored alongside that transaction on the device.
        </li>
        <li>
          <strong>Up to seven daily snapshots</strong> of your data, so a mistake can be undone. These are also local, and are removed when you reset Owwy.
        </li>
        <li>
          <strong>Small interface preferences</strong> — your chosen theme, whether balances are hidden, your last-used account, the wallet layout you prefer, which reminders you have
          dismissed, and failed-PIN attempts. These contain no financial amounts.
        </li>
        <li>
          <strong>Your app-lock PIN is never stored.</strong> Owwy keeps only a salted, one-way hash of it (PBKDF2-SHA256), which cannot be reversed back into your PIN.
        </li>
        <li>
          <strong>Your Ask Owwy conversation</strong>, which stays on the device and is deliberately excluded from backups.
        </li>
      </ul>
      <p>Owwy sets no cookies. The only browser storage it uses is the local storage described above, and none of it is sent anywhere.</p>

      <h2>What leaves your device</h2>
      <p>By default, nothing. Owwy works fully offline once loaded. There are four exceptions, and you control all of them.</p>
      <ul>
        <li>
          <strong>Loading the app.</strong> When you open Owwy in a browser, your device requests the app’s files from our hosting provider, the same as any website. That request
          includes your IP address and browser user-agent, which the host processes to deliver the files and to keep its service secure. It contains none of your financial data.
          Once loaded, Owwy is cached on your device and keeps working without a connection.
        </li>
        <li>
          <strong>Files you export.</strong> CSV exports, JSON backups, encrypted backups and printed or PDF reports go wherever you choose to save, share or send them. After they
          leave Owwy they are in your hands, and the privacy of wherever you put them is governed by that service, not by us.
        </li>
        <li>
          <strong>Optional AI mode.</strong> Ask Owwy answers on your device by default, with no network access at all. Only if you add your own API key for an AI service in
          Settings does anything get sent: your question, a few recent messages in that conversation, your category and account names, and the specific query results needed to
          answer. You choose which service that is — Owwy supports several, and any service that speaks the same formats, including one you run yourself. It is sent directly from
          your device to that service under your own account, and does not pass through us. You can exclude transaction notes, and you can remove the key at any time. That
          service’s handling of the data is governed by your agreement with it, not with us.
        </li>
        <li>
          <strong>Exchange rates</strong> are values you enter yourself. Owwy does not call a rates service.
        </li>
      </ul>

      <h2>Receipt scanning and your camera</h2>
      <p>
        When you photograph a receipt, the image is read <strong>on your device</strong>. The text-recognition engine is downloaded once, then runs inside the app; the photo is
        never uploaded, and no part of it is sent to us or to anyone else. Owwy shows you what it read — including which line it took the total from — and nothing is saved until you
        confirm it. The photo is stored with the transaction on your device, and you can delete it at any time.
      </p>

      <h2>Permissions</h2>
      <ul>
        <li>
          <strong>Camera or photo library</strong> — only when you choose to scan or attach a receipt. Owwy never opens your camera in the background.
        </li>
        <li>
          <strong>Notifications</strong> (mobile app, optional) — used only for bill reminders you switch on. They are generated on your device; there is no push server.
        </li>
        <li>
          <strong>Biometrics</strong> (mobile app, optional) — handled entirely by your operating system. Owwy receives only a yes-or-no result and never sees your fingerprint or
          face data.
        </li>
        <li>
          <strong>Files and sharing</strong> — only when you export or import.
        </li>
      </ul>

      <h2>Security</h2>
      <ul>
        <li>Your PIN is protected by PBKDF2-SHA256 with a random salt and 210,000 iterations; only the derived hash is kept.</li>
        <li>Encrypted backups use AES-256-GCM with a key derived from your passphrase using 310,000 PBKDF2 iterations.</li>
        <li>If you supply an AI API key, it is encrypted with a non-extractable key held by your device’s own cryptography layer, and is deliberately left out of every backup.</li>
        <li>Owwy is served over HTTPS and asks your browser for persistent storage so your records are not silently evicted.</li>
      </ul>
      <p>
        No system is perfectly secure, and the device itself is the weak point: anyone with access to an unlocked device has access to the data on it. Use your device’s own lock, and
        turn on Owwy’s app lock if other people use your phone.
      </p>

      <h2>Keeping and deleting your data</h2>
      <p>
        Owwy keeps your records until you delete them. We cannot delete them for you, because we do not hold them. To remove everything Owwy has stored on a device, open{" "}
        <strong>Settings → Your data → Reset Owwy</strong>. That permanently deletes your records, attachments, snapshots and saved preferences from that device. Uninstalling the app,
        or clearing site data for Owwy in your browser, has the same effect.
      </p>
      <p>
        Deletion is immediate and cannot be undone, and it does not touch backups you exported earlier — those are yours to keep or delete wherever you saved them.
      </p>

      <h2>Children</h2>
      <p>
        Owwy is a general-purpose budgeting tool intended for people aged 13 and over, and is not directed at young children. We do not knowingly collect information from anyone,
        including children, because we do not collect information at all.
      </p>

      <h2>Your rights</h2>
      <p>
        Data protection laws — including the Philippine Data Privacy Act of 2012, the EU and UK GDPR, and similar laws elsewhere — give you rights to access, correct, export and
        delete your personal data, and to object to its processing.
      </p>
      <p>
        With Owwy you exercise those rights directly, without asking us and without waiting: your data is visible in the app, editable in the app, exportable from Settings in CSV or
        JSON at any time, and deletable in full from Settings. We cannot action a request to access, correct, export or erase your records, because we have never received them. If
        you believe you have a complaint about how Owwy handles data, please write to us first; in the Philippines you may also contact the National Privacy Commission.
      </p>

      <h2>Others involved</h2>
      <ul>
        <li>
          <strong>Our hosting provider</strong> serves the app’s files and processes the connection data described above. It never receives your financial records.
        </li>
        <li>
          <strong>The AI service you choose</strong>, only if you add your own API key, and only for what that feature sends. Owwy has no agreement with any of them on your
          behalf, and no key of its own.
        </li>
        <li>
          <strong>Apple and Google</strong>, if you install Owwy from their stores, handle the download and any purchase under their own privacy policies. We receive no personal
          information about you from them.
        </li>
      </ul>

      <h2>Changes to this policy</h2>
      <p>
        If this policy changes, the date at the top of this page changes with it, and the current version always lives here. If a change ever meant Owwy began collecting personal
        information, we would say so prominently in the app before it took effect — not quietly in an updated document.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy, or about anything on this page: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </Prose>
  );
}
