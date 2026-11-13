/**
 * Builds the marketing site's Open Graph card (1200x630) from the brand and a
 * real screenshot — the same pixels the site shows, so the social preview
 * can't drift from the product.
 *
 *   node scripts/make-og.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "site", "assets", "og.png");

const W = 1200;
const H = 630;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1310"/>
      <stop offset="1" stop-color="#060d0a"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.18" r="0.6">
      <stop offset="0" stop-color="#6cc7b3" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#6cc7b3" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <text x="72" y="150" font-family="Georgia, serif" font-size="46" font-weight="700" fill="#eef2ef">owwy</text>

  <text x="72" y="262" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="62" font-weight="800" fill="#eef2ef" letter-spacing="-1.6">Know your money.</text>
  <text x="72" y="338" font-family="Georgia, serif" font-style="italic" font-size="62" fill="#6cc7b3" letter-spacing="-1">Own your tomorrow.</text>

  <text x="72" y="412" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="25" fill="#a9b6b2">A budget companion that runs entirely on your device.</text>

  <g transform="translate(72 470)">
    <rect width="168" height="44" rx="22" fill="#173430" stroke="#6cc7b3" stroke-opacity="0.45"/>
    <text x="84" y="29" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#6cc7b3">NO ACCOUNT</text>
    <rect x="184" width="150" height="44" rx="22" fill="#173430" stroke="#6cc7b3" stroke-opacity="0.45"/>
    <text x="259" y="29" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#6cc7b3">NO SERVER</text>
    <rect x="350" width="124" height="44" rx="22" fill="#173430" stroke="#6cc7b3" stroke-opacity="0.45"/>
    <text x="412" y="29" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#6cc7b3">NO ADS</text>
  </g>
</svg>`;

// Only the top of the screen is shown — a full 19.5:9 phone is taller than
// the whole card, and the Grove is the part worth seeing.
const PHONE_W = 300;
const VISIBLE = 490;
const screen = await sharp(join(root, "site", "assets", "screens", "home-grove.png"))
  .resize({ width: PHONE_W - 12 })
  .extract({ left: 0, top: 0, width: PHONE_W - 12, height: VISIBLE })
  .toBuffer();

const bezel = await sharp({
  create: { width: PHONE_W, height: VISIBLE + 6, channels: 4, background: { r: 24, g: 36, b: 30, alpha: 1 } },
})
  .composite([{ input: screen, left: 6, top: 6 }])
  .png()
  .toBuffer();

await sharp(Buffer.from(svg))
  .composite([{ input: bezel, left: 830, top: 64 }])
  .png()
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`og.png ${meta.width}x${meta.height}`);
