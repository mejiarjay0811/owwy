# Deploying Owwy

Two Vercel projects from one GitHub repository. Both are connected to
`github.com/mejiarjay0811/owwy`, so a push to `main` deploys both.

| | Vercel project | Root directory | Output | Live |
|---|---|---|---|---|
| **App** (PWA) | `owwy-app` | `.` | `out` | https://owwy-app.vercel.app |
| **Site** (marketing) | `owwy-site` | `site` | — (already static) | https://owwy-site.vercel.app |

> **The site project's Root Directory must stay `site`.** Both projects watch the
> same repository, so if it is ever reset to `.` the site project will run the
> *app's* build and publish that as the marketing page. Set it with
> `vercel project update owwy-site --root-directory site --yes`.

> **The app must not use Vercel's Next.js preset with `outputDirectory: out`.**
> That combination makes Vercel look for `routes-manifest.json` inside `out/`,
> which a static export never writes there, and the build fails. `vercel.json`
> pins `"framework": null` for this reason — it is a plain static build that
> happens to be produced by `next build`.

## The app

Vercel detects Next.js automatically. `vercel.json` at the repo root pins the rest:

```
buildCommand     npm run build
outputDirectory  out
trailingSlash    true        (matches next.config.ts)
```

`npm run build` copies the OCR engine into `public/ocr`, runs `next build` (static export), then generates the service worker. Nothing in the pipeline needs a server.

### Environment variables

**None are required.** The app has no backend, no API routes, no database connection and no server-side secrets. It builds and runs with an empty environment.

The one optional integration — Ask Owwy's conversational mode — uses a **Claude API key the user pastes into Settings on their own device**. It is encrypted with a non-extractable device key and never leaves their browser. Do not put an Anthropic key in Vercel: there is no server-side code that could read one, and a build-time key would be exposed in the client bundle.

### Headers

`vercel.json` sets:

- **CSP** — `'wasm-unsafe-eval'` and `blob:` workers are required by the on-device receipt reader; `'unsafe-inline'` scripts are required by Next's bootstrap and the no-flash theme script in `app/layout.tsx`. `connect-src` allows `api.anthropic.com` only so a user-supplied key can work; with no key the app makes no outbound requests at all.
- **HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.**
- **Caching** — `_next/static`, `/ocr/` and `/icons/` immutable for a year; `sw.js` and the manifest must revalidate, or an old app shell can pin itself in place.

Test the real headers locally before deploying:

```bash
npm run build
npm run preview:headers      # serves out/ with vercel.json's headers applied
```

The preview server reads `vercel.json` directly, so what you test is what Vercel sends. This is the only way to catch a CSP that breaks the app before it reaches production.

### Verifying a deploy

```bash
npm run check                # typecheck + lint + 246 tests
npm run build
npm run preview              # http://localhost:4173
npm run audit                # 26 routes x 11 widths, 320px to 1920px
```

`npm run audit` drives the built app in a real browser and reports horizontal overflow, console errors, tap targets under 44px, unnamed controls, heading structure and missing metadata. It should report zero for everything except tap-target notes.

## The site

See `site/README.md`. Root directory `site`, no build command, no output directory.

## Before a public launch

- Replace `owwy.app` / `app.owwy.app` throughout `site/` with the real domains (see `site/README.md`).
- The Privacy, Terms and Support pages in the app are **placeholders**. They need reviewed text before you accept public users — this is a legal requirement, not a polish item.
- Decide where support mail goes; the site footer currently links to the app's own support page.

## Native packaging (later)

Capacitor is already configured (`capacitor.config.ts`, `webDir: "out"`). Because the app stays at `/`, nothing about the web deployment interferes with it.

```bash
npx cap add android
npm run cap:android
```

Still outstanding for store submission, as listed in the main README: native icons and splash from the 1024px master, `FLAG_SECURE` / iOS app-switcher privacy view, a biometric plugin wired to `window.OwwyBiometrics`, store billing wired to `window.OwwyBilling`, and moving the device encryption key to Keychain/Keystore.
