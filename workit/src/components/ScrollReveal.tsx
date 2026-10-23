"use client";

import { useEffect } from "react";

/**
 * Drives the `[data-reveal]` / `[data-reveal-group]` scroll-entrance system
 * (see "Motion system" in globals.css). Mounted once in the root layout.
 *
 * Progressive enhancement: the hidden pre-state in CSS is scoped to
 * `html.js-reveal`, and this component only adds that class when
 * IntersectionObserver exists — so content can never be stuck invisible.
 *
 * A MutationObserver picks up elements added after mount (SPA navigations,
 * client-fetched lists), throttled to one scan per frame.
 */
export default function ScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    root.classList.add("js-reveal");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-revealed");
            io.unobserve(e.target);
          }
        }
      },
      // Bottom: reveal slightly before the element fully enters, so the
      // motion is visible but never makes the user wait for content.
      // Top: a huge margin so anything the user has already scrolled PAST
      // counts as revealed — fast flicks and anchor jumps can teleport more
      // than a viewport per frame, and without this, skipped elements would
      // sit invisible above the user until they slowly scrolled back up.
      { rootMargin: "6000px 0px -8% 0px", threshold: 0.05 },
    );

    const observeAll = () => {
      document
        .querySelectorAll(
          "[data-reveal]:not(.is-revealed), [data-reveal-group]:not(.is-revealed)",
        )
        .forEach((el) => io.observe(el));
    };
    observeAll();

    let scheduled = false;
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        observeAll();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      root.classList.remove("js-reveal");
    };
  }, []);
  return null;
}
