"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tween a number from its previous value to the new value over a short
 * duration. Used on KPI tiles so the figures feel "alive" rather than
 * snapping to a value on every re-render.
 */
export default function AnimatedNumber({
  value,
  format,
  duration = 600,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const previousRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = previousRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic — fast start, soft landing
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else previousRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const out = format ? format(display) : Math.round(display).toLocaleString("en-ZA");
  return <>{out}</>;
}
