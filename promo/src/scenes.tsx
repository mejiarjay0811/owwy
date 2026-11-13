import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Center, Eyebrow, Headline, OwwyMark, Phone, StoreBadge, Sub, Tap, ease, pulse, ramp, useSpring, useStage } from "./components";
import { copy, CROSSFADE, theme } from "./theme";

/* ============================================================ 1 · the hook */

export const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const mark = useSpring(4, { damping: 14, stiffness: 90 });
  const glow = interpolate(frame, [0, 26, 60, 110], [0, 0.85, 0.35, 0], { extrapolateRight: "clamp", easing: ease });
  const word = ramp(frame, 18, 46);
  const tagline = ramp(frame, 34, 62);
  const exit = ramp(frame, 96, 118);

  return (
    <AbsoluteFill>
      <Center style={{ opacity: 1 - exit, transform: `scale(${1 + exit * 0.5})` }}>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", marginTop: -60 }}>
          <div
            style={{
              position: "absolute",
              width: 560,
              height: 560,
              top: -170,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${theme.brand}55 0%, transparent 62%)`,
              opacity: glow,
              filter: "blur(18px)",
            }}
          />
          <OwwyMark size={230} style={{ transform: `scale(${mark}) translateY(${(1 - mark) * 40}px)`, filter: `drop-shadow(0 26px 60px ${theme.brand}44)` }} />
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 116,
              fontWeight: 800,
              letterSpacing: `${interpolate(word, [0, 1], [0.5, 0.16], { easing: ease })}em`,
              color: theme.ink,
              marginTop: 34,
              marginRight: "-0.16em",
              opacity: word,
            }}
          >
            {copy.name}
          </div>
          <Sub size={34} style={{ marginTop: 26, opacity: tagline, transform: `translateY(${(1 - tagline) * 18}px)`, textAlign: "center" }}>
            {copy.tagline}
          </Sub>
        </div>
      </Center>
    </AbsoluteFill>
  );
};

/* ================================================== 2 · the app comes alive */

export const SceneAlive: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const stage = useStage();
  const device = stage.phone({ width: 640, y: -70 });
  const rise = useSpring(0, { damping: 26, stiffness: 62, mass: 1.1 });
  const drift = Math.sin(frame / 70) * 8;
  const leave = ramp(frame, duration, duration + CROSSFADE);

  // The bell opens the reminders sheet; then the home screen scrolls.
  const sheet = interpolate(frame, [58, 76], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const sheetOut = interpolate(frame, [104, 118], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  // Two real scroll positions of the home screen, dissolved in turn.
  const scrollA = ramp(frame, 126, 150);
  const scrollB = ramp(frame, 164, 188);
  const zoom = interpolate(frame, [0, 90, 195], [1.02, 1.06, 1.12], { easing: ease });
  const overlay =
    scrollB > 0
      ? { src: "home-scroll-2.png", opacity: scrollB }
      : scrollA > 0
        ? { src: "home-scroll-1.png", opacity: scrollA }
        : { src: "home-reminders.png", opacity: sheet * sheetOut };

  return (
    <AbsoluteFill style={{ opacity: 1 - leave }}>
      <AbsoluteFill style={{ transform: `scale(${zoom}) translateY(${drift}px)`, transformOrigin: "50% 45%" }}>
        <Phone
          src={scrollA > 0.99 ? "home-scroll-1.png" : "home-grove.png"}
          width={device.width}
          x={device.x}
          y={device.y + (1 - rise) * 1000}
          overlay={overlay}
        >
          <Tap at={52} x={79} y={3.8} />
        </Phone>
      </AbsoluteFill>
      <div style={{ ...stage.copy, opacity: stage.landscape ? ramp(frame, 24, 44) : pulse(frame, 128, 46) }}>
        <Sub size={stage.landscape ? 44 : 34} style={{ color: theme.ink }}>
          Everything about your money, in one calm place.
        </Sub>
      </div>
    </AbsoluteFill>
  );
};

/* ====================================================== 3 · the key features */

interface FeatureProps {
  eyebrow: string;
  line: string;
  /** Up to three real states of the same screen, crossfaded in order. */
  states: string[];
  taps?: { at: number; x: number; y: number }[];
  /** Camera push: [startScale, endScale] and the point it moves toward. */
  focus?: { from: number; to: number; x: number; y: number };
  duration: number;
}

const Feature: React.FC<FeatureProps> = ({ eyebrow, line, states, taps = [], focus = { from: 1, to: 1.16, x: 0, y: 0 }, duration }) => {
  const frame = useCurrentFrame();
  const stage = useStage();
  const device = stage.phone({ width: 560, y: -150 });
  const enter = useSpring(0, { damping: 24, stiffness: 78 });
  // Fades out *after* its slot, over the scene that has already begun.
  const leave = ramp(frame, duration, duration + CROSSFADE);

  // One state becomes the next: a crossfade at a third and two thirds through.
  const second = states[1] ? ramp(frame, duration * 0.33, duration * 0.33 + 16) : 0;
  const third = states[2] ? ramp(frame, duration * 0.64, duration * 0.64 + 16) : 0;
  const top = third > 0 ? states[2] : states[1] ?? states[0];
  const topOpacity = third > 0 ? third : second;

  // The push-in is gentler in 16:9, where the device already fills the height.
  const to = stage.landscape ? 1 + (focus.to - focus.from) * 0.4 : focus.to;
  const scale = interpolate(frame, [0, duration], [focus.from, to], { easing: ease, extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: 1 - leave }}>
      <AbsoluteFill
        style={{
          transform: `translate(${focus.x * (scale - 1) * -100}px, ${(stage.landscape ? 0 : focus.y) * (scale - 1) * -100}px) scale(${scale})`,
          transformOrigin: stage.landscape ? "27% 50%" : "50% 50%",
        }}
      >
        <Phone
          src={states[0]}
          width={device.width}
          y={device.y}
          x={device.x + (1 - enter) * 420}
          transform={`rotate(${(1 - enter) * 4}deg)`}
          overlay={topOpacity > 0 ? { src: top, opacity: topOpacity } : undefined}
        >
          {taps.map((t) => (
            <Tap key={`${t.at}-${t.x}`} at={t.at} x={t.x} y={t.y} />
          ))}
        </Phone>
      </AbsoluteFill>

      <div style={stage.copy}>
        <div style={{ opacity: ramp(frame, 12, 30), transform: `translateY(${(1 - ramp(frame, 12, 30)) * 26}px)` }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <Headline size={stage.landscape ? 64 : 62} style={{ marginTop: 18, maxWidth: 900 }}>
            {line}
          </Headline>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const SceneFeatures: React.FC<{ index: number; duration: number }> = ({ index, duration }) => {
  const features: Omit<FeatureProps, "duration">[] = [
    {
      eyebrow: "Ask",
      line: "Answers, without sending your money anywhere.",
      states: ["ask-empty.png", "ask-typed.png", "ask-answer.png"],
      taps: [{ at: 52, x: 88, y: 88 }],
      focus: { from: 1.02, to: 1.2, x: 0, y: 0.12 },
    },
    {
      eyebrow: "Scan",
      line: "Photograph a receipt. Owwy files it.",
      states: ["scan-intro.png", "scan-reading.png", "scan-review.png"],
      taps: [{ at: 30, x: 50, y: 62 }],
      focus: { from: 1.02, to: 1.22, x: 0, y: 0.1 },
    },
    {
      eyebrow: "Wallet",
      line: "Every account, one clear picture.",
      states: ["wallet.png", "wallet-menu.png", "wallet-detail.png"],
      taps: [
        { at: 44, x: 86, y: 52 },
        { at: 92, x: 50, y: 55 },
      ],
      focus: { from: 1.04, to: 1.18, x: 0, y: -0.05 },
    },
    {
      eyebrow: "Stats",
      line: "See where the month is heading.",
      states: ["stats-month.png", "stats-trend.png", "stats-ahead.png"],
      taps: [
        { at: 40, x: 38, y: 11 },
        { at: 86, x: 80, y: 11 },
      ],
      focus: { from: 1.02, to: 1.16, x: 0, y: 0.08 },
    },
  ];

  return <Feature {...features[index]} duration={duration} />;
};

/* ================================================= 4 · the workflow montage */

const MONTAGE = [
  { src: "log.png", offsetY: 0 },
  { src: "log-search.png", offsetY: 0 },
  { src: "add-empty.png", offsetY: 0 },
  { src: "add-calculator.png", offsetY: 0 },
  { src: "budgets.png", offsetY: 0 },
  { src: "goals.png", offsetY: 0 },
  { src: "safe-to-spend.png", offsetY: 0 },
  { src: "stats-scrolled.png", offsetY: 0 },
];

export const SceneMontage: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const stage = useStage();
  const device = stage.phone({ width: 560, y: -150 });
  const per = duration / MONTAGE.length;
  const index = Math.min(MONTAGE.length - 1, Math.floor(frame / per));
  const local = frame - index * per;
  const punch = interpolate(local, [0, 7, per], [0.965, 1.01, 1], { extrapolateRight: "clamp", easing: ease });
  const slide = interpolate(local, [0, 10], [26, 0], { extrapolateRight: "clamp", easing: ease });
  const shot = MONTAGE[index];

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${punch}) translateY(${slide}px)` }}>
        <Phone src={shot.src} offsetY={shot.offsetY} width={device.width} x={device.x} y={device.y} />
      </AbsoluteFill>
      <div style={stage.copy}>
        <div style={{ opacity: ramp(frame, 6, 24) }}>
          <Eyebrow color={theme.accent}>In seconds</Eyebrow>
          <Headline size={stage.landscape ? 72 : 64} style={{ marginTop: 16 }}>
            Less typing.
            <br />
            More knowing.
          </Headline>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ========================================================== 5 · hero shot */

export const SceneHero: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const stage = useStage();
  const device = stage.phone({ width: 470, y: -210 });
  const enter = useSpring(0, { damping: 30, stiffness: 55, mass: 1.2 });
  const float = Math.sin(frame / 34) * 12;
  const tilt = interpolate(frame, [0, duration], [7, -3], { easing: ease });
  const leave = ramp(frame, duration, duration + CROSSFADE);

  return (
    <AbsoluteFill style={{ opacity: 1 - leave }}>
      <AbsoluteFill style={{ perspective: 1800 }}>
        <AbsoluteFill
          style={{
            transform: `translateY(${float + (1 - enter) * 90}px) rotateY(${tilt}deg) rotateX(2deg) scale(${0.94 + enter * 0.06})`,
            transformStyle: "preserve-3d",
          }}
        >
          <Phone src="home-grove.png" width={device.width} x={device.x} y={device.y} />
        </AbsoluteFill>
      </AbsoluteFill>
      <div style={stage.copy}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: ramp(frame, 14, 34) }}>
          <OwwyMark size={stage.landscape ? 96 : 82} />
          <div style={{ fontFamily: theme.sans, fontSize: stage.landscape ? 100 : 84, fontWeight: 800, letterSpacing: "0.12em", color: theme.ink, marginRight: "-0.12em" }}>{copy.name}</div>
        </div>
        <Sub size={stage.landscape ? 38 : 31} style={{ marginTop: 22, opacity: ramp(frame, 26, 46), letterSpacing: "0.06em" }}>
          {copy.promise}
        </Sub>
      </div>
    </AbsoluteFill>
  );
};

/* ===================================================== 6 · available soon */

export const SceneAvailable: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const title = useSpring(6, { damping: 20, stiffness: 95 });
  const leave = ramp(frame, duration, duration + CROSSFADE);
  const sweep = interpolate(frame, [10, 54], [-60, 160], { extrapolateRight: "clamp", easing: ease });

  return (
    <AbsoluteFill style={{ opacity: 1 - leave }}>
      <Center>
        <div style={{ textAlign: "center", marginTop: -40 }}>
          <OwwyMark size={110} style={{ opacity: ramp(frame, 0, 20) }} />
          <div style={{ position: "relative", overflow: "hidden", marginTop: 44 }}>
            <div
              style={{
                fontFamily: theme.sans,
                fontSize: 96,
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: theme.ink,
                opacity: title,
                transform: `translateY(${(1 - title) * 40}px)`,
              }}
            >
              AVAILABLE SOON
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(105deg, transparent 40%, ${theme.brand}66 50%, transparent 60%)`,
                transform: `translateX(${sweep}%)`,
                mixBlendMode: "screen",
              }}
            />
          </div>
          <Sub size={30} style={{ marginTop: 20, opacity: ramp(frame, 24, 44) }}>
            {copy.tagline}
          </Sub>

          <div style={{ display: "flex", gap: 26, justifyContent: "center", marginTop: 62 }}>
            <StoreBadge store="play" delay={34} />
            <StoreBadge store="app" delay={44} />
          </div>
        </div>
      </Center>
    </AbsoluteFill>
  );
};

/* ================================================== 7 · developer credit */

export const SceneCredit: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const enter = ramp(frame, 2, 22);
  const out = ramp(frame, duration - 20, duration);

  return (
    <AbsoluteFill>
      <Center style={{ opacity: (1 - out) * enter }}>
        {/* A quiet signature, not a title card. */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: `${interpolate(enter, [0, 1], [0.6, 0.38], { easing: ease })}em`,
              color: theme.ink2,
              marginRight: "-0.38em",
            }}
          >
            {copy.developer}
          </div>
          <div style={{ width: interpolate(enter, [0, 1], [0, 96]), height: 1, background: theme.brand, margin: "26px auto 0", opacity: 0.7 }} />
          <OwwyMark size={40} style={{ marginTop: 30, opacity: ramp(frame, 18, 38) }} />
        </div>
      </Center>
    </AbsoluteFill>
  );
};
