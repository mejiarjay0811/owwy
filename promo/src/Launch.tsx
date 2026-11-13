import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Background } from "./components";
import { SceneAlive, SceneAvailable, SceneCredit, SceneFeatures, SceneHero, SceneIntro, SceneMontage } from "./scenes";
import { CROSSFADE, theme, timeline } from "./theme";

/** Fonts are the app's own: Plus Jakarta Sans for UI, Fraunces (soft) for display. */
const Fonts: React.FC = () => (
  <style>{`
    @font-face {
      font-family: "Jakarta Promo";
      src: url("${staticFile("fonts/plus-jakarta-sans-latin-wght-normal.woff2")}") format("woff2-variations");
      font-weight: 200 800;
      font-display: block;
    }
    @font-face {
      font-family: "Fraunces Promo";
      src: url("${staticFile("fonts/fraunces-latin-soft-normal.woff2")}") format("woff2-variations");
      font-weight: 100 900;
      font-display: block;
    }
  `}</style>
);

export interface LaunchProps {
  /** Drop a royalty-free track in public/ and pass its name to score the film. */
  audio?: string;
  /** The landscape cut paints its own full-width background behind the scaled film. */
  withBackground?: boolean;
}

/**
 * The 45-second launch film. Scene boundaries live in theme.ts so a composer
 * can cut music to exactly the same marks.
 */
export const Launch: React.FC<LaunchProps> = ({ audio, withBackground = true }) => {
  const features = timeline.features.duration / 4;

  return (
    <AbsoluteFill style={{ background: withBackground ? theme.bg : "transparent", fontFamily: theme.sans }}>
      <Fonts />
      {audio ? <Audio src={staticFile(audio)} /> : null}
      {/* One continuous room, so scenes dissolve into each other instead of cutting to black. */}
      {withBackground ? <Background /> : null}

      {/*
       * Each scene keeps its slot but plays CROSSFADE frames longer, fading out
       * over the next one, which has already started. Hence the reversed order:
       * a scene must sit above its successor while it dissolves.
       */}
      <Sequence from={timeline.credit.from} durationInFrames={timeline.credit.duration}>
        <SceneCredit duration={timeline.credit.duration} />
      </Sequence>

      <Sequence from={timeline.available.from} durationInFrames={timeline.available.duration + CROSSFADE}>
        <SceneAvailable duration={timeline.available.duration} />
      </Sequence>

      <Sequence from={timeline.hero.from} durationInFrames={timeline.hero.duration + CROSSFADE}>
        <SceneHero duration={timeline.hero.duration} />
      </Sequence>

      <Sequence from={timeline.montage.from} durationInFrames={timeline.montage.duration + CROSSFADE}>
        <SceneMontage duration={timeline.montage.duration} />
      </Sequence>

      {[3, 2, 1, 0].map((index) => (
        <Sequence key={index} from={timeline.features.from + index * features} durationInFrames={features + CROSSFADE}>
          <SceneFeatures index={index} duration={features} />
        </Sequence>
      ))}

      <Sequence from={timeline.alive.from} durationInFrames={timeline.alive.duration + CROSSFADE}>
        <SceneAlive duration={timeline.alive.duration} />
      </Sequence>

      <Sequence from={timeline.intro.from} durationInFrames={timeline.intro.duration}>
        <SceneIntro />
      </Sequence>
    </AbsoluteFill>
  );
};

/**
 * The same film, letterboxed for landscape feeds. The vertical composition is
 * scaled and centred so type stays inside a 16:9 safe area.
 */
/**
 * The 16:9 cut. Not a letterboxed copy: the scenes read the frame through
 * `useStage()` and re-compose — device left at full height, copy in a column
 * on the right.
 */
export const LaunchLandscape: React.FC<LaunchProps> = (props) => <Launch {...props} />;
