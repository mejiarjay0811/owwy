# 🦉 Owwy

**Know your money. Own your tomorrow.**

Owwy is a private, offline-first budget companion. It tells you where your money is going, how much you can safely spend, and how you're progressing toward your goals — with a friendly owl by your side. No account, no ads, no server holding your financial data.

## Highlights

| | |
|---|---|
| **The Grove** | Home is a living night forest: each spending category is a tree that grows through the month, Owwy perches on the tallest, today's transactions float as fireflies. Drag to travel back through days. |
| **Type it, done** | Type `coffee at a shop 180 gcash` on Home — the Confirm sheet fills itself as each word flies into its field. |
| **Ask Owwy** | `lunch 250 and grab home 120, gcash` becomes two staged entries to save. `Where did my money go last month?` runs a query on your data and **shows its work** ("Ran a query · 10 rows"). On-device by default; optional AI with your own key, from whichever service you prefer — or a model running on your own machine. Twelve starter questions, all answered on the device. |
| **Safe to Spend** | Spendable balances − bills − debt minimums − savings plan − goal money − minimum balance − cushion, until your next income. Every line explained. |
| **Can I afford it?** | Comfortable / Think about it / Not recommended, with before → after figures. A budgeting calculation, never advice. |
| **Automations** | Salary, "to savings every 1st", rent — logged without being asked, or set to ask first. |
| **At a glance** | Payday countdown, a spending pulse (today / week / month with a 7-bar trend), and Upcoming money split into *going out* and *coming in* with "3 days left" badges. A reminders bell gathers bills due, overdue items, automations waiting for you, over-budget categories and ready reviews. |
| **Wallet** | Every account as a card in a deck — the whole wallet on one screen, tap a card behind to deal it forward (a grid and a list are a tap away); Owwy's own card finishes (not bank replicas); net worth with 30-day change; Everyday / Savings / Credit filters; a "…" menu on every card; reorderable list view; two-week balance bars per account; credit due day and available credit; interest that posts itself monthly after tax. |
| **Multiple currencies** | Accounts can hold USD, EUR, JPY and more. Totals convert with rates you set (Owwy stays offline); transfers between currencies record what actually arrived. |
| **Scan a receipt** | Photograph a receipt and Owwy reads it **on the device** — shop, total, date and line items — then categorizes it: first from how you've filed that shop before, then from the shop's name, then from what's printed on it. It shows the line the amount came from (`"total 741.72"`), tells the total apart from the subtotal, the VAT, the cash handed over and the *"total items"* line printed underneath, and says so when a figure it found can't be right. You confirm before anything is saved, and the photo is attached to the transaction. |
| **Fast entry** | Built-in calculator (`120+45×2`), one-tap "Again?" chips for expenses you repeat, receipt photos kept on the device. |
| **Shopping trips** | Set a budget before you walk into the shop, add things as they go in the trolley (typed, scanned from the shelf tag, or one-tap from what you usually buy), and watch what's left. Owwy warns before you go over and says which items would bring you back under. Finishing logs one expense; the itemised list stays with the trip. |
| **Owed to you** | Track money lent to friends and family — not counted as spending, counted in net worth until it's collected back. **Split a bill** does the same for a shared meal: your share is logged, everyone else's becomes money owed to you. |
| **Stats** | Spent / income / net flow / transaction tiles, a month-end forecast, category donut, net-worth trend, cash flow, and a 6-month projection — plus six months of logging as a heatmap, with your current and best streak. Monthly reviews and printable PDF reports with an income statement. |
| **Installment plans** | Track a 3/6/12-month card plan: months paid, months left, the monthly amount (worked out for you), the final payment's month, and a warning when you've fallen behind. The monthly amount is reserved in Safe to Spend until the plan ends. |
| **Make it yours** | Seven colour palettes repaint the buttons, links, active tab and the owl itself; the balance card has its own choice of ten finishes and five engravings, shared by every screen that shows a big total. The page surfaces are deliberately left alone, so a palette can't turn readable text grey-on-grey — every combination is measured, in both themes, by `scripts/contrast.mjs` and `tests/palettes.test.ts`. |
| **Also** | Budgets (copy last month, pause), bills (pay/skip/undo), money calendar with projected balance, savings goals with history, debts, money notes, search ("food over 500 last month"), CSV import, CSV/JSON/encrypted backups plus 7 daily on-device snapshots, PIN app lock, hide balances, light/dark — or a theme that follows the clock, light through the day and dark from 6pm. The on-screen keyboard floats over the page instead of resizing it, and the page goes back where it was when the keyboard closes. |

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # typecheck + lint + tests
npm run build      # static export to out/ + service worker
npm run preview    # serve out/ at http://localhost:4173 (test offline here)
```

Choose **Explore with sample data** on the welcome screen to see everything populated. Sample data is clearly flagged and removable in one tap.

## Test it on a phone

With the phone on the same Wi-Fi, `npm run dev` and `npm run preview` both listen on every interface. The preview server prints the address to type into the phone, so you never have to look it up:

```
Owwy preview → http://localhost:4173
         phone → http://192.168.1.23:4173
```

Allow Node through Windows Firewall on private networks the first time it asks.

Everything works over that plain `http://` address — entry, the Grove, receipt scanning (the camera comes from a file input, not `getUserMedia`), shopping trips, stats — except the four things browsers reserve for a **secure context**: the service worker (so no offline mode), install-to-home-screen, the PIN lock and encrypted backups. Owwy detects that and says so rather than failing oddly.

To test those four, serve over real HTTPS:

| | |
|---|---|
| **A tunnel** | `cloudflared tunnel --url http://localhost:4173` gives a trusted `https://` address any phone can open — the quickest way to install the PWA and test airplane mode. The link is public while it runs; it exposes the app bundle only, never your data. |
| **A static host** | Deploy `out/` to Netlify, Vercel, Cloudflare Pages or GitHub Pages. Best for repeat testing. |
| **Your own certificate** | `$env:SSL_CERT="cert.pem"; $env:SSL_KEY="key.pem"; npm run preview`. A *self-signed* certificate isn't enough: browsers refuse to register a service worker on an untrusted certificate even after you click past the warning. |

Install it from Chrome (⋮ → **Add to Home screen**) or iOS Safari (Share → **Add to Home Screen**; iOS installs only from Safari), then switch on airplane mode and reopen it.

Haptics, scheduled bill notifications and native file export exist only in the native build — `npx cap add android` once, then `npm run cap:android` and run it on a USB-connected phone.

## Architecture

```
React UI (app/, components/)
   │  reads: useFinance()  — one live IndexedDB subscription → computeFinanceState()
   │  writes: repositories & services only
   ▼
Services (lib/services)        demo data, backup/restore, interest, snapshots, security, reset
Repositories (lib/storage)     validated CRUD + atomic multi-table operations (Zod at the boundary)
Finance engine (lib/finance)   pure, deterministic calculations — fully unit tested
Receipts (lib/receipts)        on-device OCR (Tesseract WASM) + receipt parsing + category guessing
Assistant (lib/assistant)      on-device intent engine + optional AI tool loop (two wire formats)
IndexedDB via Dexie            versioned schema with migrations (lib/storage/db.ts)
```

- **Money** is stored as integer minor units (centavos); dates as local `YYYY-MM-DD` strings.
- **Balances are derived**, never stored: opening balance + transactions. Adding ₱500 of Food updates the Grove, balance, month totals, budget, Safe to Spend, insights and history at once.
- **Static export** (`output: "export"`): no server. A generated service worker precaches every file, so the installed PWA and the Capacitor app work in airplane mode.
- **Platform adapter** (`lib/platform`) lazily uses Capacitor plugins (haptics, notifications, files/share, status bar) and degrades gracefully on the web.

## Ask Owwy & AI (optional)

- **On device (default):** `lib/assistant/local-engine.ts` recognizes logging, breakdowns, trends, totals, last payments, balances, bills, budgets, goals, Safe to Spend and affordability. Every answer includes the exact query and result rows.
- **On device + AI:** add your own API key in Settings → Ask Owwy, for whichever service you prefer (`lib/assistant/providers.ts`), or point it at a model on your own machine and use no key at all. The key is encrypted with a non-extractable device key (`lib/security/secrets.ts`) and never included in backups. The model calls local tools (`lib/assistant/tools.ts`): `query_transactions`, `get_overview`, `stage_transactions`. It can **stage** transactions but never save, edit or delete. Notes can be excluded from what's shared, and what the user said they want help with is part of what the model is told.

## Mobile packaging (Capacitor)

```bash
npx cap add android       # once
npx cap add ios           # once (macOS + Xcode)
npm run cap:android       # build, sync, open Android Studio
npm run cap:ios           # build, sync, open Xcode
```

Icon master: `public/icons/app-icon-1024.png` (regenerate with `npm run icons`). The offline receipt reader in `public/ocr` adds ~10 MB to the native bundle (both WASM cores ship; each device loads one); drop `tesseract-core-lstm.wasm.js` from `scripts/copy-ocr.mjs` if you only target SIMD-capable devices. Before store submission:
- Generate native icons/splash from the master (e.g. `@capacitor/assets`).
- Add `FLAG_SECURE` (Android) / app-switcher privacy view (iOS) for screenshot protection.
- Wire a biometric plugin to `window.OwwyBiometrics` and store billing to `window.OwwyBilling` (`lib/premium`).
- For native at-rest encryption, move the device key to Keychain/Keystore.
- Replace the placeholder Privacy, Terms and Support pages with reviewed text.

## Testing

`npm test` runs Vitest: money & dates, balances, summaries, budgets, bills, goals, debts, net worth, income schedules, recurring catch-up, Safe to Spend, affordability, smart input, multi-transaction splitting, search, the Ask engine, AI tool execution, interest, trends/projection, multi-currency conversion, receivables, CSV import, payday, spending series, reminders, month-end forecast, the amount calculator, receipt parsing (totals vs. subtotal/VAT/cash/change/"total items"/"total savings", quantities beside prices, dates, merchants — including a regression case built from real OCR output for a photographed receipt) and receipt categorization, price-tag reading, shopping-trip budgets, bill splitting, installment schedules, logging streaks, theme-by-clock, every palette's contrast in both themes, the keyboard's viewport arithmetic, and IndexedDB integration (bill payments, goal transfers, automations, backups, encryption, demo data).

## Honest limits

- Web browsers can't schedule notifications without a server; bill reminders show in-app on the web and as local notifications in the native app.
- Browser storage can be cleared by the user or, rarely, the browser — Owwy requests persistent storage and makes backups one tap away.
- The AI mode is covered by tests against a stubbed transport; both wire formats still need a real key to exercise end to end.
- Exchange rates are entered by you (with a rough built-in fallback). Live rates, stock/crypto prices, home-screen widgets and Siri shortcuts are intentionally not included: they need a server, a data provider, or native-only APIs.
- Receipt scanning reads printed receipts well; handwriting, crumpled thermal paper and bad light are still hard. Owwy always shows what it read — including the line the total came from — and never saves without your confirmation. The reader (~7 MB: `public/ocr`, copied from `node_modules` at build time) downloads on the first scan and is cached for offline use afterwards — it is deliberately left out of the app-shell precache.
- A space between digits is read as a quantity beside a price (`soap 2  64.00` → ₱64.00), because that is what receipts print. The European `1 234,00` still reads correctly, but `1 234.00` — spaced thousands with a *dot* decimal — is taken as two numbers.
- Daily on-device snapshots undo mistakes; they don't survive losing the device — export a backup for that.
