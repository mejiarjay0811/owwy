// Minimal static server for previewing the production export (out/) — `npm run preview`.
// Listens on every interface, so a phone on the same Wi-Fi can open it too.
import { createReadStream, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

/** Flags beat env vars here: `FOO=1 node …` is not portable to Windows shells. */
const flag = (name) => {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : true;
};

// --root lets the same server preview the marketing site: --root=site --port=4180
const rootDir = flag("root") ?? process.env.ROOT;
const ROOT = fileURLToPath(new URL(typeof rootDir === "string" ? `../${rootDir}/` : "../out/", import.meta.url));
const PORT = Number(flag("port") ?? process.env.PORT ?? 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

async function resolve(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidates = [join(ROOT, safe), join(ROOT, safe, "index.html"), join(ROOT, `${safe}.html`)];
  for (const file of candidates) {
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      // try next
    }
  }
  return null;
}

async function handle(req, res) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (!url.pathname.endsWith("/") && !extname(url.pathname)) {
    res.writeHead(308, { Location: `${url.pathname}/${url.search}` });
    return res.end();
  }
  const file = await resolve(url.pathname);
  if (!file) {
    res.writeHead(404, { "Content-Type": TYPES[".html"] });
    return createReadStream(join(ROOT, "404.html")).pipe(res);
  }
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Cache-Control": file.endsWith("sw.js") ? "no-cache" : file.includes("_next") ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...vercelHeaders(url.pathname),
  });
  createReadStream(file).pipe(res);
}

/**
 * Production headers, read from vercel.json rather than restated here, so what
 * you test locally is what Vercel will send. Set HEADERS=1 to switch them on —
 * it is the only way to catch a Content-Security-Policy that breaks the app
 * before it reaches production.
 */
const vercelHeaders = (() => {
  if (!flag("headers") && process.env.HEADERS !== "1") return () => ({});
  let rules = [];
  try {
    rules = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")).headers ?? [];
  } catch {
    console.warn("HEADERS=1 but vercel.json could not be read");
    return () => ({});
  }
  const compiled = rules.map((rule) => ({
    test: new RegExp(`^${rule.source.split("(.*)").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.*)")}$`),
    headers: rule.headers,
  }));
  console.log(`applying ${compiled.length} header rules from vercel.json`);
  return (pathname) => {
    const out = {};
    for (const rule of compiled) {
      if (!rule.test.test(pathname)) continue;
      // Later rules win, matching Vercel's own precedence.
      for (const h of rule.headers) out[h.key] = h.value;
    }
    return out;
  };
})();

/** Addresses a phone on the same network can reach (skipping link-local noise). */
function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254."))
    .map((net) => net.address);
}

// HTTPS only if you point SSL_CERT/SSL_KEY at a certificate. The service worker,
// install-to-home-screen, the PIN lock and encrypted backups all need a secure
// context, and a plain LAN address is not one — see README → "Test it on a phone".
const certPath = process.env.SSL_CERT;
const keyPath = process.env.SSL_KEY;
const secure = Boolean(certPath && keyPath);
const server = secure ? createHttpsServer({ cert: readFileSync(certPath), key: readFileSync(keyPath) }, handle) : createHttpServer(handle);

server.listen(PORT, () => {
  const scheme = secure ? "https" : "http";
  console.log(`Owwy preview → ${scheme}://localhost:${PORT}`);
  for (const address of lanAddresses()) console.log(`         phone → ${scheme}://${address}:${PORT}`);
  if (!secure) console.log("                 (plain http: no offline mode, no install, no PIN lock)");
});
