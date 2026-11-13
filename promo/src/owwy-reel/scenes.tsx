import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { OwwyMark, Phone } from "../components";
import { Split } from "../showreel/primitives";
import { useStage } from "../showreel/stage";
import { E, MONO, ramp, SANS, SERIF } from "../showreel/theme";
import { Glow, Label, push, type SceneProps, Stage } from "./chrome";
import { COPY, O } from "./theme";

/* ═════════════════════════════════════ 01 · SEED ═════════════════════════════
   A coin falls, lands, and the ground rings. Owwy's whole idea in one gesture:
   money put down somewhere it can grow. */

export const Seed: React.FC<SceneProps> = () => {
  const f = useCurrentFrame();
  const { CX, CY, u, v } = useStage();

  const drop = ramp(f, [4, 26], [0, 1], E.inQuart); // accelerating, like gravity
  const impact = f - 26;
  const shake = impact >= 0 && impact < 8 ? ramp(impact, [0, 8], [13, 0]) : 0;
  const squash = impact >= 0 && impact < 12 ? ramp(impact, [0, 12], [0.55, 0], E.outExpo) : 0;
  const size = 122 * u;

  return (
    <Stage bg={O.bgDeep} shake={shake}>
      <Glow color={O.brand} opacity={0.16} y={48} />

      {/* the fall, with a tail that stretches with speed */}
      <div
        style={{
          position: "absolute",
          left: CX - size / 2,
          top: CY - size / 2 - (1 - drop) * 760 * u,
          width: size,
          height: size,
          borderRadius: "50%",
          background: O.brand,
          transform: `scaleY(${1 + (1 - drop) * 0.35 * Math.min(1, f / 10) - squash}) scaleX(${1 + squash * 0.8})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: SANS,
          fontSize: size * 0.5,
          fontWeight: 800,
          color: O.brandDeep,
          opacity: ramp(f, [2, 8], [0, 1]),
        }}
      >
        ₱
      </div>

      {/* the ground ringing */}
      {[0, 6, 13].map((d, i) => {
        const t = ramp(f, [26 + d, 80 + d], [0, 1], E.outExpo);
        if (t <= 0) return null;
        return (
          <AbsoluteFill key={i}>
            <svg width="100%" height="100%" style={{ overflow: "visible" }}>
              <ellipse
                cx={CX}
                cy={CY}
                rx={t * (620 + i * 190) * u}
                ry={t * (620 + i * 190) * u * 0.34}
                fill="none"
                stroke={i === 1 ? O.accent : O.brand}
                strokeWidth={Math.max(0, (1 - t) * 8)}
                opacity={(1 - t) * 0.8}
              />
            </svg>
          </AbsoluteFill>
        );
      })}

      <div style={{ position: "absolute", left: 0, right: 0, top: CY + v(210, 240), display: "flex", justifyContent: "center" }}>
        <Split
          text="Know your money."
          frame={f}
          delay={34}
          stagger={1.8}
          from={90}
          style={{ fontFamily: SERIF, fontSize: v(66, 52), fontWeight: 600, color: O.ink, fontVariationSettings: `"opsz" 144, "SOFT" 30, "WONK" 1, "wght" 600` }}
        />
      </div>
    </Stage>
  );
};

/* ═══════════════════════════════════ 02 · THE GROVE ══════════════════════════
   The real home screen. Fireflies drift in front of it because the app draws
   today's transactions as fireflies — the motion is quoting the product. */

export const Grove: React.FC<SceneProps> = ({ len = 140 }) => {
  const f = useCurrentFrame();
  const { H, CY, v } = useStage();

  const rise = ramp(f, [0, 42], [0, 1], E.outExpo);
  const width = v(370, 548);
  // The screen really scrolls: each wipe reveals the next captured scroll
  // position. With a longer slot there is room for a second one.
  const scrub = ramp(f, [66, 104], [0, 100], E.inOutQuint);
  const scrub2 = len > 200 ? ramp(f, [len * 0.58, len * 0.8], [0, 100], E.inOutQuint) : 0;
  const move = `rotateX(${(1 - rise) * 13}deg) scale(${(0.94 + rise * 0.06) * push(f, len)})`;
  const y = (1 - rise) * H * 0.75;

  return (
    <Stage>
      <Glow color={O.brand} opacity={0.22} y={58} size={80} />

      <AbsoluteFill>
        <Phone src="home-grove.png" width={width} y={y} transform={move} />
      </AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(${100 - scrub}% 0 0 0)` }}>
        <Phone src="home-scroll-1.png" width={width} y={y} transform={move} />
      </AbsoluteFill>
      {scrub2 > 0 ? (
        <AbsoluteFill style={{ clipPath: `inset(${100 - scrub2}% 0 0 0)` }}>
          <Phone src="home-scroll-2.png" width={width} y={y} transform={move} />
        </AbsoluteFill>
      ) : null}

      {/* fireflies */}
      {Array.from({ length: 18 }, (_, k) => {
        const seed = random(`ff-${k}`);
        const x = 8 + random(`fx-${k}`) * 84;
        const y = 14 + random(`fy-${k}`) * 72;
        const drift = Math.sin(f * 0.028 + seed * 9) * 26;
        const lift = Math.cos(f * 0.021 + seed * 5) * 18;
        const twinkle = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(f * 0.11 + seed * 11));
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: O.accent,
              boxShadow: `0 0 16px 4px ${O.accent}55`,
              transform: `translate(${drift}px, ${lift}px)`,
              opacity: twinkle * ramp(f, [14 + k, 44 + k], [0, 0.85], E.outExpo),
            }}
          />
        );
      })}

      {/* Above the phone in 16:9, below it in 9:16 — either way, clear of it. */}
      <Label text="EVERY CATEGORY IS A TREE" f={f} at={46} top={v(CY - 430, CY + 640)} />
    </Stage>
  );
};

/* ═══════════════════════════════════ 03 · ASK OWWY ═══════════════════════════
   A real question, and the app's real answer — including the part most
   assistants hide, which is the query it ran. */

export const Ask: React.FC<SceneProps> = ({ len = 112 }) => {
  const f = useCurrentFrame();
  const { CX, CY, H, v, vertical } = useStage();
  const drift = push(f, len, 0.04);

  const question = "Where did my money go last month?";
  const cut = Math.floor(ramp(f, [6, 52], [0, question.length], E.inOutCubic));
  const caret = Math.floor(f / 8) % 2 === 0;
  const phone = ramp(f, [52, 86], [0, 1], E.outExpo);

  return (
    <Stage>
      <Glow color={O.brandDeep} opacity={0.5} x={vertical ? 50 : 30} y={vertical ? 30 : 50} size={90} />

      <div
        style={{
          position: "absolute",
          left: vertical ? 70 : 130,
          right: vertical ? 70 : undefined,
          width: vertical ? undefined : 760,
          top: vertical ? CY - 620 : CY - 150,
          fontFamily: SERIF,
          fontSize: v(62, 54),
          lineHeight: 1.18,
          color: O.ink,
          fontVariationSettings: `"opsz" 144, "SOFT" 20, "WONK" 1, "wght" 500`,
        }}
      >
        {question.slice(0, cut)}
        <span style={{ opacity: caret && cut < question.length ? 1 : 0, color: O.brand }}>|</span>
      </div>

      {/* the app's own receipt for its answer */}
      <div
        style={{
          position: "absolute",
          left: vertical ? 70 : 130,
          top: vertical ? CY - 400 : CY + 110,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 18px",
          borderRadius: 999,
          border: `1px solid ${O.brand}55`,
          background: O.brandSoft,
          opacity: ramp(f, [56, 78], [0, 1], E.outExpo),
          transform: `translateY(${ramp(f, [56, 80], [14, 0], E.outExpo)}px)`,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: O.brand }} />
        <span style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.1em", color: O.brand }}>Ran a query · 10 rows</span>
      </div>

      <AbsoluteFill>
        <Phone
          src="ask-answer.png"
          width={v(370, 440)}
          x={vertical ? 0 : CX - 330}
          y={vertical ? 240 + (1 - phone) * H * 0.4 : (1 - phone) * H * 0.5}
          transform={`rotate(${(1 - phone) * 5}deg) scale(${drift})`}
          style={{ opacity: phone }}
        />
      </AbsoluteFill>

      <Label text="ANSWERED ON THE DEVICE" f={f} at={86} top={v(CY - 430, CY + 760)} />
    </Stage>
  );
};

/* ═════════════════════════════════ 04 · SAFE TO SPEND ════════════════════════
   The number the app exists to produce, counting up while the ring that
   represents the month closes around it. */

export const SafeToSpend: React.FC<SceneProps> = ({ len = 112 }) => {
  const f = useCurrentFrame();
  const { CX, CY, H, u, v, vertical } = useStage();
  const drift = push(f, len, 0.05);

  const value = ramp(f, [8, 68], [0, 1052], E.outExpo); // the app's own figure
  const arc = ramp(f, [8, 74], [0, 1], E.inOutQuint);
  const r = 285 * u; // wide enough that the figure never touches its own ring
  const circumference = 2 * Math.PI * r;
  const phone = ramp(f, [74, 104], [0, 1], E.outExpo);

  return (
    <Stage>
      <Glow color={O.brand} opacity={0.18} size={65} />

      <AbsoluteFill style={{ opacity: 1 - phone * 0.75, transform: `scale(${1 - phone * 0.12})` }}>
        <svg width="100%" height="100%" style={{ overflow: "visible" }}>
          <g transform={`translate(${CX} ${CY}) rotate(-90)`}>
            <circle cx={0} cy={0} r={r} fill="none" stroke={O.surface2} strokeWidth={10} />
            <circle
              cx={0}
              cy={0}
              r={r}
              fill="none"
              stroke={O.brand}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - arc * 0.72)}
            />
          </g>
        </svg>

        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <span style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, letterSpacing: "0.4em", color: O.ink3 }}>SAFE TO SPEND</span>
          <span
            style={{
              fontFamily: SANS,
              fontSize: v(150, 122),
              fontWeight: 800,
              color: O.ink,
              letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
            }}
          >
            ₱{Math.round(value).toLocaleString("en-US")}
          </span>
          <span style={{ fontFamily: SANS, fontSize: 22, color: O.ink2, opacity: ramp(f, [44, 68], [0, 1], E.outExpo) }}>about ₱350 a day · until Sep 30</span>
        </AbsoluteFill>
      </AbsoluteFill>

      <AbsoluteFill style={{ opacity: phone }}>
        <Phone src="safe-to-spend.png" width={v(370, 540)} y={(1 - phone) * H * 0.55} transform={`scale(${(0.9 + phone * 0.1) * drift})`} />
      </AbsoluteFill>

      <Label text="EVERY LINE EXPLAINED" f={f} at={92} top={v(CY - 430, CY + 700)} />
    </Stage>
  );
};

/* ═══════════════════════════════════ 05 · SCAN ═══════════════════════════════
   A receipt, read on the phone. The scan line is the honest bit: this is OCR
   running locally, and the film shows the same total the app actually read. */

const RECEIPT_LINES = [
  ["JOLLIBEE", true],
  ["SM Megamall Branch", false],
  ["1 Chickenjoy Solo      99.00", false],
  ["1 Jolly Spaghetti      75.00", false],
  ["2 Peach Mango Pie      90.00", false],
  ["1 Iced Tea             55.00", false],
  ["SUBTOTAL              319.00", false],
  ["VAT 12%                38.28", false],
  ["TOTAL                 319.00", true],
  ["CASH                  500.00", false],
] as const;

export const Scan: React.FC<SceneProps> = ({ len = 112 }) => {
  const f = useCurrentFrame();
  const { CX, CY, H, u, v, vertical } = useStage();

  // With a longer slot the scan itself gets slower, which is the part worth
  // watching — rather than reading at the same speed and then holding.
  const long = len > 200;
  const sweepEnd = long ? len * 0.44 : 64;
  const phoneAt = long ? len * 0.54 : 68;

  const rise = ramp(f, [0, 26], [0, 1], E.outExpo);
  const sweep = ramp(f, [18, sweepEnd], [0, 1], E.inOutCubic);
  const phone = ramp(f, [phoneAt, phoneAt + 30], [0, 1], E.outExpo);
  const drift = push(f, len, 0.05);

  // The receipt holds the middle while it is being read, then steps aside to
  // let the result in — rather than sitting off to one side from the start.
  const rw = v(380, 440) * u;
  const rh = v(540, 620) * u;
  const rx = CX - rw / 2;
  const ry = CY - rh / 2;
  // It steps sideways in 16:9 and upwards in 9:16 — each format's spare axis.
  const slideX = phone * v(-360, 0);
  const slideY = phone * v(0, -430);

  return (
    <Stage>
      <Glow color={O.brand} opacity={0.14} size={70} />

      {/* the receipt */}
      <div
        style={{
          position: "absolute",
          left: rx,
          top: ry,
          width: rw,
          height: rh,
          background: "#f7f5f0",
          borderRadius: 8,
          padding: "26px 22px",
          boxSizing: "border-box",
          transform: `translate(${slideX}px, ${slideY + (1 - rise) * 120}px) rotate(${-3 + (1 - rise) * 6}deg) scale(${(0.92 + rise * 0.08) * (1 - phone * 0.12)})`,
          opacity: rise * (1 - phone * 0.45),
          boxShadow: "0 40px 70px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {RECEIPT_LINES.map(([text, bold], i) => {
          // Each line only appears once the scan line has passed over it.
          const at = (i + 1) / (RECEIPT_LINES.length + 1);
          const read = sweep > at ? 1 : 0;
          return (
            <div
              key={text}
              style={{
                fontFamily: MONO,
                fontSize: 15 * u,
                lineHeight: 2.35,
                color: "#16211c",
                fontWeight: bold ? 700 : 400,
                opacity: read ? 1 : 0.13,
                filter: read ? "none" : "blur(1.6px)",
              }}
            >
              {text}
            </div>
          );
        })}

        {/* the scan line itself */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${sweep * 100}%`,
            height: 3,
            background: O.brand,
            boxShadow: `0 0 26px 8px ${O.brand}, 0 -34px 40px -10px ${O.brand}66`,
            opacity: sweep > 0 && sweep < 1 ? 1 : 0,
          }}
        />
      </div>

      <AbsoluteFill style={{ opacity: phone }}>
        <Phone
          src="scan-review.png"
          width={v(370, 520)}
          x={vertical ? 0 : 330}
          y={vertical ? 300 + (1 - phone) * H * 0.4 : (1 - phone) * H * 0.5}
          transform={`scale(${drift})`}
        />
      </AbsoluteFill>

      <Label text="READ ON THE DEVICE · NEVER UPLOADED" f={f} at={phoneAt + 14} top={v(CY - 430, CY + 760)} />
    </Stage>
  );
};

/* ═══════════════════════════════════ 06 · EVERYTHING ═════════════════════════
   Six real screens in real perspective. No mockup frames, no invented UI —
   every pixel is a capture of the built app. */

const DECK = ["wallet.png", "log.png", "stats-trend.png", "budgets.png", "goals.png", "shopping.png"];

export const Everything: React.FC<SceneProps> = ({ len = 112 }) => {
  const f = useCurrentFrame();
  const { H, CX, CY, v } = useStage();
  const face = ramp(f, [46, 80], [0, 1], E.inOutQuint);
  // The fall is scheduled against the end of the slot, not a fixed frame.
  const drop = ramp(f, [len - 24, len], [0, 1], E.inQuart);
  // A slow lateral push while the deck is facing, so the hold isn't static.
  const glide = ramp(f, [80, len - 24], [0, 1], E.inOutCubic);
  // In 9:16 the cards grow and overlap into a fanned deck, rather than shrinking
  // to fit six of them across a frame that has no width to spare.
  const step = v(300, 152) * (0.7 + face * 0.3);
  const width = v(300, 296);

  return (
    <Stage bg={O.bgDeep}>
      <Glow color={O.brandDeep} opacity={0.45} size={95} />
      <AbsoluteFill style={{ perspective: 1700, perspectiveOrigin: "50% 45%" }}>
        <AbsoluteFill style={{ transformStyle: "preserve-3d" }}>
          {DECK.map((name, i) => {
            const enter = ramp(f, [i * 5, i * 5 + 36], [0, 1], E.outExpo);
            const z = (1 - enter) * -2400;
            const spread = (i - (DECK.length - 1) / 2) * step;
            return (
              <AbsoluteFill key={name} style={{ opacity: enter * (1 - drop * 0.5) }}>
                <Phone
                  src={name}
                  width={width}
                  x={spread}
                  y={drop * H * 1.2}
                  transform={`translateZ(${z + i * 50 + glide * 120}px) rotateY(${-42 + face * 42 - glide * 7}deg) rotateX(${7 - face * 7 + drop * 50}deg) rotate(${drop * (i - 2.5) * 8}deg)`}
                />
              </AbsoluteFill>
            );
          })}
        </AbsoluteFill>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: CY + v(330, 620), textAlign: "center" }}>
        <span style={{ fontFamily: SANS, fontSize: v(34, 28), fontWeight: 700, color: O.ink, opacity: ramp(f, [58, 84], [0, 1], E.outExpo), letterSpacing: "-0.01em" }}>
          Wallet · Log · Stats · Budgets · Goals · Trips
        </span>
      </div>
      <span style={{ position: "absolute", left: CX, top: 0, width: 0 }} />
    </Stage>
  );
};

/* ═══════════════════════════════════ 07 · PRIVATE ════════════════════════════
   Three lines, three beats, three impacts. The product's actual promise, and
   the reason it has no backend. */

const CLAIMS = ["NO ACCOUNT.", "NO SERVER.", "NO ADS."];

export const Private: React.FC<SceneProps> = ({ len = 84 }) => {
  const f = useCurrentFrame();
  const { v } = useStage();
  const grow = push(f, len, 0.06);
  const last = 8 + (CLAIMS.length - 1) * 20;
  const hit = f - last;
  const shake = hit >= 0 && hit < 7 ? ramp(hit, [0, 7], [10, 0]) : 0;

  return (
    <Stage bg={O.bgDeep} shake={shake}>
      <Glow color={O.brandDeep} opacity={0.5} size={85} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: v(4, 2), transform: `scale(${grow})` }}>
        {CLAIMS.map((line, i) => {
          const at = 8 + i * 20;
          const t = ramp(f, [at, at + 20], [0, 1], E.outExpo);
          return (
            <div
              key={line}
              style={{
                fontFamily: SANS,
                fontSize: v(112, 76),
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.06,
                color: i === CLAIMS.length - 1 ? O.brand : O.ink,
                // Slams in from oversize, so each line lands rather than fades.
                transform: `scale(${1 + (1 - t) * 0.45})`,
                opacity: t,
                filter: `blur(${(1 - t) * 14}px)`,
              }}
            >
              {line}
            </div>
          );
        })}
        <div
          style={{
            marginTop: 26,
            fontFamily: MONO,
            fontSize: v(19, 16),
            letterSpacing: "0.22em",
            color: O.ink3,
            opacity: ramp(f, [last + 8, last + 30], [0, 1], E.outExpo),
          }}
        >
          YOUR DATA NEVER LEAVES THE PHONE
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

/* ═══════════════════════════════════ 08 · OWWY ═══════════════════════════════
   The mark, the name, the tagline the product ships with. */

export const Lockup: React.FC<SceneProps> = ({ len = 144 }) => {
  const f = useCurrentFrame();
  const { u, v } = useStage();
  const settle = push(f, len, 0.04);

  const mark = ramp(f, [0, 34], [0, 1], E.outBack);
  const breathe = Math.sin(f * 0.042) * 3;
  const rule = ramp(f, [64, 96], [0, 1], E.outExpo) * v(620, 520);

  return (
    <Stage>
      <Glow color={O.brand} opacity={0.2} y={44} size={70} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", transform: `translateY(${breathe}px) scale(${settle})` }}>
        <OwwyMark size={182 * u * mark} style={{ transform: `rotate(${(1 - mark) * -14}deg)`, marginBottom: 14 }} />

        <div style={{ overflow: "hidden" }}>
          <Split
            text={COPY.name}
            frame={f}
            delay={26}
            stagger={5}
            from={120}
            style={{
              fontFamily: SERIF,
              fontSize: v(190, 150),
              fontWeight: 700,
              color: O.ink,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              fontVariationSettings: `"opsz" 144, "SOFT" 40, "WONK" 1, "wght" 700`,
            }}
          />
        </div>

        <div style={{ height: 1, width: rule, background: O.brand, opacity: 0.45, marginTop: 28 }} />

        <div
          style={{
            marginTop: 24,
            fontFamily: SANS,
            fontSize: v(31, 25),
            color: O.ink,
            opacity: ramp(f, [70, 98], [0, 0.95], E.outExpo),
            transform: `translateY(${ramp(f, [70, 98], [16, 0], E.outExpo)}px)`,
            textAlign: "center",
          }}
        >
          {COPY.tagline}
        </div>

        <div
          style={{
            marginTop: 18,
            fontFamily: MONO,
            fontSize: v(17, 15),
            letterSpacing: "0.24em",
            color: O.brand,
            opacity: ramp(f, [92, 120], [0, 0.85], E.outExpo),
          }}
        >
          {COPY.promise.toUpperCase()}
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
