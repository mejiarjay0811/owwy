import { getDB } from "@/lib/storage/db";
import { randomBytes } from "./crypto";

/**
 * Device-bound secret storage for things like the user's own AI API key.
 *
 * A non-extractable AES-GCM key is generated once and stored in IndexedDB as a
 * CryptoKey object: its raw bytes can never be read by JavaScript, exported,
 * or included in a backup. Secrets are encrypted with it at rest.
 * Native builds can swap this for the platform keychain/keystore.
 */

const DEVICE_KEY_ID = "device-key";

async function deviceKey(): Promise<CryptoKey> {
  const db = getDB();
  const existing = await db.secrets.get(DEVICE_KEY_ID);
  if (existing?.key) return existing.key;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await db.secrets.put({ id: DEVICE_KEY_ID, key, updatedAt: Date.now() });
  return key;
}

export async function saveSecret(id: string, value: string): Promise<void> {
  const key = await deviceKey();
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  await getDB().secrets.put({ id, iv, ciphertext, updatedAt: Date.now() });
}

export async function readSecret(id: string): Promise<string | null> {
  const record = await getDB().secrets.get(id);
  if (!record?.iv || !record.ciphertext) return null;
  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv }, await deviceKey(), record.ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

export async function hasSecret(id: string): Promise<boolean> {
  const record = await getDB().secrets.get(id);
  return Boolean(record?.ciphertext);
}

export async function deleteSecret(id: string): Promise<void> {
  await getDB().secrets.delete(id);
}

export const ANTHROPIC_KEY_ID = "anthropic-api-key";
