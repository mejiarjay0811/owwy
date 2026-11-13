import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The trail that decides whether a navigation went back or forward.
 *
 * Worth testing directly: the version this replaced inferred the direction
 * from a `popstate` flag, which Next's own listener beats to the punch — so
 * "did we go back?" was silently wrong and scroll restoration never fired.
 * This answers the same question from the trail alone, with no events in it.
 *
 * The module keeps state at module scope, so each test gets a fresh copy.
 */
async function freshModule() {
  vi.resetModules();
  return import("@/lib/nav-history");
}

describe("nav history", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("calls the very first screen neither back nor forward", async () => {
    const { recordNavigation } = await freshModule();
    expect(recordNavigation("/")).toBe("initial");
  });

  it("calls a new screen forward", async () => {
    const { recordNavigation } = await freshModule();
    recordNavigation("/");
    expect(recordNavigation("/more/")).toBe("forward");
    expect(recordNavigation("/settings/")).toBe("forward");
  });

  it("calls a return to the screen behind you back", async () => {
    const { recordNavigation } = await freshModule();
    recordNavigation("/");
    recordNavigation("/more/");
    recordNavigation("/settings/");
    expect(recordNavigation("/more/")).toBe("back");
  });

  it("unwinds one screen at a time", async () => {
    const { recordNavigation, previousPath } = await freshModule();
    recordNavigation("/");
    recordNavigation("/more/");
    recordNavigation("/settings/");
    expect(recordNavigation("/more/")).toBe("back");
    expect(previousPath()).toBe("/");
    expect(recordNavigation("/")).toBe("back");
    expect(previousPath()).toBeUndefined();
  });

  it("ignores a re-render on the same screen", async () => {
    const { recordNavigation, previousPath } = await freshModule();
    recordNavigation("/");
    recordNavigation("/more/");
    expect(recordNavigation("/more/")).toBe("forward");
    // The trail must not grow, or "back" would land on /more/ itself.
    expect(previousPath()).toBe("/");
  });

  it("treats a jump to a screen you never came from as forward", async () => {
    const { recordNavigation } = await freshModule();
    recordNavigation("/");
    recordNavigation("/more/");
    expect(recordNavigation("/budgets/")).toBe("forward");
  });

  it("tells the back chevron when it points at where you came from", async () => {
    const { recordNavigation, isBackTo } = await freshModule();
    recordNavigation("/");
    recordNavigation("/more/");
    recordNavigation("/settings/");
    expect(isBackTo("/more/")).toBe(true);
    // Settings' header points at /more/, but a deep link straight to it has
    // no trail behind it — the chevron must navigate, not call back().
    expect(isBackTo("/")).toBe(false);
  });

  it("has nothing to go back to on a cold start", async () => {
    const { recordNavigation, isBackTo, previousPath } = await freshModule();
    recordNavigation("/settings/");
    expect(previousPath()).toBeUndefined();
    expect(isBackTo("/more/")).toBe(false);
  });

  it("does not grow without bound on a long session", async () => {
    const { recordNavigation, previousPath } = await freshModule();
    for (let i = 0; i < 200; i++) recordNavigation(`/screen-${i}/`);
    expect(previousPath()).toBe("/screen-198/");
    expect(recordNavigation("/screen-198/")).toBe("back");
  });
});
