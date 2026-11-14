"use client";

import { Check, Monitor, Moon, Sun, SunMoon } from "lucide-react";
import { Money } from "@/components/ui/display";
import { Chip, Segmented } from "@/components/ui/form";
import { HeroPattern } from "@/components/ui/hero-pattern";
import { useFinance } from "@/hooks/use-finance";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { getHeroStyle, HERO_PATTERNS, HERO_STYLES, HERO_STYLE_THEME } from "@/lib/defaults/card-styles";
import { getPalette, PALETTES, paletteSwatches } from "@/lib/defaults/palettes";
import { LIGHT_HERO } from "@/lib/defaults/theme-css";
import { haptic } from "@/lib/platform";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { describeTimeOfDayTheme } from "@/lib/theme";
import { cn } from "@/lib/utils/cn";
import type { HeroPattern as Pattern, ThemePreference } from "@/types/models";

/**
 * Light/dark, the colour palette, and the finish on the balance card.
 *
 * The palette repaints the accent layer — buttons, links, chips, the active
 * tab, the balance card, the owl. It leaves the page surfaces alone on
 * purpose: the warm paper and the night forest were tuned so every caption
 * clears WCAG AA against them, and a theme picker that re-tints the page
 * behind the text is how readable copy quietly becomes grey-on-grey.
 *
 * Account cards keep their own finishes, chosen per card on the Wallet.
 */
export function AppearanceSection() {
  const { settings } = useFinance();
  const dark = useResolvedTheme() === "dark";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Segmented<ThemePreference>
          label="Theme"
          size="sm"
          // Four options don't fit with icons on a narrow phone; the labels carry the meaning.
          className="[&_svg]:hidden min-[400px]:[&_svg]:inline"
          value={settings.theme}
          onChange={(theme) => void updateSettings({ theme })}
          options={[
            { value: "light", label: "Light", icon: <Sun /> },
            { value: "dark", label: "Dark", icon: <Moon /> },
            { value: "system", label: "System", icon: <Monitor /> },
            { value: "timeOfDay", label: "Clock", icon: <SunMoon /> },
          ]}
        />
        <p className="mt-2.5 px-1 text-caption text-ink-3">
          {settings.theme === "timeOfDay"
            ? describeTimeOfDayTheme()
            : settings.theme === "system"
              ? "Follows your phone's light or dark setting."
              : "Clock follows the time of day — light in the morning, dark in the evening."}
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-callout font-semibold text-ink-2">Colour</legend>
        <div role="radiogroup" aria-label="Colour palette" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PALETTES.map((palette) => {
            const [brand, accent] = paletteSwatches(palette, dark);
            const selected = settings.palette === palette.id;
            return (
              <button
                key={palette.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  void haptic("light");
                  void updateSettings({ palette: palette.id });
                }}
                className={cn(
                  "press relative flex min-h-[72px] flex-col justify-between gap-2 rounded-2xl border-2 p-3 text-left outline-none",
                  selected ? "border-brand bg-brand-soft/50" : "border-line/70 bg-surface hover:border-line-strong",
                )}
              >
                <span className="flex items-center gap-1.5" aria-hidden>
                  <span className="size-6 rounded-full ring-1 ring-black/5 ring-inset" style={{ background: brand }} />
                  <span className="size-6 rounded-full ring-1 ring-black/5 ring-inset" style={{ background: accent }} />
                  {selected ? <Check className="ml-auto size-4 text-brand" /> : null}
                </span>
                <span className="text-callout font-bold">{palette.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-caption text-ink-3">{getPalette(settings.palette).hint}. Owwy&apos;s paper and night surfaces stay, so text stays easy to read.</p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-callout font-semibold text-ink-2">Balance card</legend>
        <BalancePreview />

        <p className="mt-4 mb-2 px-1 text-caption font-semibold text-ink-3">Finish</p>
        <div role="radiogroup" aria-label="Balance card finish" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {HERO_STYLES.map((style) => {
            const selected = settings.heroStyle === style.id;
            const follows = style.id === HERO_STYLE_THEME;
            return (
              <button
                key={style.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={style.name}
                title={style.name}
                onClick={() => {
                  void haptic("light");
                  void updateSettings({ heroStyle: style.id });
                }}
                className={cn(
                  "press relative aspect-[1.3] rounded-xl outline-none ring-2 ring-offset-2 ring-offset-surface",
                  selected ? "ring-brand" : "ring-transparent hover:ring-line-strong",
                )}
                style={{ background: style.background ?? "var(--hero-bg)" }}
              >
                {follows ? (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-hero-ink">AUTO</span>
                ) : null}
                {selected ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Check className={cn("size-4", style.tone === "light" ? "text-[#2b2418]" : "text-white")} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="mt-4 mb-2 px-1 text-caption font-semibold text-ink-3">Pattern</p>
        <div role="group" aria-label="Balance card pattern" className="flex flex-wrap gap-2">
          {HERO_PATTERNS.map((p) => (
            <Chip
              key={p.id}
              selected={settings.heroPattern === p.id}
              onClick={() => {
                void haptic("light");
                void updateSettings({ heroPattern: p.id as Pattern });
              }}
            >
              {p.name}
            </Chip>
          ))}
        </div>
        <p className="mt-2.5 px-1 text-caption text-ink-3">
          Used wherever Owwy shows a big total — Safe to spend, your wallet, your goals. Your account cards keep their own finishes.
        </p>
      </fieldset>
    </div>
  );
}

/** The real thing at half size, so what you pick is what you'll see. */
function BalancePreview() {
  const { settings, state } = useFinance();
  const style = getHeroStyle(settings.heroStyle);

  return (
    <div
      className="hero-surface relative isolate overflow-hidden rounded-[22px] p-4"
      // The finish is set here as well as on the document, so the preview is
      // right on the render that follows the tap rather than on the one after
      // the attribute catches up — and so it stays right while scrolled past
      // whatever `data-hero` happens to be.
      style={style.background ? ({ background: style.background, ...(style.tone === "light" ? LIGHT_HERO : null) } as React.CSSProperties) : undefined}
    >
      <HeroPattern pattern={settings.heroPattern} />
      <p className="text-eyebrow font-bold tracking-[0.12em] text-hero-ink-2 uppercase">Safe to spend</p>
      <p className="mt-0.5 text-[1.75rem] leading-none font-extrabold tracking-tight">
        <Money value={state.safeToSpend.amount} whole />
      </p>
      <p className="mt-1.5 text-caption text-hero-ink-2">{style.name}</p>
    </div>
  );
}
