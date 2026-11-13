import React from "react";
import { Composition } from "remotion";
import { Launch, LaunchLandscape } from "./Launch";
import { OwwyFilm, OwwyReel } from "./owwy-reel/Reel";
import { DURATION as OWWY_FRAMES, FILM_DURATION, FPS as OWWY_FPS } from "./owwy-reel/theme";
import { Showreel } from "./showreel/Showreel";
import { DURATION as REEL_FRAMES, FPS as REEL_FPS } from "./showreel/theme";
import { FPS, TOTAL_FRAMES } from "./theme";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Launch" component={Launch} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{}} />
    <Composition id="LaunchLandscape" component={LaunchLandscape} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{}} />
    <Composition id="Showreel" component={Showreel} durationInFrames={REEL_FRAMES} fps={REEL_FPS} width={1920} height={1080} defaultProps={{}} />
    {/* Same scenes, recomposed for 9:16 — Reels, Stories, TikTok. */}
    <Composition id="ShowreelVertical" component={Showreel} durationInFrames={REEL_FRAMES} fps={REEL_FPS} width={1080} height={1920} defaultProps={{}} />
    {/* The 15-second film of the product itself, in both aspects. */}
    <Composition id="OwwyReel" component={OwwyReel} durationInFrames={OWWY_FRAMES} fps={OWWY_FPS} width={1920} height={1080} defaultProps={{}} />
    <Composition id="OwwyReelVertical" component={OwwyReel} durationInFrames={OWWY_FRAMES} fps={OWWY_FPS} width={1080} height={1920} defaultProps={{}} />
    {/* The full minute — sixteen chapters. */}
    <Composition id="OwwyFilm" component={OwwyFilm} durationInFrames={FILM_DURATION} fps={OWWY_FPS} width={1920} height={1080} defaultProps={{}} />
    <Composition id="OwwyFilmVertical" component={OwwyFilm} durationInFrames={FILM_DURATION} fps={OWWY_FPS} width={1080} height={1920} defaultProps={{}} />
  </>
);
