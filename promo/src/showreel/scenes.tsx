import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { jitter, morphPath, pathFromRadii, radiiOf, Split } from "./primitives";
import { useStage } from "./stage";
import { C, E, MONO, ramp, SANS, SERIF } from "./theme";

const Stage: React.FC<{ bg: string; children: React.ReactNode; shake?: number }> = ({ bg, children, shake = 0 }) => {
  const f = useCurrentFrame();
  // The seed has to move with the frame, or "random" offset is the same offset.
  const t = shake ? `translate(${jitter(`sx${f}`, shake)}px, ${jitter(`sy${f}`, shake)}px)` : undefined;
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: t }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════ 01 · ANTICIPATION ═══════════════════════
   A dot arrives, gathers itself, and throws itself across the frame. Nothing
   moves fast until it has first moved backwards — the oldest trick there is,
   and still the one that sells weight. */

export const Ignition: React.FC = () => {
  const f = useCurrentFrame();
  const { W, CX, CY, u, v } = useStage();

  const pop = ramp(f, [0, 16], [0, 1], E.outBack);
  const wind = ramp(f, [16, 26], [0, 1], E.outQuart); // the pull back
  const fire = ramp(f, [26, 38], [0, 1], E.inOutQuint); // the throw
  const impact = f - 38;
  const shake = impact >= 0 && impact < 9 ? ramp(impact, [0, 9], [16, 0]) : 0;

  const LANDING = W * v(0.4, 0.31); // stays inside the frame, so the impact is something you see
  const dot = 34 * u;
  const xAt = (t: number) => -260 * u * ramp(t, [16, 26], [0, 1], E.outQuart) + LANDING * ramp(t, [26, 38], [0, 1], E.inOutQuint);
  const squash = 1 + wind * 0.5 - fire * 0.35;

  // The rule that survives the impact and carries into the next chapter.
  const rule = ramp(f, [42, 72], [0, 1], E.outExpo) * Math.min(1400, W * 0.85);

  return (
    <Stage bg={C.ink} shake={shake}>
      {/* Motion trail: the same dot sampled at 26 earlier moments, densely
          enough that the samples read as one streak rather than as beads. */}
      {Array.from({ length: 26 }, (_, k) => {
        const t = f - k * 0.42;
        if (t < 16) return null;
        const fade = (1 - k / 26) ** 2;
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: CX + xAt(t),
              top: CY,
              width: dot,
              height: dot,
              marginLeft: -dot / 2,
              marginTop: -dot / 2,
              borderRadius: "50%",
              background: C.clay,
              opacity: fade * 0.62 * Math.min(1, fire * 3),
              transform: `scaleX(${1 + k * 0.42}) scaleY(${1 - k * 0.025})`,
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: CX + xAt(f),
          top: CY,
          width: dot,
          height: dot,
          marginLeft: -dot / 2,
          marginTop: -dot / 2,
          borderRadius: "50%",
          background: C.clay,
          transform: `scale(${pop}) scaleX(${squash}) scaleY(${2 - squash})`,
          opacity: f > 40 ? ramp(f, [40, 46], [1, 0]) : 1,
        }}
      />

      {/* impact rings */}
      {[0, 5, 11].map((d, i) => {
        const t = ramp(f, [38 + d, 84 + d], [0, 1], E.outExpo);
        if (t <= 0) return null;
        return (
          <AbsoluteFill key={i}>
            <svg width="100%" height="100%" style={{ overflow: "visible" }}>
              <circle
                cx={CX + LANDING}
                cy={CY}
                r={t * (820 + i * 220) * u}
                fill="none"
                stroke={i === 0 ? C.paper : C.clay}
                strokeWidth={Math.max(0, (1 - t) * 11)}
                opacity={(1 - t) * 0.95}
              />
            </svg>
          </AbsoluteFill>
        );
      })}

      <div style={{ position: "absolute", top: CY - 1, left: CX - rule / 2, height: 2, width: rule, background: C.paper, opacity: 0.9 }} />
    </Stage>
  );
};

/* ═══════════════════════════════════ 02 · KINETIC TYPE ═══════════════════════
   Letters are masked, staggered and given a little rotation so they arrive as
   objects rather than as text appearing. A clay bar crosses the word and
   knocks the letters out inside it. */

export const KineticType: React.FC = () => {
  const f = useCurrentFrame();
  const { W, CY, u, v } = useStage();

  const barW = v(640, 430);
  const barX = ramp(f, [34, 78], [-barW - 60, W + 200], E.inOutQuint);
  const exit = ramp(f, [108, 134], [0, 1], E.inQuart);

  const word: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: v(290, 212),
    fontWeight: 800,
    letterSpacing: "-0.035em",
    lineHeight: 0.92,
    color: C.ink,
  };

  const weight = 300 + ramp(f, [40, 100], [0, 400], E.inOutCubic);

  // Both copies of the word sit in identical full-frame rows, so the knockout
  // lines up exactly and the clip can be measured in frame coordinates.
  const row: React.CSSProperties = { position: "absolute", left: 0, right: 0, top: CY - v(190, 160), display: "flex", justifyContent: "center" };

  return (
    <Stage bg={C.paper}>
      <AbsoluteFill style={{ transform: `translateY(${-exit * 130}%)` }}>
        <div style={row}>
          <Split text="MOTION" frame={f} delay={4} stagger={5} style={word} />
        </div>

        <div
          style={{
            position: "absolute",
            top: CY - v(270, 230),
            height: v(470, 400),
            left: barX,
            width: barW,
            background: C.clay,
            transform: "skewX(-9deg)",
          }}
        />

        <div style={{ ...row, clipPath: `inset(0 ${Math.max(0, W - (barX + barW))}px 0 ${Math.max(0, barX)}px)` }}>
          <Split text="MOTION" frame={f} delay={4} stagger={5} style={{ ...word, color: C.paper }} />
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: CY + v(150, 120),
            textAlign: "center",
            fontFamily: SERIF,
            fontSize: 46 * u,
            fontStyle: "italic",
            color: C.ink,
            opacity: ramp(f, [46, 72], [0, 0.8], E.outExpo),
            fontVariationSettings: `"opsz" 144, "SOFT" 40, "WONK" 1, "wght" ${weight.toFixed(0)}`,
            transform: `translateY(${ramp(f, [46, 76], [26, 0], E.outExpo)}px)`,
          }}
        >
          timing, weight, restraint
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

/* ═══════════════════════════════════ 03 · SHAPE MORPH ════════════════════════
   Twelve radii, interpolated. The rotation snaps ninety degrees a beat instead
   of spinning steadily, because a constant spin reads as a screensaver. */

const STEPS = [
  { from: "circle", to: "square", color: C.clay, name: "CIRCLE" },
  { from: "square", to: "triangle", color: C.amber, name: "SQUARE" },
  { from: "triangle", to: "star", color: C.paper, name: "TRIANGLE" },
  { from: "star", to: "blob", color: C.cyan, name: "STAR" },
] as const;

export const ShapeMorph: React.FC = () => {
  const f = useCurrentFrame();
  const { CX, CY, u, vertical } = useStage();
  const beat = 28;
  const i = Math.min(STEPS.length - 1, Math.floor(f / beat));
  const step = STEPS[i];
  const local = f - i * beat;
  const t = ramp(local, [2, 24], [0, 1], E.inOutQuint);

  const spin = i * 90 + ramp(local, [2, 24], [0, 90], E.outExpo);
  const enter = ramp(f, [0, 20], [0, 1], E.outBack);
  const size = 300 * u * enter;
  const ring = 440 * u;

  const d = morphPath(step.from, step.to, t, size, (spin * Math.PI) / 180);
  const ghost = morphPath(step.from, step.to, t, size * 1.14, ((spin + 12) * Math.PI) / 180);

  return (
    <Stage bg={C.ink}>
      <AbsoluteFill>
        <svg width="100%" height="100%" style={{ overflow: "visible" }}>
          {/* tick ring, counter-rotating */}
          <g transform={`translate(${CX} ${CY}) rotate(${-spin * 0.45})`} opacity={0.5}>
            {Array.from({ length: 48 }, (_, k) => {
              const a = (k / 48) * Math.PI * 2;
              const r2 = ring + (k % 4 === 0 ? 24 : 11) * u;
              return (
                <line
                  key={k}
                  x1={Math.cos(a) * ring}
                  y1={Math.sin(a) * ring}
                  x2={Math.cos(a) * r2}
                  y2={Math.sin(a) * r2}
                  stroke={C.paper}
                  strokeWidth={k % 4 === 0 ? 2 : 1}
                  opacity={ramp(f, [k * 0.4, k * 0.4 + 16], [0, 0.6], E.outExpo)}
                />
              );
            })}
          </g>

          <g transform={`translate(${CX} ${CY})`}>
            <path d={ghost} fill="none" stroke={step.color} strokeWidth={1.5} opacity={0.35} />
            <path d={d} fill={step.color} />
          </g>
        </svg>
      </AbsoluteFill>

      {/* Beside the shape in 16:9; beneath it in 9:16, where there is no room alongside. */}
      <div
        style={{
          position: "absolute",
          fontFamily: MONO,
          fontSize: 17,
          letterSpacing: "0.26em",
          color: C.paper,
          opacity: ramp(local, [0, 8], [0, 0.6], E.outExpo) * ramp(local, [18, 26], [1, 0]),
          ...(vertical ? { left: 0, right: 0, top: CY + ring + 80, textAlign: "center" as const } : { left: CX + ring - 90, top: CY - 14 }),
        }}
      >
        {step.name}
      </div>
    </Stage>
  );
};

/* ═══════════════════════════════════ 04 · SYSTEMS ════════════════════════════
   Many parts, one rule. A wave crosses a grid, the grid resolves into a solid
   form, then every dot leaves on its own vector. */

export const Systems: React.FC = () => {
  const f = useCurrentFrame();
  const { W, H, CX, CY, u, v } = useStage();

  // The grid turns with the frame so the dots stay square in both cuts.
  const COLS = v(30, 17);
  const ROWS = v(17, 30);
  const gapX = W / (COLS + 1);
  const gapY = H / (ROWS + 1);
  const disc = 320 * u;

  const gather = ramp(f, [42, 76], [0, 1], E.outExpo);
  const scatter = ramp(f, [80, 112], [0, 1], E.inQuart);

  return (
    <Stage bg={C.paper}>
      {Array.from({ length: COLS * ROWS }, (_, k) => {
        const x = gapX * ((k % COLS) + 1);
        const y = gapY * (Math.floor(k / COLS) + 1);
        const dx = x - CX;
        const dy = y - CY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const wave = 0.5 + 0.5 * Math.sin(dist * 0.028 - f * 0.22);
        const inDisc = dist < disc;
        const born = ramp(f, [k * 0.045, k * 0.045 + 14], [0, 1], E.outExpo);

        const scale = (0.3 + wave * 0.7) * (1 - gather) + (inDisc ? 1.45 : 0.16) * gather;
        const a = random(`dir-${k}`) * Math.PI * 2;
        const fly = scatter * (420 + random(`len-${k}`) * 700);

        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 12,
              height: 12,
              marginLeft: -6,
              marginTop: -6,
              borderRadius: "50%",
              background: inDisc && gather > 0.15 ? C.clay : C.ink,
              transform: `translate(${Math.cos(a) * fly}px, ${Math.sin(a) * fly}px) scale(${Math.max(0, scale * born)})`,
              opacity: (1 - scatter) * born,
            }}
          />
        );
      })}
    </Stage>
  );
};

/* ═══════════════════════════════════ 05 · LINE WORK ══════════════════════════
   Stroke-dashoffset, staggered. Every path is normalised to pathLength 1, so
   one number draws any of them regardless of their real length. */

const Draw: React.FC<{ d: string; at: number; color: string; width?: number; f: number }> = ({ d, at, color, width = 2, f }) => {
  const on = ramp(f, [at, at + 26], [1, 0], E.outExpo);
  const off = ramp(f, [86 + at * 0.15, 108 + at * 0.15], [0, 1], E.inQuart);
  return <path d={d} fill="none" stroke={color} strokeWidth={width} pathLength={1} strokeDasharray={1} strokeDashoffset={on + off} strokeLinecap="round" />;
};

export const LineWork: React.FC = () => {
  const f = useCurrentFrame();
  const { CX, CY, u, v } = useStage();
  const tilt = ramp(f, [56, 96], [0, 15], E.inOutCubic);
  const zoom = ramp(f, [0, 96], [0.86, 1.06], E.inOutCubic) * u;

  const arc = (r: number, a0: number, a1: number) =>
    `M ${Math.cos(a0) * r} ${Math.sin(a0) * r} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${Math.cos(a1) * r} ${Math.sin(a1) * r}`;

  return (
    <Stage bg={C.ink}>
      <AbsoluteFill>
        <svg width="100%" height="100%" style={{ overflow: "visible" }}>
          <g transform={`translate(${CX} ${CY}) scale(${zoom}) rotate(${tilt * 0.5})`}>
            {[180, 260, 340, 420].map((r, i) => (
              <Draw key={r} d={arc(r, -Math.PI * 0.85 + i * 0.22, Math.PI * 0.55 + i * 0.2)} at={i * 7} color={i === 1 ? C.clay : C.paper} width={i === 1 ? 3 : 1.4} f={f} />
            ))}

            {Array.from({ length: 24 }, (_, k) => {
              const a = (k / 24) * Math.PI * 2;
              const r1 = k % 3 === 0 ? 470 : 200;
              return <Draw key={`spoke-${k}`} d={`M ${Math.cos(a) * 120} ${Math.sin(a) * 120} L ${Math.cos(a) * r1} ${Math.sin(a) * r1}`} at={12 + k * 1.1} color={C.paper} width={1} f={f} />;
            })}

            <Draw d="M -300 -300 L 300 -300 L 300 300 L -300 300 Z" at={6} color={C.amber} width={1.6} f={f} />
            <Draw d="M -520 0 L 520 0" at={30} color={C.paper} width={1} f={f} />
            <Draw d="M 0 -470 L 0 470" at={34} color={C.paper} width={1} f={f} />

            {[-1, 1].map((s) =>
              [-1, 1].map((t) => (
                <Draw key={`c${s}${t}`} d={`M ${s * 300} ${t * 300} l ${s * 70} 0 m ${-s * 70} 0 l 0 ${t * 70}`} at={48} color={C.clay} width={2.4} f={f} />
              )),
            )}
          </g>
        </svg>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: v(130, 80),
          top: v(CY - 300, CY - 620),
          fontFamily: MONO,
          fontSize: 16,
          lineHeight: 2,
          color: C.paper,
          opacity: ramp(f, [24, 44], [0, 0.45], E.outExpo) * ramp(f, [92, 106], [1, 0]),
          letterSpacing: "0.14em",
        }}
      >
        R 180 · 260
        <br />
        R 340 · 420
        <br />
        SPOKES 24
        <br />
        TILT {tilt.toFixed(1)}°
      </div>
    </Stage>
  );
};

/* ═══════════════════════════════════ 06 · DEPTH ══════════════════════════════
   Real perspective, not a drop shadow. Cards arrive from far away, turn to
   face the camera together, then fall out of frame. */

const CARDS = [
  { fill: C.paper, tag: "01" },
  { fill: C.clay, tag: "02" },
  { fill: C.paper, tag: "03" },
  { fill: C.amber, tag: "04" },
  { fill: C.paper, tag: "05" },
  { fill: C.cyan, tag: "06" },
];

export const Depth: React.FC = () => {
  const f = useCurrentFrame();
  const { H, CX, CY, v } = useStage();
  const face = ramp(f, [50, 82], [0, 1], E.inOutQuint);
  const drop = ramp(f, [88, 112], [0, 1], E.inQuart);

  // In 9:16 the fan pulls in and the cards narrow, so six of them still fit
  // across the frame instead of sliding out of it.
  const cw = v(270, 210);
  const ch = v(380, 300);
  const step = v(170, 104) + face * v(110, 62);

  return (
    <Stage bg={C.plum}>
      <AbsoluteFill style={{ perspective: 1500, perspectiveOrigin: "50% 45%" }}>
        <AbsoluteFill style={{ transformStyle: "preserve-3d" }}>
          {CARDS.map((card, i) => {
            const enter = ramp(f, [i * 5, i * 5 + 34], [0, 1], E.outExpo);
            const z = (1 - enter) * -2200;
            const spread = (i - (CARDS.length - 1) / 2) * step;

            return (
              <div
                key={card.tag}
                style={{
                  position: "absolute",
                  left: CX - cw / 2,
                  top: CY - ch / 2 + drop * (H * 1.3),
                  width: cw,
                  height: ch,
                  background: card.fill,
                  borderRadius: 18,
                  transform: `translate3d(${spread}px, 0, ${z + i * 40}px) rotateY(${-46 + face * 46}deg) rotateX(${8 - face * 8 + drop * 55}deg) rotate(${drop * (i - 2.5) * 9}deg)`,
                  opacity: enter * (1 - drop * 0.6),
                  boxShadow: "0 50px 90px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: 22,
                  boxSizing: "border-box",
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.2em", color: C.ink, opacity: 0.55 }}>{card.tag}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[0.9, 0.55, 0.3].map((w, k) => (
                    <div key={k} style={{ height: 8, width: `${w * 100}%`, background: C.ink, opacity: 0.16, borderRadius: 4 }} />
                  ))}
                </div>
              </div>
            );
          })}
        </AbsoluteFill>
      </AbsoluteFill>
    </Stage>
  );
};

/* ═══════════════════════════════════ 07 · DISRUPTION ═════════════════════════
   The glitch only works because of the stillness around it: it fires in three
   short bursts and the frame is perfectly locked in between. */

export const Disruption: React.FC = () => {
  const f = useCurrentFrame();
  const { v } = useStage();
  const burst = (f > 14 && f < 24) || (f > 36 && f < 43) || (f > 56 && f < 68);
  const k = burst ? 1 : 0;
  const seed = Math.floor(f / 2);

  const type: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: v(320, 228),
    fontWeight: 800,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    whiteSpace: "nowrap",
  };

  const layer = (color: string, dx: number, blend: React.CSSProperties["mixBlendMode"]) => (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", mixBlendMode: blend }}>
      <div style={{ ...type, color, transform: `translateX(${dx}px)` }}>CRAFT</div>
    </AbsoluteFill>
  );

  return (
    <Stage bg={C.ink}>
      <AbsoluteFill style={{ opacity: ramp(f, [0, 12], [0, 1], E.outExpo) }}>
        {layer("#ff4438", k * jitter(`r${seed}`, 46) - k * 8, "screen")}
        {layer("#2ff3d6", k * jitter(`g${seed}`, 46) + k * 8, "screen")}
        {layer(C.paper, 0, "normal")}

        {/* sliced bands, offset independently */}
        {burst
          ? Array.from({ length: 9 }, (_, b) => (
              <AbsoluteFill
                key={b}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  clipPath: `inset(${40 + b * 2.4}% 0 ${100 - 40 - (b + 1) * 2.4}% 0)`,
                  transform: `translateX(${jitter(`band${seed}-${b}`, v(130, 95))}px)`,
                }}
              >
                <div style={{ ...type, color: b % 3 === 0 ? C.clay : C.paper }}>CRAFT</div>
              </AbsoluteFill>
            ))
          : null}

        {/* scan bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${ramp(f, [0, 84], [-10, 110], E.inOutCubic)}%`,
            height: 90,
            background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.09), transparent)",
          }}
        />
      </AbsoluteFill>
    </Stage>
  );
};

/* ═══════════════════════════════════ 08 · RESOLVE ════════════════════════════
   Everything the reel has been playing with lands in one still card — which
   still breathes, because a dead end frame wastes the last two seconds. */

export const Resolve: React.FC = () => {
  const f = useCurrentFrame();
  const { u, v } = useStage();

  const markIn = ramp(f, [0, 30], [0, 1], E.outBack);
  const settle = ramp(f, [10, 70], [0, 1], E.inOutQuint);
  const breathe = Math.sin(f * 0.045) * 4;
  const spin = ramp(f, [0, 90], [0, 180], E.outExpo);
  const d = morphPath("blob", "circle", settle, 92 * u * markIn, (spin * Math.PI) / 180);
  const tick = 132 * u;

  const rule = ramp(f, [54, 86], [0, 1], E.outExpo) * v(700, 560);

  return (
    <Stage bg={C.ink}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", transform: `translateY(${breathe}px)` }}>
        {/* Fixed box, 1:1 with its viewBox — the radii inside already carry `u`,
            and scaling the box too would shrink the mark twice over. */}
        <svg width={340} height={240} style={{ overflow: "visible", marginBottom: 4 }} viewBox="-170 -120 340 240">
          {/* the reel's own tick ring, quietly reprised */}
          <g transform={`rotate(${-spin * 0.4})`} opacity={0.55 * ramp(f, [22, 60], [0, 1], E.outExpo)}>
            {Array.from({ length: 36 }, (_, k) => {
              const a = (k / 36) * Math.PI * 2;
              const r2 = tick + (k % 3 === 0 ? 13 : 6) * u;
              return <line key={k} x1={Math.cos(a) * tick} y1={Math.sin(a) * tick} x2={Math.cos(a) * r2} y2={Math.sin(a) * r2} stroke={C.paper} strokeWidth={1} opacity={0.5} />;
            })}
          </g>
          <path d={pathFromRadii(radiiOf("circle"), 1, 118 * u * markIn)} fill="none" stroke={C.clay} strokeWidth={1.5} opacity={0.35 * ramp(f, [18, 50], [0, 1])} />
          <path d={d} fill={C.clay} />
        </svg>

        <div style={{ overflow: "hidden", marginTop: v(0, 40) }}>
          <Split
            text="CLAUDE"
            frame={f}
            delay={22}
            stagger={5}
            from={120}
            style={{ fontFamily: SANS, fontSize: v(210, 172), fontWeight: 800, letterSpacing: "0.02em", color: C.paper, lineHeight: 1 }}
          />
        </div>

        <div style={{ height: 1, width: rule, background: C.paper, opacity: 0.35, marginTop: 30 }} />

        <div
          style={{
            marginTop: 26,
            display: "flex",
            gap: v(28, 20),
            alignItems: "center",
            opacity: ramp(f, [62, 92], [0, 1], E.outExpo),
            transform: `translateY(${ramp(f, [62, 92], [18, 0], E.outExpo)}px)`,
          }}
        >
          <span style={{ fontFamily: SANS, fontSize: v(22, 19), fontWeight: 700, letterSpacing: "0.44em", color: C.paper, opacity: 0.9 }}>MOTION DESIGN</span>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.clay }} />
          <span style={{ fontFamily: SERIF, fontSize: v(26, 23), fontStyle: "italic", color: C.paper, opacity: 0.6, fontVariationSettings: `"opsz" 120, "SOFT" 60, "WONK" 1, "wght" 400` }}>
            reel 2026
          </span>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
