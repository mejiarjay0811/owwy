import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

/* ------------------------------------------------------------------ helpers */

export const ease = (t: number) => Easing.bezier(0.22, 1, 0.36, 1)(t);

/** 0 → 1 over [from, to] with a soft landing. */
export function ramp(frame: number, from: number, to: number, easing = ease): number {
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

/** Fades in, holds, fades out — the workhorse for captions. */
export function pulse(frame: number, from: number, hold: number, out = 12): number {
  return interpolate(frame, [from, from + 10, from + 10 + hold, from + 10 + hold + out], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
}

export function useSpring(delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200, stiffness: 90, mass: 0.9, ...config } });
}

/* -------------------------------------------------------------------- stage */

export interface Stage {
  landscape: boolean;
  width: number;
  height: number;
  /** Where a scene's words live: a right-hand column in 16:9, under the device in 9:16. */
  copy: React.CSSProperties;
  /** Device geometry for this format. */
  phone: (portrait: { width: number; x?: number; y?: number }) => { width: number; x: number; y: number };
}

/**
 * One composition, two real layouts. In portrait the device is centred with the
 * copy beneath it; in landscape it moves left and the copy takes a column on
 * the right, so the 16:9 cut is composed rather than letterboxed.
 */
export function useStage(): Stage {
  const { width, height } = useVideoConfig();
  const landscape = width > height;

  return {
    landscape,
    width,
    height,
    copy: landscape
      ? {
          position: "absolute",
          left: width * 0.5,
          top: 0,
          width: width * 0.38,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          textAlign: "left",
        }
      : {
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 170,
          textAlign: "center",
        },
    phone: (portrait) =>
      landscape
        ? // Leave headroom so a camera push-in never crops the device.
          { width: Math.round((height * 0.74 * SCREEN_W) / SCREEN_H), x: -width * 0.23, y: 0 }
        : { width: portrait.width, x: portrait.x ?? 0, y: portrait.y ?? 0 },
  };
}

/* --------------------------------------------------------------- background */

/** Deep evergreen room with a soft brand glow — the app's dark palette, lit. */
export const Background: React.FC<{ tint?: string; intensity?: number }> = ({ tint = theme.brand, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 18;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, #0d1815 0%, ${theme.bg} 45%, #08100d 100%)` }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 40% at 50% ${28 + drift * 0.2}%, ${tint}22 0%, transparent 70%)`,
          opacity: intensity,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(45% 30% at ${18 + drift * 0.1}% 82%, ${theme.accent}14 0%, transparent 72%)`,
          opacity: intensity,
        }}
      />
      {/* faint grid for depth, never louder than the product */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${theme.ink}06 1px, transparent 1px), linear-gradient(90deg, ${theme.ink}06 1px, transparent 1px)`,
          backgroundSize: "120px 120px",
          maskImage: "radial-gradient(70% 55% at 50% 45%, #000 0%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(70% 55% at 50% 45%, #000 0%, transparent 80%)",
        }}
      />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 420px 120px rgba(0,0,0,0.55)" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------- device */

export const SCREEN_W = 1170;
export const SCREEN_H = 2532;

interface PhoneProps {
  /** File in public/screens, e.g. "home-grove.png". */
  src: string;
  /** Vertical scroll inside the screen, in captured pixels. */
  offsetY?: number;
  /** Width of the device on the 1080-wide canvas. */
  width?: number;
  /** Offset from the centre of the frame, in canvas pixels. */
  y?: number;
  x?: number;
  /** Extra transform appended after centring (rotation, scale, …). */
  transform?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  /** A second screen fading in on top — how one state becomes the next. */
  overlay?: { src: string; offsetY?: number; opacity: number };
}

/**
 * A neutral device shell holding a real screenshot. The frame is generic on
 * purpose: no manufacturer's industrial design, no logos.
 */
export const Phone: React.FC<PhoneProps> = ({ src, offsetY = 0, width = 520, y = 0, x = 0, transform = "", style, children, overlay }) => {
  const scale = width / SCREEN_W;
  const height = SCREEN_H * scale;
  const radius = width * 0.115;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        // Centring lives in the transform so scenes can add motion without breaking it.
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) ${transform}`,
        borderRadius: radius,
        padding: width * 0.017,
        background: "linear-gradient(160deg, #38473f 0%, #16201c 35%, #0d1512 70%, #2c3a33 100%)",
        boxShadow: `0 ${width * 0.09}px ${width * 0.18}px -${width * 0.06}px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.05)`,
        ...style,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: radius * 0.93, overflow: "hidden", background: theme.bg }}>
        <Img src={staticFile(`screens/${src}`)} style={{ position: "absolute", top: -offsetY * scale, left: 0, width: "100%" }} />
        {overlay ? (
          <Img
            src={staticFile(`screens/${overlay.src}`)}
            style={{ position: "absolute", top: -(overlay.offsetY ?? 0) * scale, left: 0, width: "100%", opacity: overlay.opacity }}
          />
        ) : null}
        {/* glass sheen across the display */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 68%, rgba(255,255,255,0.05) 100%)",
            pointerEvents: "none",
          }}
        />
        {children}
      </div>
    </div>
  );
};

/** The ripple a finger leaves behind. Fires once, at `at`. */
export const Tap: React.FC<{ at: number; x: number; y: number; size?: number }> = ({ at, x, y, size = 92 }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 26) return null;
  const grow = interpolate(t, [0, 26], [0.35, 1.5], { easing: ease, extrapolateRight: "clamp" });
  const fade = interpolate(t, [0, 6, 26], [0.5, 0.42, 0], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        border: `3px solid ${theme.brand}`,
        background: `${theme.brand}33`,
        opacity: fade,
        transform: `scale(${grow})`,
      }}
    />
  );
};

/* --------------------------------------------------------------- typography */

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = theme.brand, style }) => (
  <div
    style={{
      fontFamily: theme.sans,
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: "0.32em",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Headline: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 72, style }) => (
  <div style={{ fontFamily: theme.display, fontSize: size, lineHeight: 1.08, color: theme.ink, letterSpacing: "-0.015em", ...style }}>{children}</div>
);

export const Sub: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 30, style }) => (
  <div style={{ fontFamily: theme.sans, fontSize: size, fontWeight: 500, color: theme.ink2, lineHeight: 1.4, ...style }}>{children}</div>
);

/* ------------------------------------------------------------------ mascots */

/** Owwy's compact mark, identical to components/owwy/owwy-mascot.tsx. */
export const OwwyMark: React.FC<{ size?: number; body?: string; eye?: string; pupil?: string; beak?: string; style?: React.CSSProperties }> = ({
  size = 120,
  body = theme.brand,
  eye = "#f6ecd9",
  pupil = "#0b1310",
  beak = theme.accent,
  style,
}) => (
  <svg viewBox="0 0 32 32" width={size} height={size} style={style}>
    <path d="M8.5 9 L6.5 2.5 L13 6.2 Z M23.5 9 L25.5 2.5 L19 6.2 Z" fill={body} stroke={body} strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M16 4.5 C23 4.5 27 9.5 27 16.5 C27 24 22.5 29 16 29 C9.5 29 5 24 5 16.5 C5 9.5 9 4.5 16 4.5 Z" fill={body} />
    <circle cx="11.7" cy="14.8" r="4.3" fill={eye} />
    <circle cx="20.3" cy="14.8" r="4.3" fill={eye} />
    <circle cx="11.7" cy="15" r="1.9" fill={pupil} />
    <circle cx="20.3" cy="15" r="1.9" fill={pupil} />
    <path d="M16 17.6 L14.5 19.9 L16 22.4 L17.5 19.9 Z" fill={beak} />
  </svg>
);

/* ------------------------------------------------------------- store badges */

/**
 * Placeholder store badges. They deliberately avoid Google's and Apple's
 * trademarked artwork — swap in the official badge assets (and real links)
 * once the listings exist.
 */
export const StoreBadge: React.FC<{ store: "play" | "app"; opacity?: number; delay?: number }> = ({ store, opacity = 1, delay = 0 }) => {
  const enter = useSpring(delay, { damping: 18, stiffness: 120 });
  const label = store === "play" ? "Google Play" : "App Store";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "22px 34px",
        borderRadius: 26,
        border: `1px solid ${theme.line}`,
        background: "rgba(238,242,239,0.05)",
        backdropFilter: "blur(12px)",
        opacity: opacity * enter,
        transform: `translateY(${(1 - enter) * 26}px)`,
      }}
    >
      {store === "play" ? (
        <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden>
          <path d="M4 3.5 L15.5 12 L4 20.5 Z" fill="none" stroke={theme.brand} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden>
          <rect x="4" y="3" width="16" height="18" rx="4" fill="none" stroke={theme.brand} strokeWidth="1.8" />
          <path d="M8.5 15 L12 8.5 L15.5 15 M10 13 h4" fill="none" stroke={theme.brand} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
      <div style={{ textAlign: "left" }}>
        <div style={{ fontFamily: theme.sans, fontSize: 18, fontWeight: 600, color: theme.ink3, letterSpacing: "0.12em", textTransform: "uppercase" }}>Coming soon to</div>
        <div style={{ fontFamily: theme.sans, fontSize: 32, fontWeight: 800, color: theme.ink, letterSpacing: "-0.01em" }}>{label}</div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------- layout */

export const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", ...style }}>{children}</AbsoluteFill>
);
