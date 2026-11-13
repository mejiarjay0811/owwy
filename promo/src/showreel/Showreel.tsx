import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { useReelFonts } from "./fonts";
import { Grain, Hud, Sweeps, Vignette } from "./primitives";
import { Depth, Disruption, Ignition, KineticType, LineWork, Resolve, ShapeMorph, Systems } from "./scenes";
import { BEAT, C, CHAPTERS, CUTS, DURATION } from "./theme";

const SCENES = [Ignition, KineticType, ShapeMorph, Systems, LineWork, Depth, Disruption, Resolve];

export const Showreel: React.FC = () => {
  useReelFonts();

  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {CHAPTERS.map((chapter, i) => {
        const Scene = SCENES[i];
        return (
          <Sequence key={chapter.label} from={chapter.start} durationInFrames={chapter.length}>
            <Scene />
          </Sequence>
        );
      })}

      {/* Above every scene: the cuts, then the texture, then the reel's chrome. */}
      <Sweeps cuts={CUTS} />
      <Vignette />
      <Grain />
      <Hud chapters={CHAPTERS} duration={DURATION} beat={BEAT} />
    </AbsoluteFill>
  );
};
