"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

/** Rows shown before "Show all" appears, at the 6-per-row phone layout. */
const COLLAPSED_ROWS = 3;

/**
 * Picks an icon from a grid.
 *
 * This used to be a single horizontal strip, which hid most of the choices
 * behind a sideways scroll nobody expects inside a form — you couldn't see
 * what was on offer without dragging. A wrapping grid shows the whole set at
 * once, and a long set collapses to the first few rows with everything one
 * tap away.
 */
export function EmojiPicker({ value, onChange, options, label }: { value: string; onChange: (emoji: string) => void; options: string[]; label: string }) {
  const perRow = 6;
  const collapsedCount = COLLAPSED_ROWS * perRow;
  const collapsible = options.length > collapsedCount;
  const [expanded, setExpanded] = useState(false);

  // The chosen icon is always visible, even when it lives past the fold.
  const shown = !collapsible || expanded ? options : withSelected(options.slice(0, collapsedCount), value, options);

  return (
    <fieldset>
      <legend className="mb-2 text-callout font-semibold text-ink-2">{label}</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {shown.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={emoji}
            aria-pressed={value === emoji}
            onClick={() => onChange(emoji)}
            className={cn(
              "press flex aspect-square min-h-11 items-center justify-center rounded-2xl border text-[24px]",
              value === emoji ? "border-brand bg-brand-soft" : "border-line/70 bg-surface hover:border-line-strong",
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="press hit mt-2 inline-flex items-center gap-1 text-callout font-semibold text-brand"
        >
          {expanded ? "Show fewer" : `All ${options.length} icons`}
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      ) : null}
    </fieldset>
  );
}

function withSelected(visible: string[], value: string, all: string[]): string[] {
  if (!value || visible.includes(value) || !all.includes(value)) return visible;
  return [value, ...visible.slice(0, -1)];
}

export function ColorPicker({ value, onChange, options, label }: { value: string; onChange: (color: string) => void; options: string[]; label: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-callout font-semibold text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-2.5">
        {options.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Color ${color}`}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            className={cn("press size-9 rounded-full ring-offset-2 ring-offset-bg-elevated", value === color && "ring-2 ring-ink")}
            style={{ background: color }}
          />
        ))}
      </div>
    </fieldset>
  );
}
