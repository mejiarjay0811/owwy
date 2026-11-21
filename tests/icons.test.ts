import { describe, expect, it } from "vitest";
import { ACCOUNT_TYPE_LIST } from "@/lib/defaults/card-styles";
import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";
import { MAIN_GOALS } from "@/lib/defaults/main-goals";
import { DEFAULT_ICON, ICON_CHOICES, ICONS, iconFor, iconLabel, isIconName } from "@/lib/icons";

/**
 * Emoji used to stand in for icons. They render as a different typeface on
 * every platform, sit on the text baseline rather than a grid, and can't take
 * the palette's colour. These check the replacement is complete and that it
 * didn't need anyone's data migrated to get there.
 */
describe("the icon set", () => {
  it("offers every choice from the real registry", () => {
    for (const name of ICON_CHOICES) expect(ICONS[name], `${name} is offered but not drawn`).toBeDefined();
  });

  it("offers each one once", () => {
    expect(new Set(ICON_CHOICES).size).toBe(ICON_CHOICES.length);
  });

  it("is big enough to find something close", () => {
    expect(ICON_CHOICES.length).toBeGreaterThanOrEqual(60);
  });

  it("names them for a screen reader", () => {
    expect(iconLabel("groceries")).toBe("Groceries");
    expect(iconLabel("other")).toBe("Other");
  });
});

describe("reading what was stored", () => {
  it("draws an icon id", () => {
    expect(iconFor("groceries")).toBe(ICONS.groceries);
  });

  /**
   * The point of the legacy map: an install from before this change still has
   * emoji in its categories, bills and goals. Nothing was migrated — the
   * emoji simply resolve, so the app looks right the moment it loads.
   */
  it("draws the right icon for an emoji saved before icons existed", () => {
    expect(iconFor("\u{1F354}")).toBe(ICONS.food);
    expect(iconFor("\u{1F6D2}")).toBe(ICONS.groceries);
    expect(iconFor("\u{1F697}")).toBe(ICONS.transport);
    expect(iconFor("\u{1F437}")).toBe(ICONS.savings);
  });

  it("falls back rather than rendering nothing", () => {
    expect(iconFor(undefined)).toBe(ICONS[DEFAULT_ICON]);
    expect(iconFor("")).toBe(ICONS[DEFAULT_ICON]);
    expect(iconFor("\u{1F984}")).toBe(ICONS[DEFAULT_ICON]);
    expect(iconFor("an-icon-from-a-newer-version")).toBe(ICONS[DEFAULT_ICON]);
  });

  it("knows one of ours from an emoji", () => {
    expect(isIconName("groceries")).toBe(true);
    expect(isIconName("\u{1F354}")).toBe(false);
  });
});

describe("nothing Owwy ships still uses an emoji", () => {
  const PICTOGRAPH = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

  it("not the default categories", () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(PICTOGRAPH.test(c.emoji), `${c.name} still has an emoji`).toBe(false);
      expect(isIconName(c.emoji), `${c.name}'s icon "${c.emoji}" isn't in the registry`).toBe(true);
    }
  });

  it("not the account types", () => {
    for (const a of ACCOUNT_TYPE_LIST) {
      expect(PICTOGRAPH.test(a.icon), `${a.label} still has an emoji`).toBe(false);
      expect(isIconName(a.icon), `${a.label}'s icon isn't in the registry`).toBe(true);
    }
  });

  it("not the setup questions", () => {
    for (const g of MAIN_GOALS) {
      expect(PICTOGRAPH.test(g.icon), `${g.label} still has an emoji`).toBe(false);
      expect(isIconName(g.icon), `${g.label}'s icon isn't in the registry`).toBe(true);
    }
  });
});
