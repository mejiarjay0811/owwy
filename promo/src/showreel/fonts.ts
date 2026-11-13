import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Variable fonts, loaded before the first frame is rendered. Without the
 * delayRender handle, early frames would be committed in a fallback face and
 * the type would visibly jump a second in.
 */
export const useReelFonts = (): void => {
  const [handle] = useState(() => delayRender("loading variable fonts"));
  useEffect(() => {
    const faces = [
      new FontFace("Jakarta", `url(${staticFile("fonts/jakarta.woff2")}) format("woff2-variations")`, { weight: "200 800" }),
      new FontFace("Fraunces", `url(${staticFile("fonts/fraunces.woff2")}) format("woff2-variations")`, { weight: "100 900" }),
    ];
    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => {
        loaded.forEach((f) => document.fonts.add(f));
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [handle]);
};
