"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

/**
 * Lightweight SVG donut. Segments are separated by a small gap so adjacent
 * colors never have to be distinguished by hue alone; the legend beside it
 * always carries labels and amounts.
 */
export function DonutChart({
  segments,
  size = 180,
  thickness = 22,
  label,
  children,
  activeId,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  label: string;
  children?: React.ReactNode;
  activeId?: string | null;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const total = segments.reduce((t, s) => t + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = segments.length > 1 ? Math.min(6, circumference * 0.012) : 0;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((segment) => {
            const length = (segment.value / total) * circumference;
            const dash = Math.max(0, length - gap);
            const element = (
              <circle
                key={segment.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={activeId === segment.id ? thickness + 6 : thickness}
                strokeDasharray={`${drawn ? dash : 0} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                opacity={activeId && activeId !== segment.id ? 0.35 : 1}
                style={{ transition: "stroke-dasharray 800ms var(--ease-soft), opacity 200ms, stroke-width 200ms" }}
              />
            );
            offset += length;
            return element;
          })}
      </svg>
      {children ? <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div> : null}
    </div>
  );
}

export interface LinePoint {
  key: string;
  label: string;
  value: number;
}

/**
 * Smooth-ish line with a soft area fill. Points from `projectedFrom` onward are
 * dashed, so future estimates never look like recorded history.
 */
export function LineChart({
  data,
  height = 160,
  label,
  formatValue,
  projectedFrom,
  tickEvery = 1,
  color = "var(--brand)",
}: {
  data: LinePoint[];
  height?: number;
  label: string;
  formatValue: (value: number) => string;
  projectedFrom?: number;
  tickEvery?: number;
  color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 600;
  const pad = { top: 16, bottom: 8 };
  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const x = (i: number) => (data.length <= 1 ? width / 2 : (i / (data.length - 1)) * width);
  const y = (v: number) => pad.top + (1 - (v - min) / range) * (height - pad.top - pad.bottom);
  const points = data.map((d, i) => [x(i), y(d.value)] as const);
  const path = (pts: readonly (readonly [number, number])[]) => pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const split = projectedFrom === undefined ? points.length : Math.max(1, projectedFrom);
  const solid = points.slice(0, split);
  const dashed = projectedFrom === undefined ? [] : points.slice(split - 1);
  const gradientId = `line-${label.replace(/\W/g, "")}`;
  const active = hover ?? data.length - 1;

  if (!data.length) return null;

  return (
    <figure aria-label={label}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-auto w-full touch-none overflow-visible"
          style={{ height }}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            setHover(Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1)))));
          }}
          onPointerLeave={() => setHover(null)}
          aria-hidden
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {min < 0 ? <line x1="0" x2={width} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" /> : null}
          <path d={`${path(solid)} L${solid.at(-1)![0]},${height} L${solid[0][0]},${height} Z`} fill={`url(#${gradientId})`} />
          <path d={path(solid)} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {dashed.length > 1 ? <path d={path(dashed)} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" opacity="0.7" vectorEffect="non-scaling-stroke" /> : null}
          <line x1={points[active][0]} x2={points[active][0]} y1={pad.top} y2={height} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg-elevated"
          style={{ left: `${(points[active][0] / width) * 100}%`, top: points[active][1], background: color }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -top-1 rounded-lg bg-ink px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-ink-inverse"
          // Anchor from whichever side keeps the label inside the chart.
          style={points[active][0] / width > 0.55 ? { right: `${Math.max(0, 100 - (points[active][0] / width) * 100 - 4)}%` } : { left: `${Math.max(0, (points[active][0] / width) * 100 - 4)}%` }}
          aria-hidden
        >
          {data[active].label}: {formatValue(data[active].value)}
          {projectedFrom !== undefined && active >= projectedFrom ? " (est.)" : ""}
        </span>
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-ink-3" aria-hidden>
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center first:text-left last:text-right">
            {i === 0 || i === data.length - 1 || i % tickEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>
                {formatValue(d.value)}
                {projectedFrom !== undefined && i >= projectedFrom ? " (estimate)" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export interface BarDatum {
  key: string;
  value: number;
  label: string;
  highlight?: boolean;
  muted?: boolean;
}

/**
 * A chart small enough to sit inside a tile beside the number it explains:
 * no axes, no ticks, no labels — just the shape of the last few days.
 *
 * It carries no information the tile's own text doesn't already state, so
 * it is hidden from assistive tech rather than given a redundant summary.
 */
export function Sparkbars({ data, className }: { data: BarDatum[]; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("flex h-8 items-end gap-[3px]", className)} aria-hidden>
      {data.map((d) => (
        <span
          key={d.key}
          className={cn("min-h-[2px] flex-1 rounded-sm", d.highlight ? "bg-brand" : d.value > 0 ? "bg-brand/30" : "bg-line")}
          style={{ height: `${Math.max(6, (d.value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** Simple vertical bars with an optional average line. */
export function BarChart({
  data,
  height = 120,
  average,
  label,
  formatValue,
  tickEvery = 5,
}: {
  data: BarDatum[];
  height?: number;
  average?: number;
  label: string;
  formatValue: (value: number) => string;
  tickEvery?: number;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const max = Math.max(1, ...data.map((d) => d.value), average ?? 0);

  return (
    <figure aria-label={label}>
      <div className="relative" style={{ height }}>
        {average && average > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-ink-3/60" style={{ bottom: `${(average / max) * 100}%` }}>
            <span className="absolute -top-5 right-0 rounded bg-bg-elevated px-1 text-[10px] font-semibold text-ink-3">avg {formatValue(average)}</span>
          </div>
        ) : null}
        <div className="flex h-full items-end gap-[3px]">
          {data.map((d) => (
            <div key={d.key} className="group relative flex h-full flex-1 items-end">
              <div
                className={cn("w-full rounded-t-[4px] transition-[height] duration-700 ease-[var(--ease-soft)]", d.highlight ? "bg-accent" : d.muted ? "bg-surface-3" : "bg-brand/80")}
                style={{ height: drawn ? `${Math.max(d.value > 0 ? 3 : 0, (d.value / max) * 100)}%` : "0%" }}
              />
              {d.value > 0 ? (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-ink-inverse group-hover:block">
                  {d.label}: {formatValue(d.value)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[3px] text-[10px] font-semibold text-ink-3" aria-hidden>
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center">
            {i === 0 || (i + 1) % tickEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
