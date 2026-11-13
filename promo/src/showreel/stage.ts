import { useVideoConfig } from "remotion";

export interface Stage {
  W: number;
  H: number;
  CX: number;
  CY: number;
  vertical: boolean;
  /**
   * Scale for centred artwork — rings, shapes, blueprints. Driven by the
   * narrow edge, because in 9:16 it is the width that runs out first.
   */
  u: number;
  /** Picks between a landscape value and a vertical one. */
  v: <T>(landscape: T, vertical: T) => T;
}

/**
 * One set of scenes, two aspect ratios. Every measurement in the reel is
 * derived from here rather than hardcoded, so the vertical cut is a genuine
 * recomposition — type resized, grids reshaped, the card fan pulled in — and
 * not a 16:9 frame with the sides chopped off.
 */
export const useStage = (): Stage => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  return {
    W: width,
    H: height,
    CX: width / 2,
    CY: height / 2,
    vertical,
    u: Math.min(1, width / 1250),
    v: <T,>(landscape: T, vert: T): T => (vertical ? vert : landscape),
  };
};
