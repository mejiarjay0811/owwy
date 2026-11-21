/**
 * Draws the Android launcher, adaptive and notification icons from the one
 * 1024px source, so they can never drift apart.
 *
 *   node scripts/native-icons.mjs
 *
 * Run it after `npx cap add android`, which lays down Capacitor's own
 * placeholder icons; this replaces every one of them with Owwy's.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";

const SRC = "public/icons/app-icon-1024.png";
const RES = "android/app/src/main/res";
const BRAND = "#14463f";

if (!existsSync("android")) {
  console.error("No android/ project yet. Run `npx cap add android` first.");
  process.exit(1);
}

/** Launcher icon sizes, by density. */
const LAUNCHER = [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
];

/**
 * The adaptive foreground is drawn into the middle ~62% of the canvas.
 *
 * Android masks the outer ring to whatever shape the launcher uses and can
 * animate the layer around, so artwork outside the safe zone gets clipped.
 */
const FOREGROUND = [
  ["mdpi", 108],
  ["hdpi", 162],
  ["xhdpi", 216],
  ["xxhdpi", 324],
  ["xxxhdpi", 432],
];

/** Notification icons are a white silhouette; Android tints them itself. */
const NOTIFICATION = [
  ["mdpi", 24],
  ["hdpi", 36],
  ["xhdpi", 48],
  ["xxhdpi", 72],
  ["xxxhdpi", 96],
];

const rounded = (size) =>
  Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size / 2}" ry="${size / 2}" fill="#fff"/></svg>`);

let written = 0;
const put = async (dir, name, buffer) => {
  await mkdir(`${RES}/${dir}`, { recursive: true });
  await writeFile(`${RES}/${dir}/${name}`, buffer);
  written++;
};

for (const [density, size] of LAUNCHER) {
  const square = await sharp(SRC).resize(size, size).png().toBuffer();
  await put(`mipmap-${density}`, "ic_launcher.png", square);
  await put(
    `mipmap-${density}`,
    "ic_launcher_round.png",
    await sharp(square).composite([{ input: rounded(size), blend: "dest-in" }]).png().toBuffer(),
  );
}

for (const [density, size] of FOREGROUND) {
  const inner = Math.round(size * 0.62);
  const pad = Math.round((size - inner) / 2);
  await put(
    `mipmap-${density}`,
    "ic_launcher_foreground.png",
    await sharp(SRC)
      .resize(inner, inner)
      .extend({ top: pad, bottom: size - inner - pad, left: pad, right: size - inner - pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
  );
}

for (const [density, size] of NOTIFICATION) {
  // Flattened to white: the status bar draws the alpha channel only, so a
  // colour icon shows up as a grey smudge.
  await put(
    `drawable-${density}`,
    "ic_stat_owwy.png",
    await sharp(SRC)
      .resize(size, size)
      .ensureAlpha()
      .extractChannel("alpha")
      .toColourspace("b-w")
      .negate({ alpha: false })
      .png()
      .toBuffer()
      .then((mask) =>
        sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
          .composite([{ input: mask, blend: "dest-over" }])
          .png()
          .toBuffer(),
      ),
  );
}

await mkdir(`${RES}/values`, { recursive: true });
await writeFile(
  `${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BRAND}</color>\n</resources>\n`,
);
written++;

for (const dir of ["mipmap-anydpi-v26"]) {
  await mkdir(`${RES}/${dir}`, { recursive: true });
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  await writeFile(`${RES}/${dir}/ic_launcher.xml`, xml);
  await writeFile(`${RES}/${dir}/ic_launcher_round.xml`, xml);
  written += 2;
}

console.log(`${written} icon files written from ${SRC}`);
