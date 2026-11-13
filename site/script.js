/* Owwy marketing site — three small behaviours, no dependencies. */

(() => {
  "use strict";

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
    // The menu is desktop-irrelevant; make sure it can't stay open across a resize.
    matchMedia("(min-width: 880px)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  }

  /* Reveal on scroll ------------------------------------------------------ */
  const targets = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Without support, or when motion is unwelcome, show everything immediately.
    targets.forEach((el) => el.classList.add("in"));
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
    targets.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
      io.observe(el);
    });
  }

  /* Footer year ----------------------------------------------------------- */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
