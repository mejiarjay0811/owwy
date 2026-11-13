/* Owwy marketing site — no dependencies.
   Everything here degrades to a perfectly usable static page: if JS never
   runs, the reveal elements are shown by a fallback, the nav is a plain
   anchor list, and the showcase falls back to per-step screenshots. */

(() => {
  "use strict";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const raf = (fn) => requestAnimationFrame(fn);

  /* Mobile navigation ----------------------------------------------------- */
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("mobile-nav");

  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.hidden = !open;
    };
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    matchMedia("(min-width: 900px)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  }

  /* Hero entrance --------------------------------------------------------- */
  // Staggered by source order so the eyebrow, headline lines, copy and buttons
  // arrive in the order you'd read them.
  document.querySelectorAll(".stagger").forEach((el, i) => {
    el.style.setProperty("--delay", `${90 + i * 85}ms`);
  });

  /* Reveal on scroll ------------------------------------------------------ */
  const revealTargets = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window) || reduced) {
    revealTargets.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    // Siblings within one group cascade; the count resets per section so a
    // long page never builds up a two-second delay.
    let previousParent = null;
    let runIndex = 0;
    revealTargets.forEach((el) => {
      if (el.parentElement !== previousParent) {
        previousParent = el.parentElement;
        runIndex = 0;
      }
      el.style.setProperty("--delay", `${Math.min(runIndex, 5) * 70}ms`);
      runIndex++;
      io.observe(el);
    });
  }

  /* Header shadow once you leave the top --------------------------------- */
  const header = document.querySelector(".site-header");
  const progress = document.getElementById("scroll-progress");

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    raf(() => {
      const y = window.scrollY;
      if (header) header.classList.toggle("is-stuck", y > 8);
      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      }
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Sticky showcase ------------------------------------------------------- */
  // The phone on the right shows whichever step is nearest the middle of the
  // viewport. Only runs where the sticky layout is actually in play.
  const steps = [...document.querySelectorAll(".showcase-step")];
  const shots = [...document.querySelectorAll(".showcase-shot")];

  if (steps.length && shots.length && !reduced) {
    const desktop = matchMedia("(min-width: 900px)");
    let current = -1;

    const sync = () => {
      if (!desktop.matches) return;
      const middle = window.innerHeight / 2;
      let best = 0;
      let bestDistance = Infinity;
      steps.forEach((step, i) => {
        const box = step.getBoundingClientRect();
        const distance = Math.abs(box.top + box.height / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      if (best === current) return;
      current = best;
      steps.forEach((s, i) => s.classList.toggle("is-current", i === best));
      shots.forEach((s, i) => s.classList.toggle("is-active", i === best));
    };

    let showcaseTicking = false;
    const onShowcaseScroll = () => {
      if (showcaseTicking) return;
      showcaseTicking = true;
      raf(() => {
        sync();
        showcaseTicking = false;
      });
    };
    window.addEventListener("scroll", onShowcaseScroll, { passive: true });
    window.addEventListener("resize", onShowcaseScroll, { passive: true });
    desktop.addEventListener("change", () => {
      current = -1;
      sync();
    });
    sync();
  }

  /* Marquee --------------------------------------------------------------- */
  // Duplicated in JS rather than in the markup, so a screen reader hears the
  // list once while the animation still has a seamless -50% loop.
  const track = document.querySelector(".marquee-track");
  if (track && !reduced) {
    const clone = track.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    track.after(clone);
    clone.style.animation = getComputedStyle(track).animation;
  }

  /* Hero parallax --------------------------------------------------------- */
  const floaters = [...document.querySelectorAll("[data-float]")];
  if (floaters.length && !reduced) {
    let parallaxTicking = false;
    const onParallax = () => {
      if (parallaxTicking) return;
      parallaxTicking = true;
      raf(() => {
        const y = window.scrollY;
        if (y < window.innerHeight * 1.2) {
          floaters.forEach((el) => {
            const depth = Number(el.dataset.float) || 0;
            el.style.setProperty("--shift", `${y * (0.04 + depth * 0.025)}px`);
            el.style.translate = `0 calc(var(--shift) * -1)`;
          });
        }
        parallaxTicking = false;
      });
    };
    window.addEventListener("scroll", onParallax, { passive: true });
  }

  /* Footer year ----------------------------------------------------------- */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
