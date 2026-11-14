import type { HeroPattern as Pattern } from "@/types/models";

/**
 * The engraving on the balance card.
 *
 * Drawn in `currentColor` at low opacity so it reads on any finish, light or
 * dark, without a second set of colours to keep in step. Sits behind the
 * card's content on its own layer and never takes a tap.
 */
export function HeroPattern({ pattern }: { pattern: Pattern }) {
  if (pattern === "none") return null;

  if (pattern === "rings") {
    return (
      <svg className="pointer-events-none absolute -top-8 -right-10 -z-10 h-56 w-56 opacity-[0.09]" viewBox="0 0 200 200" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="2">
          {Array.from({ length: 5 }).map((_, i) => (
            <circle key={i} cx="120" cy="80" r={24 + i * 22} />
          ))}
        </g>
      </svg>
    );
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 -z-10 size-full opacity-[0.11]"
      viewBox="0 0 400 220"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden
    >
      {pattern === "feathers" && (
        <g fill="none" stroke="currentColor" strokeWidth="1.5">
          {Array.from({ length: 7 }).map((_, row) =>
            Array.from({ length: 8 }).map((__, col) => {
              const x = 400 - col * 30 - (row % 2) * 15;
              const y = 220 - row * 20;
              return <path key={`${row}-${col}`} d={`M${x - 15} ${y} a15 15 0 0 1 30 0`} />;
            }),
          )}
        </g>
      )}
      {pattern === "waves" && (
        <g fill="none" stroke="currentColor" strokeWidth="1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <path key={i} d={`M-10 ${110 + i * 16} C 90 ${78 + i * 16}, 180 ${154 + i * 16}, 270 ${106 + i * 16} S 380 ${86 + i * 16}, 410 ${100 + i * 16}`} />
          ))}
        </g>
      )}
      {pattern === "dots" && (
        <>
          <g fill="currentColor">
            {[
              [300, 42, 2.4], [344, 74, 1.7], [376, 30, 3], [320, 116, 2], [258, 62, 1.5], [360, 150, 2.4],
              [276, 158, 1.7], [224, 32, 1.8], [386, 192, 1.8], [190, 94, 1.4], [150, 176, 2.1], [244, 198, 1.5],
            ].map(([cx, cy, r], i) => (
              <circle key={i} cx={cx} cy={cy} r={r} />
            ))}
          </g>
          <circle cx="346" cy="62" r="34" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </>
      )}
    </svg>
  );
}
