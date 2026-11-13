/**
 * Web Crypto helpers. Everything runs locally; nothing leaves the device.
 * - PIN: PBKDF2-SHA256 with a random salt; only the derived hash is stored.
 * - Backups: AES-256-GCM with a key derived from the user's passphrase.
 */

export const PIN_ITERATIONS = 210_000;
export const BACKUP_ITERATIONS = 310_000;

function subtle(): SubtleCrypto {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Secure crypto isn't available in this browser. Open Owwy over HTTPS or in the installed app.");
  }
  return crypto.subtle;
}

export function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function pbkdf2Key(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await subtle().importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveBits", "deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export interface PinHash {
  hash: string;
  salt: string;
  iterations: number;
}

export async function hashPin(pin: string, salt = randomBytes(16), iterations = PIN_ITERATIONS): Promise<PinHash> {
  const key = await pbkdf2Key(pin, salt, iterations);
  const raw = await subtle().exportKey("raw", key);
  return { hash: toBase64(raw), salt: toBase64(salt), iterations };
}

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  const candidate = await hashPin(pin, fromBase64(stored.salt), stored.iterations);
  return constantTimeEqual(candidate.hash, stored.hash);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface EncryptedPayload {
  format: "owwy-backup-encrypted";
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export async function encryptText(plaintext: string, passphrase: string): Promise<EncryptedPayload> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await pbkdf2Key(passphrase, salt, BACKUP_ITERATIONS);
  const ciphertext = await subtle().encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return {
    format: "owwy-backup-encrypted",
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations: BACKUP_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

export async function decryptText(payload: EncryptedPayload, passphrase: string): Promise<string> {
  const key = await pbkdf2Key(passphrase, fromBase64(payload.salt), payload.iterations);
  try {
    const plaintext = await subtle().decrypt({ name: "AES-GCM", iv: fromBase64(payload.iv) }, key, fromBase64(payload.ciphertext));
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error("That passphrase didn't unlock this backup.");
  }
}
