import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDashboard, isPhoneScreen, SCHEMA_VERSION } from "@/lib/defaults/settings";
import { withDefaults } from "@/lib/storage/repositories/settings";
import type { DashboardWidget } from "@/types/models";

/**
 * The Grove is the whole first screenful on a phone, so it starts off there
 * and on everywhere else — and an install that predates that decision has to
 * be moved across exactly once, or it would fight the user every reload.
 *
 * The tests run in node, where there is no window; `isPhoneScreen` has to
 * answer "no" rather than throw, so a prerender or a test never silently
 * changes someone's home screen.
 */
const asPhone = (matches: boolean) => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches }) });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const grove = (dashboard: DashboardWidget[]) => dashboard.find((w) => w.id === "grove");

describe("home defaults", () => {
  it("assumes not a phone when there is no window to ask", () => {
    expect(isPhoneScreen()).toBe(false);
  });

  it("reads the screen rather than the user agent", () => {
    asPhone(true);
    expect(isPhoneScreen()).toBe(true);
    asPhone(false);
    expect(isPhoneScreen()).toBe(false);
  });

  it("starts the Grove off on a phone and on everywhere else", () => {
    expect(grove(defaultDashboard(true))?.visible).toBe(false);
    expect(grove(defaultDashboard(false))?.visible).toBe(true);
  });

  it("changes nothing else about the home screen", () => {
    const phone = defaultDashboard(true);
    const desktop = defaultDashboard(false);
    expect(phone.map((w) => w.id)).toEqual(desktop.map((w) => w.id));
    expect(phone.filter((w) => w.id !== "grove")).toEqual(desktop.filter((w) => w.id !== "grove"));
  });
});

describe("the one-off move to v4", () => {
  it("turns the Grove off on a phone that had it on", () => {
    asPhone(true);
    const next = withDefaults({ schemaVersion: 3, dashboard: defaultDashboard(false) });
    expect(grove(next.dashboard)?.visible).toBe(false);
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("leaves a desktop alone", () => {
    asPhone(false);
    const next = withDefaults({ schemaVersion: 3, dashboard: defaultDashboard(false) });
    expect(grove(next.dashboard)?.visible).toBe(true);
  });

  it("never runs twice, so turning it back on sticks", () => {
    asPhone(true);
    // The user has turned it back on, and the version has already moved.
    const chosen = defaultDashboard(false);
    const next = withDefaults({ schemaVersion: SCHEMA_VERSION, dashboard: chosen });
    expect(grove(next.dashboard)?.visible).toBe(true);
  });

  it("does not resurrect the Grove for someone who had already hidden it", () => {
    asPhone(false);
    const hidden = defaultDashboard(false).map((w) => (w.id === "grove" ? { ...w, visible: false } : w));
    expect(grove(withDefaults({ schemaVersion: 3, dashboard: hidden }).dashboard)?.visible).toBe(false);
  });

  it("keeps the rest of a customized home exactly as it was", () => {
    asPhone(true);
    const reordered = [...defaultDashboard(false)].reverse().map((w) => (w.id === "recent" ? { ...w, visible: false } : w));
    const next = withDefaults({ schemaVersion: 3, dashboard: reordered });
    expect(next.dashboard.map((w) => w.id)).toEqual(reordered.map((w) => w.id));
    expect(next.dashboard.find((w) => w.id === "recent")?.visible).toBe(false);
  });
});
