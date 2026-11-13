// Generates Owwy's app icons from vector artwork: `npm run icons`.
// Output goes to public/icons (committed), so builds never need this step.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = new URL("../public/icons/", import.meta.url);

/** The owl mark on an evergreen night gradient. `inset` shrinks artwork for maskable safe zones. */
function iconSvg({ size = 1024, inset = 0.16, rounded = true } = {}) {
  const pad = size * inset;
  const s = (size - pad * 2) / 32;
  const radius = rounded ? size * 0.225 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="80%" cy="10%" r="120%">
      <stop offset="0%" stop-color="#2a6f62"/>
      <stop offset="45%" stop-color="#14463f"/>
      <stop offset="100%" stop-color="#0a2622"/>
    </radialGradient>
    <mask id="crescent">
      <rect width="${size}" height="${size}" fill="#fff"/>
      <circle cx="${size * 0.8}" cy="${size * 0.185}" r="${size * 0.045}" fill="#000"/>
    </mask>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <circle cx="${size * 0.78}" cy="${size * 0.2}" r="${size * 0.05}" fill="#f6d48d" opacity="0.9" mask="url(#crescent)"/>
  <g transform="translate(${pad} ${pad + size * 0.02}) scale(${s})">
    <path d="M8.5 9 L6.5 2.5 L13 6.2 Z M23.5 9 L25.5 2.5 L19 6.2 Z" fill="#f4efe3" stroke="#f4efe3" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M16 4.5 C23 4.5 27 9.5 27 16.5 C27 24 22.5 29 16 29 C9.5 29 5 24 5 16.5 C5 9.5 9 4.5 16 4.5 Z" fill="#f4efe3"/>
    <circle cx="11.7" cy="14.8" r="4.3" fill="#e39a35"/>
    <circle cx="20.3" cy="14.8" r="4.3" fill="#e39a35"/>
    <circle cx="11.7" cy="15" r="2" fill="#15211f"/>
    <circle cx="20.3" cy="15" r="2" fill="#15211f"/>
    <circle cx="11" cy="14.2" r="0.7" fill="#fff"/>
    <circle cx="19.6" cy="14.2" r="0.7" fill="#fff"/>
    <path d="M16 17.6 L14.5 19.9 L16 22.4 L17.5 19.9 Z" fill="#d4822a"/>
  </g>
</svg>`;
}

await mkdir(OUT, { recursive: true });

const outputs = [
  { file: "icon-192.png", size: 192, svg: iconSvg({ rounded: false }) },
  { file: "icon-512.png", size: 512, svg: iconSvg({ rounded: false }) },
  { file: "maskable-512.png", size: 512, svg: iconSvg({ inset: 0.26, rounded: false }) },
  { file: "apple-touch-icon.png", size: 180, svg: iconSvg({ rounded: false }) },
  // Master artwork for Capacitor's native icon/splash generation.
  { file: "app-icon-1024.png", size: 1024, svg: iconSvg({ rounded: false }) },
];

for (const { file, size, svg } of outputs) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL(file, OUT)));
  console.log(`✓ ${file}`);
}
await writeFile(new URL("favicon.svg", OUT), iconSvg({ size: 64, inset: 0.1, rounded: true }));
console.log("✓ favicon.svg");
