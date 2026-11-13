# Owwy — marketing site

A static marketing page for Owwy. No framework, no build step, no dependencies: three files plus images, served as-is.

It is deliberately **separate from the app**. The app is an installable PWA whose `start_url` is `/`, and the Capacitor native build loads `index.html` from the export root — so putting a marketing page at `/` would mean the installed app and the native app both open on marketing. Keeping them apart avoids that entirely.

```
owwy.app         →  this folder          (Vercel project: owwy-site)
app.owwy.app     →  the app's out/       (Vercel project: owwy-app)
```

## Run it locally

```bash
npm run site
```

Serves this folder at <http://localhost:4180> using the repo's own static server.

```bash
npm run audit:site
```

Loads the page at twelve widths from 320px to 1920px and reports horizontal overflow, tap targets under 44px, unnamed controls (read from Chrome's accessibility tree, not guessed), heading structure and console errors.

## Deploy to Vercel

1. New Project → import this repository.
2. **Root Directory:** `site`
3. **Framework Preset:** Other
4. **Build Command:** leave empty
5. **Output Directory:** leave empty (the files are already static)
6. Deploy, then add `owwy.app` under Settings → Domains.

`vercel.json` in this folder sets the security headers (CSP, HSTS, `X-Frame-Options`, `Permissions-Policy`) and caches `/assets/*` for a year.

## Before you point a domain at it

Three things reference a domain that does not exist yet. Search and replace `owwy.app` across `index.html`, `robots.txt` and `sitemap.xml`, then check:

- `<link rel="canonical">` and the `og:url`
- `og:image` — must be an absolute URL on the live domain, or link previews break
- the `Sitemap:` line in `robots.txt`

The **Open Owwy** buttons point at `https://app.owwy.app`. Change those to wherever the app actually lives.

## Editing

| What | Where |
|---|---|
| Copy, sections, FAQ | `index.html` — plain semantic HTML, one section per `<section id>` |
| Colours, type, layout | `styles.css` — tokens are at the top in `:root` |
| Mobile nav, scroll reveal, year | `script.js` — ~50 lines, no dependencies |
| Screenshots | `assets/screens/` — **regenerate, never retouch:** `npm run build`, serve `out/`, then `node scripts/make-screens.mjs`. They are captures of the real built app, so any change to the app's type, spacing or layout makes them stale until you re-run it. The scan one really reads a receipt the script draws — no mock-up. |
| Social card | `assets/og.png` — regenerate with `npm run og` after changing the brand |

## Honesty rules this page follows

No invented statistics, testimonials, review counts, download numbers or customer logos. Every feature described is one the app actually ships, every screenshot is a real capture of the built app running on its own sample data, and the FAQ answers reflect how it genuinely works — including the limitations (no sync, no bank connections, data lives only on the device).
