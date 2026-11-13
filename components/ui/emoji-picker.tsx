"use client";

import { cn } from "@/lib/utils/cn";

export function EmojiPicker({ value, onChange, options, label }: { value: string; onChange: (emoji: string) => void; options: string[]; label: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-callout font-semibold text-ink-2">{label}</legend>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {options.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={emoji}
            aria-pressed={value === emoji}
            onClick={() => onChange(emoji)}
            className={cn(
              "press flex size-12 shrink-0 items-center justify-center rounded-2xl border text-[24px]",
              value === emoji ? "border-brand bg-brand-soft" : "border-line/70 bg-surface",
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </fieldset>
  );
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
