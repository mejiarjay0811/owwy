"use client";

/**
 * Platform adapter. The web/PWA build works on its own; when packaged with
 * Capacitor, native plugins are loaded lazily for a better experience.
 * Every function degrades gracefully when a capability is unavailable.
 */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNative(): boolean {
  return Boolean(capacitor()?.isNativePlatform?.());
}

export function platformName(): "ios" | "android" | "web" {
  const name = capacitor()?.getPlatform?.();
  return name === "ios" || name === "android" ? name : "web";
}

/* ------------------------------------------------------------ Haptics */

export type HapticKind = "light" | "medium" | "success" | "warning";

export async function haptic(kind: HapticKind = "light"): Promise<void> {
  try {
    if (isNative()) {
      const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
      if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
      else if (kind === "warning") await Haptics.notification({ type: NotificationType.Warning });
      else await Haptics.impact({ style: kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light });
      return;
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigator.vibrate(kind === "success" ? [8, 40, 12] : kind === "warning" ? [20, 60, 20] : 6);
    }
  } catch {
    // Haptics are a nicety; never let them break an action.
  }
}

/* ------------------------------------------------------------ Files */

/**
 * Saves a generated file. Web: triggers a download. Native: writes to the
 * cache directory and opens the share sheet so the user decides where it goes.
 */
export async function saveFile(filename: string, content: string, mimeType: string): Promise<void> {
  if (isNative()) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const result = await Filesystem.writeFile({ path: filename, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: filename, url: result.uri, dialogTitle: "Save your Owwy export" });
    return;
  }
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------ Storage durability */

export interface StorageStatus {
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

/** Asks the browser not to evict Owwy's data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (isNative()) return true;
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  try {
    if (isNative()) return { persisted: true, usageBytes: null, quotaBytes: null };
    const [persisted, estimate] = await Promise.all([navigator.storage?.persisted?.() ?? null, navigator.storage?.estimate?.() ?? null]);
    return { persisted, usageBytes: estimate?.usage ?? null, quotaBytes: estimate?.quota ?? null };
  } catch {
    return { persisted: null, usageBytes: null, quotaBytes: null };
  }
}

/* ------------------------------------------------------------ Notifications */

export interface ReminderInput {
  id: string;
  title: string;
  body: string;
  at: Date;
}

/**
 * Schedules on-device bill reminders in the native app. Browsers can't
 * schedule notifications without a server, so the web app shows reminders
 * in-app instead (Upcoming bills, Owwy's messages).
 */
export async function scheduleReminders(reminders: ReminderInput[]): Promise<"scheduled" | "denied" | "unsupported"> {
  if (!isNative()) return "unsupported";
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== "granted") return "denied";
    }
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    const now = Date.now();
    await LocalNotifications.schedule({
      notifications: reminders
        .filter((r) => r.at.getTime() > now)
        .slice(0, 60)
        .map((r) => ({ id: hashId(r.id), title: r.title, body: r.body, schedule: { at: r.at, allowWhileIdle: true } })),
    });
    return "scheduled";
  } catch {
    return "unsupported";
  }
}

function hashId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  return Math.abs(hash) % 2_000_000_000;
}

/* ------------------------------------------------------------ Biometrics */

/**
 * Native builds can register a biometric plugin (e.g. a Capacitor biometric
 * auth plugin) under `window.OwwyBiometrics`. The web build hides the option.
 */
interface BiometricBridge {
  isAvailable: () => Promise<boolean>;
  verify: (reason: string) => Promise<boolean>;
}

function biometricBridge(): BiometricBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { OwwyBiometrics?: BiometricBridge }).OwwyBiometrics;
}

export async function biometricsAvailable(): Promise<boolean> {
  try {
    return (await biometricBridge()?.isAvailable()) ?? false;
  } catch {
    return false;
  }
}

export async function verifyBiometrics(reason = "Unlock Owwy"): Promise<boolean> {
  try {
    return (await biometricBridge()?.verify(reason)) ?? false;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ Status bar */

export async function syncStatusBar(theme: "light" | "dark"): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light });
    if (platformName() === "android") await StatusBar.setBackgroundColor({ color: theme === "dark" ? "#0a1110" : "#f6f3ec" });
  } catch {
    // Ignore: status bar styling is cosmetic.
  }
}
