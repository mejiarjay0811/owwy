# Publishing Owwy to Google Play and the App Store

Owwy is sold as a **paid app**: the store takes ₱199 before the download. That
is a store setting, not a feature — there is no billing code in Owwy, nothing
to unlock, and no purchase to restore. Everyone who has the app has all of it.

> The web version at `owwy-app.vercel.app` stays free and installable from the
> browser. Both being true at once is fine, and the in-app page at `/get/`
> says so rather than pretending the web one is a trial.

---

## What is already done

| | |
|---|---|
| `android/` project | Generated, builds, Owwy's icons in every density |
| `ios/` project | Generated. **Cannot be built on Windows** — see below |
| App id | `app.owwy.budget` (both platforms) |
| Version | `versionCode 1`, `versionName 1.0.0` — bump `versionCode` for every upload |
| Launcher, adaptive and notification icons | `node scripts/native-icons.mjs`, drawn from `public/icons/app-icon-1024.png` |
| Release signing | Wired to `android/keystore.properties`, which is gitignored |
| Cloud backup | **Off.** Android would otherwise copy the whole financial history to the user's Drive, which contradicts the one promise Owwy makes |

```bash
npm run cap:sync        # build the web app and copy it into both projects
npm run cap:android     # sync, then open Android Studio
```

## What only you can do

Neither store can be set up from here. Both need an account in your name, a
payment profile, and acceptance of terms — and the iOS build needs hardware
this machine does not have.

### Google Play — the one you can do today

1. **Developer account** — US$25, once, at [play.google.com/console](https://play.google.com/console). Expect identity verification; allow a few days.
2. **Payments profile** — required to charge for anything. Google Play supports sellers in the Philippines; you will need bank details and a tax form.
3. **Create the app**, then **set it to Paid before you publish anything.**
   > A free app can never be made paid afterwards. If you publish Owwy free
   > and change your mind, the only route is a new listing with a new app id.
4. **Price it** at ₱199 in Play Console → Monetise → Paid app. Play shows the price inclusive of local tax and handles conversion for other countries.
5. **Make a keystore** and keep it somewhere you will still have in five years. Losing it means you can never update your own app:
   ```bash
   keytool -genkey -v -keystore owwy-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias owwy
   ```
   Copy `android/keystore.properties.example` to `android/keystore.properties` and fill it in.
6. **Build the bundle** — Android Studio → Build → Generate Signed App Bundle, or:
   ```bash
   cd android && ./gradlew bundleRelease
   ```
   The file lands at `android/app/build/outputs/bundle/release/app-release.aab`.
7. **Store listing** — needs a 512×512 icon, a 1024×500 feature graphic, at least two phone screenshots, a short and full description, and a **privacy policy URL**. Owwy's is at `/privacy/` on the site; point Play at the public URL.
8. **Data safety form** — answer it honestly and it is short: Owwy collects nothing, shares nothing, and has no account. The one thing to declare is that if the user adds their own AI key, the questions they ask are sent to the service they chose.
9. **Content rating** questionnaire, target audience, and ads declaration (**no ads**).
10. Internal testing track first. Paid apps cannot be bought by the developer account that owns them, so use a second Google account on a test device, added as a licence tester.

### App Store — needs a Mac

1. **Apple Developer Program** — US$99 a year.
2. **A Mac with Xcode.** There is no supported way to build, sign or upload an iOS app from Windows. The `ios/` project in this repo is ready; it needs to be opened on a Mac. The usual options are borrowing one, a rented Mac in the cloud (MacStadium, MacinCloud), or a CI runner with macOS (Codemagic, Bitrise, GitHub Actions `macos-latest`).
3. On the Mac: `npm install && npm run cap:sync && npx cap open ios`, set the team and bundle id, then Product → Archive → Distribute.
4. **Price** — Apple sells from a fixed list of price points. ₱199 exists on the Philippine tier list; the store picks the matching tier in every other currency.
5. **App Privacy** answers mirror Play's: no collection, no tracking, no third-party SDKs.
6. Apple reviews by hand. Two things they ask about for an app like this:
   - *What does it do without an account?* Everything — say so in the review notes.
   - *Is there anything to buy inside?* No. A paid app with no IAP is simpler to review than one with.

---

## Before you upload either one

- [ ] **Have the privacy policy and terms read by a lawyer.** They are written in plain language and describe what Owwy actually does, but they have not been reviewed by anyone qualified, and both stores require a policy you stand behind.
- [ ] Replace `owwy-app.vercel.app` / `owwy-site.vercel.app` with the real domain (`site/README.md` lists every place).
- [ ] Put the live store URLs into `STORE_LINKS` in `lib/premium/index.ts` so `/get/` links to them instead of saying "not on the stores yet".
- [ ] Bump `versionName` in `lib/app-info.ts` **and** `android/app/build.gradle` together.
- [ ] Check the app runs from the bundle, not a dev server: `npm run cap:sync` then run the release build on a real device with aeroplane mode on. Everything should work, the receipt reader included.

## Things worth deciding, not defaults

- **`FLAG_SECURE`** would stop Android screenshotting the app and hide it from the recents thumbnail. Good for a finance app on a shared phone, irritating if the user wants to screenshot a chart. It is off; turn it on in `MainActivity` if you want it.
- **Play's "Paid app" vs free with in-app purchase.** Paid is simpler and matches "one payment": no billing library, no restore flow, no entitlement bugs. The trade is that nobody can try it first — which the free web version answers.
