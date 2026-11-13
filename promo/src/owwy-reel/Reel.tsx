import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { useReelFonts } from "../showreel/fonts";
import { Grain, Hud, Sweeps, Vignette } from "../showreel/primitives";
import type { SceneProps } from "./chrome";
import { Ask, Everything, Grove, Lockup, Private, SafeToSpend, Scan, Seed } from "./scenes";
import { BudgetsGoals, Offline, OwedDebts, Shopping, Stats, TheQuestion, TypeIt, Wallet } from "./scenes-product";
import { BEAT, CHAPTERS, CUTS, DURATION, FILM_CHAPTERS, FILM_CUTS, FILM_DURATION, O, SWEEP_PALETTE } from "./theme";

/** One film body; the chapter map decides how long it runs and what's in it. */
const Film: React.FC<{
  chapters: typeof CHAPTERS;
  cuts: readonly number[];
  duration: number;
  scenes: React.FC<SceneProps>[];
  pipEvery?: number;
}> = ({ chapters, cuts, duration, scenes, pipEvery }) => {
  useReelFonts();

  return (
    <AbsoluteFill style={{ background: O.bg }}>
      {chapters.map((chapter, i) => {
        const Scene = scenes[i];
        return (
          <Sequence key={`${chapter.n}-${chapter.label}`} from={chapter.start} durationInFrames={chapter.length}>
            {/* Each scene is told the slot it has, so it can pace its own tail. */}
            <Scene len={chapter.length} />
          </Sequence>
        );
      })}

      <Sweeps cuts={cuts} palette={SWEEP_PALETTE} />
      <Vignette strength={0.34} />
      <Grain opacity={0.13} />
      <Hud chapters={chapters} duration={duration} beat={BEAT} title="OWWY" pipEvery={pipEvery} />
    </AbsoluteFill>
  );
};

/** Fifteen seconds of the real app, cut to a 28-frame beat throughout. */
export const OwwyReel: React.FC = () => (
  <Film chapters={CHAPTERS} cuts={CUTS} duration={DURATION} scenes={[Seed, Grove, Ask, SafeToSpend, Scan, Everything, Private, Lockup]} />
);

/** The full minute: sixteen chapters over 128 beats. */
export const OwwyFilm: React.FC = () => (
  <Film
    chapters={FILM_CHAPTERS}
    cuts={FILM_CUTS}
    duration={FILM_DURATION}
    // One pip a bar rather than a beat — 128 of them would not fit the frame.
    pipEvery={4}
    scenes={[
      Seed,
      TheQuestion,
      Grove,
      TypeIt,
      Ask,
      SafeToSpend,
      Scan,
      Shopping,
      Wallet,
      Stats,
      BudgetsGoals,
      OwedDebts,
      Everything,
      Private,
      Offline,
      Lockup,
    ]}
  />
);
