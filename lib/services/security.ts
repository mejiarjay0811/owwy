import { hashPin, verifyPin } from "@/lib/security/crypto";
import { getSettings, updateSettings } from "@/lib/storage/repositories/settings";

export const PIN_LENGTH = { min: 4, max: 6 };

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH.min},${PIN_LENGTH.max}}$`).test(pin);
}

export async function enablePin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error(`Use ${PIN_LENGTH.min} to ${PIN_LENGTH.max} digits.`);
  const { hash, salt, iterations } = await hashPin(pin);
  await updateSettings({ security: { pinEnabled: true, pinHash: hash, pinSalt: salt, pinIterations: iterations, pinLength: pin.length } });
}

export async function disablePin(): Promise<void> {
  await updateSettings({
    security: { pinEnabled: false, pinHash: undefined, pinSalt: undefined, pinIterations: undefined, pinLength: undefined, biometricEnabled: false },
  });
}

export async function checkPin(pin: string): Promise<boolean> {
  const { security } = await getSettings();
  if (!security.pinEnabled || !security.pinHash || !security.pinSalt) return true;
  return verifyPin(pin, { hash: security.pinHash, salt: security.pinSalt, iterations: security.pinIterations ?? 210_000 });
}

/** Escalating cooldown after repeated wrong PINs: 5 tries, then 30s, 60s, 120s… */
export function lockoutSeconds(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  return Math.min(900, 30 * 2 ** Math.floor((failedAttempts - 5) / 3));
}
