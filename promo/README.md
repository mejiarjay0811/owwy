# Owwy — films

A **separate marketing layer**. It imports nothing from the app and the app imports nothing from it; the app was not changed to make these videos.

Everything on screen is the real product: the frames are 3× screenshots of the actual production build driven by a real browser, using Owwy's own sample data.

```bash
npm install
npm run capture            # drives the real app, saves 3x screens to public/screens
npm run studio             # scrub and edit any film

npm run render             # launch film  · 1080x1920 · 30fps · 45s
npm run render:landscape   # launch film  · 1920x1080 · 30fps · 45s
npm run render:owwy        # product reel · 1920x1080 · 60fps · 15s
npm run render:owwy:vertical
npm run render:film        # product film · 1920x1080 · 60fps · 60s
npm run render:film:vertical
```

| Composition | Size | Length | What it is |
|---|---|---|---|
| `Launch` / `LaunchLandscape` | 1080×1920 · 1920×1080 | 45s @30 | The original launch video, ending on AVAILABLE SOON |
| `OwwyReel` / `OwwyReelVertical` | 1920×1080 · 1080×1920 | 15s @60 | Short product reel, 8 chapters |
| `OwwyFilm` / `OwwyFilmVertical` | 1920×1080 · 1080×1920 | 60s @60 | Full product film, 16 chapters |
| `Showreel` / `ShowreelVertical` | 1920×1080 · 1080×1920 | 15s @60 | Abstract motion-design reel (no product) |

## The 60-second film

Sixteen chapters over **128 beats** of 28 frames (≈128bpm at 60fps), so every cut lands on a beat. The chapter map is `FILM_CHAPTERS` in `src/owwy-reel/theme.ts`, written in beats rather than frames; the last chapter absorbs a 16-frame hold so the film lands on a round 3600.

| # | Chapter | Beats | # | Chapter | Beats |
|---|---|---|---|---|---|
| 01 | Seed | 4 | 09 | Wallet | 7 |
| 02 | The question | 6 | 10 | Stats | 8 |
| 03 | The Grove | 11 | 11 | Budgets & goals | 7 |
| 04 | Type it, done | 8 | 12 | Owed & plans | 6 |
| 05 | Ask Owwy | 9 | 13 | Everything | 10 |
| 06 | Safe to spend | 9 | 14 | Private | 8 |
| 07 | Scan a receipt | 11 | 15 | Offline | 6 |
| 08 | Shopping | 7 | 16 | Owwy | 11 |

Scenes are shared between the 15-second and 60-second cuts. Each is handed the `len` of the slot it was given (`SceneProps` in `src/owwy-reel/chrome.tsx`) so it can pace its own tail — the Grove runs a second scroll wipe when it has the room, the scan reads the receipt more slowly, and the card deck schedules its fall against the end of its slot rather than a fixed frame.

`capture` expects the app running. Use the production build for the truest pixels:

```bash
cd .. && npm run build && npm run preview     # http://localhost:4173
cd promo && npm run capture -- --url=http://localhost:4173
```

## What the 45-second launch film shows

| Scene | Frames | Time | Content |
|---|---|---|---|
| 1 · Hook | 0–120 | 0:00–0:04 | Owwy mark, wordmark, the app's real tagline |
| 2 · Alive | 120–315 | 0:04–0:10.5 | Home (the Grove), reminders bell, scroll to Safe to Spend / payday / spending |
| 3 · Features | 315–825 | 0:10.5–0:27.5 | Ask · Scan · Wallet · Stats, ~4.25s each |
| 4 · Montage | 825–1005 | 0:27.5–0:33.5 | Log, search, add, calculator, budgets, goals, Safe to Spend, stats |
| 5 · Hero | 1005–1125 | 0:33.5–0:37.5 | Floating device, logo lockup, "Private · Offline · No ads" |
| 6 · Available soon | 1125–1275 | 0:37.5–0:42.5 | AVAILABLE SOON + both store badges |
| 7 · Credit | 1275–1350 | 0:42.5–0:45 | AMMEJIA |

Scene boundaries live in `src/theme.ts` (`timeline`) so music can be cut to the same marks.

## Two real layouts, one timeline

Both cuts run the same scenes and the same timing; they re-compose for the frame they're in via `useStage()` in `src/components.tsx`:

- **9:16** — device centred, copy beneath it.
- **16:9** — device left at full height, copy in a right-hand column, larger display type. Not a letterboxed copy of the vertical.

To change how either format sits, edit `useStage()`: `phone()` returns the device geometry and `copy` returns the text block's position.

## Audio

The film renders silent. To score it, drop a royalty-free track in `public/` and pass it:

```bash
npx remotion render Launch out/owwy-launch-vertical.mp4 --props='{"audio":"music.mp3"}'
```

Useful hit points for a composer: **0:04** app appears · **0:10.5** feature section starts · **0:27.5** montage (raise tempo) · **0:33.5** hero (peak) · **0:37.5** AVAILABLE SOON (impact, then resolve) · **0:45** end.

## Before you publish

- **Store badges are placeholders.** They deliberately avoid Google's and Apple's trademarked artwork. Replace them with the official badge assets — and real links — once the listings exist. No fake URLs, ratings, review counts or download numbers appear anywhere in this film.
- **The data is Owwy's built-in sample data**, not anyone's real finances. The demo-mode banner is removed during capture (`hideDemoBanner`) because a real user never sees it; nothing else is altered, hidden or retouched.
- **Remotion licence.** Remotion is free for individuals and small teams but requires a company licence above that threshold — see remotion.dev/license before using this commercially.
- Fonts in `public/fonts` are the app's own (Plus Jakarta Sans, Fraunces), copied from `node_modules`.

## Re-cutting

- Feature order, labels and which screens each uses: `src/scenes.tsx` (`SceneFeatures`).
- Scene lengths: `src/theme.ts`.
- Device size and position: the `Phone` component in `src/components.tsx` (`width`, `y`, `transform`).
- New screens: add a `shot(...)` call in `capture.mjs`, re-run `npm run capture`, then reference the file name.
