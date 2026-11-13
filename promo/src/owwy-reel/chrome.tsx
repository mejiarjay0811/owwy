import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { jitter } from "../showreel/primitives";
import { E, ramp, SANS } from "../showreel/theme";
import { O } from "./theme";

/** A scene's backdrop, with an optional impact shake. */
export const Stage: React.FC<{ bg?: string; children: React.ReactNode; shake?: number }> = ({ bg = O.bg, children, shake = 0 }) => {
  const f = useCurrentFrame();
  const t = shake ? `translate(${jitter(`x${f}`, shake)}px, ${jitter(`y${f}`, shake)}px)` : undefined;
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: t }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A soft pool of brand light, so the dark chapters have depth rather than flatness. */
export const Glow: React.FC<{ color?: string; size?: number; x?: number; y?: number; opacity?: number }> = ({
  color = O.brand,
  size = 70,
  x = 50,
  y = 50,
  opacity = 0.2,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(${size}% ${size}% at ${x}% ${y}%, ${color}${Math.round(opacity * 255)
        .toString(16)
        .padStart(2, "0")} 0%, transparent 70%)`,
    }}
  />
);

/** The tracked-out caption each chapter signs off with. */
export const Label: React.FC<{ text: string; f: number; at?: number; top: number; color?: string }> = ({ text, f, at = 0, top, color = O.brand }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top,
      textAlign: "center",
      fontFamily: SANS,
      fontSize: 19,
      fontWeight: 700,
      letterSpacing: "0.42em",
      color,
      opacity: ramp(f, [at, at + 22], [0, 0.9], E.outExpo),
      transform: `translateY(${ramp(f, [at, at + 26], [16, 0], E.outExpo)}px)`,
    }}
  >
    {text}
  </div>
);

/**
 * Scenes are reused between the 15-second cut and the minute, where the same
 * chapter can run three times as long. `len` is the slot the scene was given,
 * so its tail can be scheduled against the slot rather than against a constant
 * that would leave the long version holding on a dead frame.
 */
export interface SceneProps {
  len?: number;
}

/** A slow push-in across the whole chapter, so even a long hold keeps moving. */
export const push = (f: number, len: number, amount = 0.055): number => 1 + ramp(f, [0, len], [0, amount], E.inOutCubic);

/** A money figure that counts up, in the app's own formatting. */
export const Counter: React.FC<{ to: number; f: number; from?: number; over?: number; style?: React.CSSProperties; decimals?: number }> = ({
  to,
  f,
  from = 8,
  over = 60,
  style,
  decimals = 0,
}) => {
  const value = ramp(f, [from, from + over], [0, to], E.outExpo);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      ₱{value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
};
