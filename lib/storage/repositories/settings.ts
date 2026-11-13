import { createDefaultSettings, DEFAULT_DASHBOARD } from "@/lib/defaults/settings";
import type { AppSettings } from "@/types/models";
import { getDB } from "../db";
import { settingsSchema, validate } from "../schemas";

export type SettingsPatch = Partial<
  Omit<AppSettings, "id" | "income" | "safeToSpend" | "security" | "assistant" | "createdAt" | "updatedAt">
> & {
  income?: Partial<AppSettings["income"]>;
  safeToSpend?: Partial<AppSettings["safeToSpend"]>;
  security?: Partial<AppSettings["security"]>;
  assistant?: Partial<AppSettings["assistant"]>;
};

/** Returns stored settings, filling in fields added by newer app versions. */
export async function getSettings(): Promise<AppSettings> {
  const db = getDB();
  const stored = await db.settings.get("app");
  if (!stored) {
    const defaults = createDefaultSettings();
    await db.settings.put(defaults);
    return defaults;
  }
  return withDefaults(stored);
}

export function withDefaults(stored: Partial<AppSettings>): AppSettings {
  const defaults = createDefaultSettings(stored.createdAt);
  // Insert widgets introduced after the user customized their dashboard at their default position.
  const dashboard = [...(stored.dashboard ?? defaults.dashboard)].filter((w) => DEFAULT_DASHBOARD.some((d) => d.id === w.id));
  DEFAULT_DASHBOARD.forEach((widget, index) => {
    if (!dashboard.some((d) => d.id === widget.id)) dashboard.splice(Math.min(index, dashboard.length), 0, { ...widget });
  });
  return {
    ...defaults,
    ...stored,
    income: { ...defaults.income, ...stored.income },
    safeToSpend: { ...defaults.safeToSpend, ...stored.safeToSpend },
    security: { ...defaults.security, ...stored.security },
    assistant: { ...defaults.assistant, ...stored.assistant },
    dashboard,
    schemaVersion: defaults.schemaVersion,
    id: "app",
  };
}

export async function updateSettings(patch: SettingsPatch): Promise<AppSettings> {
  const db = getDB();
  return db.transaction("rw", db.settings, async () => {
    const current = withDefaults((await db.settings.get("app")) ?? {});
    const next: AppSettings = {
      ...current,
      ...patch,
      income: { ...current.income, ...patch.income },
      safeToSpend: { ...current.safeToSpend, ...patch.safeToSpend },
      security: { ...current.security, ...patch.security },
      assistant: { ...current.assistant, ...patch.assistant },
      id: "app",
      updatedAt: Date.now(),
    };
    validate(settingsSchema, next);
    await db.settings.put(next);
    return next;
  });
}
