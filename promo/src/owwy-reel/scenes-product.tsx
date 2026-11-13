import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Phone } from "../components";
import { Split } from "../showreel/primitives";
import { useStage } from "../showreel/stage";
import { E, MONO, ramp, SANS, SERIF } from "../showreel/theme";
import { Counter, Glow, Label, Stage } from "./chrome";
import { O } from "./theme";

/* ═══════════════════════════════════ THE QUESTION ════════════════════════════
   Before any product, the problem. One word per beat, then the line leaves
   upward and takes you into the app. */

const WORDS = ["Where", "does", "it", "all", "go?"];

export const TheQuestion: React.FC = () => {
  const f = useCurrentFrame();
  const { CY, v } = useStage();
  const exit = ramp(f, [128, 164], [0, 1], E.inQuart);
  const rule = ramp(f, [104, 140], [0, 1], E.outExpo);

  return (
    <Stage bg={O.bgDeep}>
      <Glow color={O.brandDeep} opacity={0.42} size={85} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateY(${-exit * 60}%)`, opacity: 1 - exit }}>
        {/* A wider gap than the type would need upright: the italic overhang
            closes it, and "all go?" reads as one word otherwise. */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: v(38, 26), maxWidth: v(1500, 950) }}>
          {WORDS.map((word, i) => {
            const at = 6 + i * 18;
            const t = ramp(f, [at, at + 26], [0, 1], E.outExpo);
            return (
              <span key={word} style={{ overflow: "hidden", display: "inline-block", paddingBottom: "0.1em" }}>
                <span
                  style={{
                    display: "inline-block",
                    fontFamily: SERIF,
                    fontSize: v(128, 84),
                    fontStyle: "italic",
                    color: i === WORDS.length - 1 ? O.brand : O.ink,
                    lineHeight: 1.05,
                    fontVariationSettings: `"opsz" 144, "SOFT" 30, "WONK" 1, "wght" ${(400 + t * 200).toFixed(0)}`,
                    transform: `translateY(${(1 - t) * 110}%) rotate(${(1 - t) * -3}deg)`,
                  }}
                >
                  {word}
                </span>
              </span>
            );
          })}
        </div>
        <div style={{ position: "absolute", top: CY + v(150, 120), height: 2, width: rule * v(560, 420), background: O.brand, opacity: 0.6 }} />
      </AbsoluteFill>
    </Stage>
  );
};

/* ═══════════════════════════════════ TYPE IT, DONE ═══════════════════════════
   The app's fastest path: type one line and every field fills itself. The
   tokens fly from their place in the sentence to their place in the form —
   monospace, so the starting position of each word is exact rather than
   measured after the fact. */

const CH = 0.601; // advance width of the mono face, in ems
const SENTENCE = "coffee at a shop 180 gcash";
const TOKENS: { text: string; field: string; color: string }[] = [
  { text: "180", field: "Amount", color: O.brand },
  { text: "coffee", field: "Note", color: O.ink },
  { text: "gcash", field: "Account", color: O.accent },
];

export const TypeIt: React.FC = () => {
  const f = useCurrentFrame();
  const { CX, CY, v } = useStage();

  const size = v(46, 32);
  const typed = Math.floor(ramp(f, [4, 54], [0, SENTENCE.length], E.inOutCubic));
  const lineW = SENTENCE.length * size * CH;
  const x0 = CX - lineW / 2;
  const caret = Math.floor(f / 8) % 2 === 0;

  const rowH = v(104, 88);
  const slotX = CX - v(330, 230);
  const slotY = CY + v(-30, 40);

  return (
    <Stage>
      <Glow color={O.brand} opacity={0.15} size={75} />

      {/* the typed line */}
      <div
        style={{
          position: "absolute",
          left: x0,
          top: CY - v(230, 260),
          fontFamily: MONO,
          fontSize: size,
          color: O.ink2,
          whiteSpace: "pre",
          opacity: ramp(f, [96, 124], [1, 0.25], E.outExpo),
        }}
      >
        {SENTENCE.slice(0, typed)}
        <span style={{ opacity: caret && typed < SENTENCE.length ? 1 : 0, color: O.brand }}>|</span>
      </div>

      {/* the empty form waiting for it */}
      {TOKENS.map((token, i) => (
        <div
          key={token.field}
          style={{
            position: "absolute",
            left: slotX,
            top: slotY + i * rowH,
            width: v(660, 460),
            height: rowH - 18,
            borderRadius: 18,
            border: `1px solid ${O.ink3}44`,
            background: O.surface,
            opacity: ramp(f, [56 + i * 5, 80 + i * 5], [0, 1], E.outExpo),
            display: "flex",
            alignItems: "center",
            paddingLeft: 24,
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontFamily: SANS, fontSize: v(19, 16), fontWeight: 700, letterSpacing: "0.2em", color: O.ink3 }}>{token.field.toUpperCase()}</span>
        </div>
      ))}

      {/* each token flying from the sentence into its field */}
      {TOKENS.map((token, i) => {
        const from = SENTENCE.indexOf(token.text);
        const fromX = x0 + from * size * CH;
        const fromY = CY - v(230, 260);
        const toX = slotX + v(300, 210);
        const toY = slotY + i * rowH + (rowH - 18) / 2 - size * 0.7;
        const at = 66 + i * 14;
        const t = ramp(f, [at, at + 34], [0, 1], E.inOutQuint);
        // A slight arc, so three tokens don't travel on three parallel rails.
        const lift = Math.sin(t * Math.PI) * v(-90, -60) * (i === 1 ? 1.4 : 1);

        return (
          <div
            key={token.text}
            style={{
              position: "absolute",
              left: fromX + (toX - fromX) * t,
              top: fromY + (toY - fromY) * t + lift,
              fontFamily: MONO,
              fontSize: size * (1 + t * 0.12),
              fontWeight: t > 0.5 ? 700 : 400,
              color: t > 0.35 ? token.color : O.ink,
              opacity: ramp(f, [at - 22, at], [0, 1]),
              whiteSpace: "pre",
            }}
          >
            {token.text === "180" && t > 0.6 ? "₱180" : token.text}
          </div>
        );
      })}

      <AbsoluteFill style={{ opacity: ramp(f, [140, 172], [0, 1], E.outExpo) }}>
        <Phone
          src="add-calculator.png"
          width={v(340, 430)}
          x={v(560, 0)}
          y={v(0, 430) + (1 - ramp(f, [140, 176], [0, 1], E.outExpo)) * 420}
        />
      </AbsoluteFill>

      <Label text="TYPE IT, DONE" f={f} at={176} top={v(CY - 430, CY + 760)} />
    </Stage>
  );
};

/* ═══════════════════════════════════ SHOPPING ════════════════════════════════
   A budget set before you walk in, and a running total that warns you before
   the till does. */

const TROLLEY = [
  { name: "Rice 5kg", price: 289 },
  { name: "Eggs tray", price: 210.5 },
  { name: "Milk 1L", price: 98.75 },
  { name: "Chicken thigh", price: 245 },
  { name: "Detergent", price: 164 },
];
const BUDGET = 1200;

export const Shopping: React.FC = () => {
  const f = useCurrentFrame();
  const { CX, CY, v } = useStage();

  const shown = TROLLEY.filter((_, i) => f >= 14 + i * 22);
  const spent = shown.reduce((sum, item) => sum + item.price, 0);
  const smooth = ramp(f, [14, 130], [0, 1], E.outQuart);
  const fill = Math.min(1, (spent / BUDGET) * (0.35 + smooth * 0.65));
  const tight = spent / BUDGET > 0.8;

  return (
    <Stage>
      <Glow color={tight ? O.accent : O.brand} opacity={0.15} size={70} />

      <div style={{ position: "absolute", left: CX - v(420, 300), top: CY - v(260, 320), width: v(840, 600) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <span style={{ fontFamily: SANS, fontSize: v(20, 17), fontWeight: 700, letterSpacing: "0.26em", color: O.ink3 }}>TRIP BUDGET</span>
          <span style={{ fontFamily: SANS, fontSize: v(34, 26), fontWeight: 800, color: tight ? O.accent : O.brand, fontVariantNumeric: "tabular-nums" }}>
            ₱{spent.toLocaleString("en-US", { minimumFractionDigits: 2 })} / ₱{BUDGET.toLocaleString("en-US")}
          </span>
        </div>
        <div style={{ height: 14, borderRadius: 999, background: O.surface2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${fill * 100}%`, background: tight ? O.accent : O.brand, borderRadius: 999 }} />
        </div>

        {/* items dropping into the trolley, one per beat */}
        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 10 }}>
          {TROLLEY.map((item, i) => {
            const at = 14 + i * 22;
            const t = ramp(f, [at, at + 20], [0, 1], E.outBack);
            if (t <= 0) return null;
            return (
              <div
                key={item.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: v("14px 22px", "11px 16px"),
                  borderRadius: 14,
                  background: O.surface,
                  border: "1px solid #ffffff14",
                  transform: `translateY(${(1 - t) * -34}px) scale(${0.94 + t * 0.06})`,
                  opacity: t,
                }}
              >
                <span style={{ fontFamily: SANS, fontSize: v(25, 20), color: O.ink }}>{item.name}</span>
                <span style={{ fontFamily: SANS, fontSize: v(25, 20), fontWeight: 700, color: O.ink2, fontVariantNumeric: "tabular-nums" }}>
                  ₱{item.price.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <AbsoluteFill style={{ opacity: ramp(f, [130, 160], [0, 1], E.outExpo) }}>
        <Phone src="shopping.png" width={v(330, 420)} x={v(600, 0)} y={v(0, 420) + (1 - ramp(f, [130, 164], [0, 1], E.outExpo)) * 380} />
      </AbsoluteFill>

      <Label text="KNOW BEFORE THE TILL DOES" f={f} at={150} top={v(CY - 430, CY + 780)} />
    </Stage>
  );
};

/* ═══════════════════════════════════ WALLET ══════════════════════════════════
   Net worth, built out of the accounts that make it up — the figures are the
   app's own sample data, counted up rather than cut to. */

const ACCOUNTS = [
  { name: "Main Wallet", note: "Bank account", value: 933.83 },
  { name: "Savings", note: "4% yearly", value: 25000 },
  { name: "E-wallet", note: "•••• 0917", value: 2315 },
  { name: "Emergency Fund", note: "For the unexpected", value: 12500 },
];

export const Wallet: React.FC = () => {
  const f = useCurrentFrame();
  const { CX, CY, v } = useStage();

  return (
    <Stage>
      <Glow color={O.brand} opacity={0.16} size={70} y={40} />

      <div style={{ position: "absolute", left: 0, right: 0, top: CY - v(280, 360), textAlign: "center" }}>
        <div style={{ fontFamily: SANS, fontSize: v(20, 17), fontWeight: 700, letterSpacing: "0.34em", color: O.ink3 }}>YOUR MONEY</div>
        <Counter
          to={65678.83}
          f={f}
          from={6}
          over={64}
          decimals={2}
          style={{ fontFamily: SANS, fontSize: v(112, 74), fontWeight: 800, color: O.ink, letterSpacing: "-0.03em", lineHeight: 1.2 }}
        />
      </div>

      <div style={{ position: "absolute", left: CX - v(400, 290), top: CY - v(50, 60), width: v(800, 580), display: "flex", flexDirection: "column", gap: 12 }}>
        {ACCOUNTS.map((a, i) => {
          const at = 34 + i * 12;
          const t = ramp(f, [at, at + 26], [0, 1], E.outExpo);
          return (
            <div
              key={a.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: v("18px 26px", "14px 18px"),
                borderRadius: 18,
                background: i === 1 ? O.brandSoft : O.surface,
                border: `1px solid ${i === 1 ? O.brand + "44" : "#ffffff12"}`,
                transform: `translateX(${(1 - t) * -70}px)`,
                opacity: t,
              }}
            >
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: SANS, fontSize: v(26, 21), fontWeight: 700, color: O.ink }}>{a.name}</span>
                <span style={{ fontFamily: SANS, fontSize: v(18, 15), color: O.ink3 }}>{a.note}</span>
              </span>
              <span style={{ fontFamily: SANS, fontSize: v(28, 22), fontWeight: 800, color: i === 1 ? O.brand : O.ink, fontVariantNumeric: "tabular-nums" }}>
                ₱{a.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          );
        })}
      </div>

      <AbsoluteFill style={{ opacity: ramp(f, [128, 158], [0, 1], E.outExpo) }}>
        <Phone src="wallet.png" width={v(330, 420)} x={v(610, 0)} y={v(0, 430) + (1 - ramp(f, [128, 162], [0, 1], E.outExpo)) * 380} />
      </AbsoluteFill>

      <Label text="BALANCES ARE DERIVED, NEVER STORED" f={f} at={150} top={v(CY - 430, CY + 790)} />
    </Stage>
  );
};

/* ═══════════════════════════════════ STATS ═══════════════════════════════════
   A donut that draws, and six months of logging filling in as a wave — the
   heatmap the app actually ships. */

const SLICES = [
  { label: "Food", pct: 0.38, color: O.brand },
  { label: "Transport", pct: 0.22, color: O.accent },
  { label: "Groceries", pct: 0.18, color: O.positive },
  { label: "Bills", pct: 0.14, color: "#8a7fd4" },
  { label: "Other", pct: 0.08, color: O.ink3 },
];

export const Stats: React.FC = () => {
  const f = useCurrentFrame();
  const { CX, CY, u, v } = useStage();

  const r = 150 * u;
  const c = 2 * Math.PI * r;
  const draw = ramp(f, [6, 74], [0, 1], E.inOutQuint);
  const donutX = CX - v(430, 0);
  const donutY = CY - v(0, 300);

  const cols = 26;
  const rows = 7;
  const cell = 17 * u;
  const gap = 5;
  const gridW = cols * cell + (cols - 1) * gap;
  // Centred under the donut, not floated off to one side where it would run
  // into the phone.
  const gridX = donutX - gridW / 2;
  const gridY = CY + v(170, 150);

  return (
    <Stage>
      <Glow color={O.brand} opacity={0.14} size={72} />

      <AbsoluteFill>
        <svg width="100%" height="100%" style={{ overflow: "visible" }}>
          <g transform={`translate(${donutX} ${donutY}) rotate(-90)`}>
            {SLICES.reduce<{ nodes: React.ReactNode[]; offset: number }>(
              (acc, s, i) => {
                const len = s.pct * c;
                acc.nodes.push(
                  <circle
                    key={s.label}
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={42 * u}
                    strokeDasharray={`${len * draw} ${c}`}
                    strokeDashoffset={-acc.offset * draw}
                    opacity={ramp(f, [i * 8, i * 8 + 20], [0, 1], E.outExpo)}
                  />,
                );
                return { nodes: acc.nodes, offset: acc.offset + len };
              },
              { nodes: [], offset: 0 },
            ).nodes}
          </g>
        </svg>
      </AbsoluteFill>

      <div style={{ position: "absolute", left: donutX - 120, top: donutY - 34, width: 240, textAlign: "center" }}>
        <Counter to={64375} f={f} from={10} over={62} style={{ fontFamily: SANS, fontSize: v(44, 36), fontWeight: 800, color: O.ink }} />
        <div style={{ fontFamily: SANS, fontSize: v(17, 15), letterSpacing: "0.2em", color: O.ink3, marginTop: 4 }}>THIS MONTH</div>
      </div>

      {/* the logging heatmap, filling on a diagonal wave */}
      <div style={{ position: "absolute", left: gridX, top: gridY, display: "flex", gap }}>
        {Array.from({ length: cols }, (_, x) => (
          <div key={x} style={{ display: "flex", flexDirection: "column", gap }}>
            {Array.from({ length: rows }, (_, y) => {
              const at = 40 + (x + y) * 2.1;
              const t = ramp(f, [at, at + 16], [0, 1], E.outBack);
              const level = (x * 7 + y * 3) % 5;
              return (
                <div
                  key={y}
                  style={{
                    width: cell,
                    height: cell,
                    borderRadius: 4,
                    background: level === 0 ? O.surface2 : O.brand,
                    opacity: (level === 0 ? 1 : 0.22 + level * 0.19) * t,
                    transform: `scale(${t})`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: gridX,
          width: gridW,
          top: gridY + rows * (cell + gap) + 22,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: v(24, 20),
          color: O.ink2,
          opacity: ramp(f, [96, 124], [0, 1], E.outExpo),
        }}
      >
        27 days in a row · best 27
      </div>

      <AbsoluteFill style={{ opacity: ramp(f, [150, 184], [0, 1], E.outExpo) }}>
        <Phone src="stats-trend.png" width={v(320, 400)} x={v(640, 0)} y={v(0, 480) + (1 - ramp(f, [150, 188], [0, 1], E.outExpo)) * 380} />
      </AbsoluteFill>

      <Label text="SIX MONTHS AT A GLANCE" f={f} at={176} top={v(CY - 430, CY + 810)} />
    </Stage>
  );
};

/* ═══════════════════════════════════ BUDGETS & GOALS ═════════════════════════
   Bars that fill past their mark and settle back, and a ring that completes. */

const BARS = [
  { label: "Food", spent: 0.92, color: O.accent },
  { label: "Transport", spent: 0.64, color: O.brand },
  { label: "Groceries", spent: 0.41, color: O.positive },
];

export const BudgetsGoals: React.FC = () => {
  const f = useCurrentFrame();
  const { CX, CY, u, v } = useStage();

  const r = 118 * u;
  const c = 2 * Math.PI * r;
  const goal = ramp(f, [44, 122], [0, 0.79], E.outBack);

  return (
    <Stage>
      <Glow color={O.brand} opacity={0.14} size={70} />

      <div style={{ position: "absolute", left: CX - v(720, 300), top: CY - v(150, 330), width: v(620, 600) }}>
        {BARS.map((bar, i) => {
          const at = 8 + i * 16;
          const t = ramp(f, [at, at + 38], [0, 1], E.outBack); // overshoots, then settles
          return (
            <div key={bar.label} style={{ marginBottom: 30, opacity: ramp(f, [at, at + 14], [0, 1], E.outExpo) }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                <span style={{ fontFamily: SANS, fontSize: v(25, 20), fontWeight: 700, color: O.ink }}>{bar.label}</span>
                <span style={{ fontFamily: SANS, fontSize: v(22, 18), color: O.ink3, fontVariantNumeric: "tabular-nums" }}>{Math.round(bar.spent * t * 100)}%</span>
              </div>
              <div style={{ height: 13, borderRadius: 999, background: O.surface2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, bar.spent * t * 100)}%`, background: bar.color, borderRadius: 999 }} />
              </div>
            </div>
          );
        })}
      </div>

      <AbsoluteFill>
        <svg width="100%" height="100%" style={{ overflow: "visible" }}>
          <g transform={`translate(${CX + v(330, 0)} ${CY + v(0, 330)}) rotate(-90)`}>
            <circle r={r} fill="none" stroke={O.surface2} strokeWidth={22 * u} />
            <circle r={r} fill="none" stroke={O.brand} strokeWidth={22 * u} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - goal)} />
          </g>
        </svg>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: CX + v(330, 0) - 140, top: CY + v(0, 330) - 40, width: 280, textAlign: "center" }}>
        <div style={{ fontFamily: SANS, fontSize: v(46, 38), fontWeight: 800, color: O.ink }}>{Math.round(goal * 100)}%</div>
        <div style={{ fontFamily: SANS, fontSize: v(18, 16), letterSpacing: "0.2em", color: O.ink3 }}>NEW PHONE</div>
      </div>

      <Label text="BUDGETS · GOALS" f={f} at={132} top={v(CY - 430, CY + 640)} />
    </Stage>
  );
};

/* ═══════════════════════════════════ OWED & DEBTS ════════════════════════════
   One bill dividing into three shares — the split the app performs in a single
   transaction. */

export const OwedDebts: React.FC = () => {
  const f = useCurrentFrame();
  const { CX, CY, v } = useStage();

  const split = ramp(f, [26, 70], [0, 1], E.inOutQuint);
  const spread = v(320, 210) * split;
  const shares = [
    { who: "You", tint: O.brand },
    { who: "Ana", tint: O.ink },
    { who: "Miko", tint: O.ink },
  ];

  return (
    <Stage bg={O.bgDeep}>
      <Glow color={O.brandDeep} opacity={0.45} size={85} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: CY - v(220, 300),
          textAlign: "center",
          fontFamily: SANS,
          fontSize: v(96, 66),
          fontWeight: 800,
          color: O.ink,
          opacity: (1 - split) * ramp(f, [0, 18], [0, 1], E.outExpo),
          transform: `scale(${1 - split * 0.25})`,
        }}
      >
        ₱2,400.00
      </div>

      {shares.map((s, i) => {
        const x = (i - 1) * spread;
        return (
          <div
            key={s.who}
            style={{
              position: "absolute",
              left: CX - v(120, 90) + x,
              top: CY - v(40, 90),
              width: v(240, 180),
              padding: v("26px 0", "18px 0"),
              borderRadius: 22,
              textAlign: "center",
              background: i === 0 ? O.brandSoft : O.surface,
              border: `1px solid ${i === 0 ? O.brand + "55" : "#ffffff14"}`,
              opacity: split,
              transform: `translateY(${(1 - split) * -40}px)`,
            }}
          >
            <div style={{ fontFamily: SANS, fontSize: v(20, 17), letterSpacing: "0.2em", color: O.ink3 }}>{s.who.toUpperCase()}</div>
            <div style={{ fontFamily: SANS, fontSize: v(40, 30), fontWeight: 800, color: s.tint, marginTop: 6 }}>₱800</div>
          </div>
        );
      })}

      {/* an installment plan, one pip a payment */}
      <div style={{ position: "absolute", left: 0, right: 0, top: CY + v(150, 190), display: "flex", justifyContent: "center", gap: 9 }}>
        {Array.from({ length: 12 }, (_, i) => {
          const at = 78 + i * 4;
          const t = ramp(f, [at, at + 14], [0, 1], E.outBack);
          const paid = i < 4;
          return (
            <div
              key={i}
              style={{
                width: v(30, 22),
                height: v(10, 8),
                borderRadius: 999,
                background: paid ? O.brand : O.surface2,
                transform: `scaleX(${t})`,
                opacity: t,
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: CY + v(190, 230),
          textAlign: "center",
          fontFamily: SANS,
          fontSize: v(22, 18),
          color: O.ink2,
          opacity: ramp(f, [118, 146], [0, 1], E.outExpo),
        }}
      >
        4 of 12 paid · ₱4,166.67 a month
      </div>

      <Label text="SPLIT A BILL · TRACK A PLAN" f={f} at={130} top={v(CY - 430, CY + 640)} />
    </Stage>
  );
};

/* ═══════════════════════════════════ OFFLINE ═════════════════════════════════
   The claim that the architecture earns: there is no server to lose. */

export const Offline: React.FC = () => {
  const f = useCurrentFrame();
  const { CX, CY, u, v } = useStage();

  const strike = ramp(f, [30, 58], [0, 1], E.outExpo);
  const bars = [0.35, 0.6, 0.85, 1];

  return (
    <Stage bg={O.bgDeep}>
      <Glow color={O.brandDeep} opacity={0.35} size={80} />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 9 * u, height: 96 * u, marginBottom: 40 }}>
          {bars.map((h, i) => {
            const t = ramp(f, [4 + i * 6, 24 + i * 6], [0, 1], E.outBack);
            return <div key={i} style={{ width: 22 * u, height: 96 * u * h * t, borderRadius: 5, background: O.ink3, opacity: 0.5 }} />;
          })}
          {/* the strike, drawn rather than faded in */}
          <svg style={{ position: "absolute", left: -18, top: -18, overflow: "visible" }} width={160 * u} height={140 * u}>
            <line
              x1={0}
              y1={140 * u}
              x2={160 * u * strike}
              y2={140 * u - 140 * u * strike}
              stroke={O.accent}
              strokeWidth={7}
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div style={{ overflow: "hidden" }}>
          <Split
            text="NO SIGNAL."
            frame={f}
            delay={44}
            stagger={3}
            from={110}
            style={{ fontFamily: SANS, fontSize: v(96, 64), fontWeight: 800, color: O.ink, letterSpacing: "-0.03em", lineHeight: 1.05 }}
          />
        </div>
        <div style={{ overflow: "hidden", marginTop: 6 }}>
          <Split
            text="NO PROBLEM."
            frame={f}
            delay={74}
            stagger={3}
            from={110}
            style={{ fontFamily: SANS, fontSize: v(96, 64), fontWeight: 800, color: O.brand, letterSpacing: "-0.03em", lineHeight: 1.05 }}
          />
        </div>

        <div
          style={{
            marginTop: 30,
            fontFamily: MONO,
            fontSize: v(19, 16),
            letterSpacing: "0.22em",
            color: O.ink3,
            opacity: ramp(f, [112, 140], [0, 1], E.outExpo),
          }}
        >
          THE WHOLE APP SHIPS TO THE DEVICE
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
