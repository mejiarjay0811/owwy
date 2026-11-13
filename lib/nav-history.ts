/**
 * A record of where you've been inside the app.
 *
 * Two things need it, and both were previously guessed from `popstate`:
 *
 *  - Scroll restoration needs to know whether a navigation went back or
 *    forward. Listening for `popstate` doesn't tell you reliably: Next's own
 *    listener is registered first and flushes React inside its handler, so
 *    the effect can run before our listener has set a flag. Comparing the
 *    destination against this trail needs no event at all.
 *
 *  - The header's back chevron is a `<Link>`, which pushes a new entry and so
 *    reads as a forward navigation. Knowing the previous screen lets it call
 *    `router.back()` instead, which restores the scroll position with it.
 *
 * Module state rather than React state on purpose: the readers are a click
 * handler and an effect, both of which want the value at that moment, and a
 * re-render per navigation would buy nothing.
 */

const stack: string[] = [];

export type NavDirection = "initial" | "back" | "forward";

/**
 * Records a navigation and says which way it went.
 *
 * "back" means the destination is the entry directly behind the current one,
 * which covers the browser's Back button, a swipe, and the in-app chevron
 * alike. Re-visiting the previous screen through a link looks identical and
 * is treated the same — landing where you left off is the behaviour you want
 * there too.
 */
export function recordNavigation(path: string): NavDirection {
  if (stack.length === 0) {
    stack.push(path);
    return "initial";
  }
  if (stack.at(-1) === path) return "forward"; // A re-render, not a move.
  if (stack.at(-2) === path) {
    stack.pop();
    return "back";
  }
  stack.push(path);
  // A session can't wander far enough for this to matter, but an array that
  // only ever grows is still a leak.
  if (stack.length > 50) stack.splice(0, stack.length - 50);
  return "forward";
}

/** The screen before the current one, if we're still on the same visit. */
export function previousPath(): string | undefined {
  return stack.at(-2);
}

/** True when going back through history lands exactly on `href`. */
export function isBackTo(href: string): boolean {
  return previousPath() === href;
}
