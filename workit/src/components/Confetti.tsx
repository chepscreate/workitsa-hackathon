"use client";

import { useEffect, useState } from "react";

const COLORS = [
  "var(--color-ochre-500)",
  "var(--color-ochre-300)",
  "var(--color-sage-400)",
  "var(--color-sage-600)",
  "var(--color-ink)",
];

/**
 * Small celebratory burst — render conditionally then unmount after ~1s.
 * Pure DOM/CSS, no dependency.
 */
export default function Confetti({ active }: { active: boolean }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (active) {
      setMounted(true);
      const t = setTimeout(() => setMounted(false), 1000);
      return () => clearTimeout(t);
    }
  }, [active]);

  if (!mounted) return null;

  const pieces = Array.from({ length: 24 });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-50">
      {pieces.map((_, i) => {
        const angle = (Math.PI * 2 * i) / pieces.length + Math.random() * 0.5;
        const distance = 80 + Math.random() * 70;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance - 20; // bias upward
        const color = COLORS[i % COLORS.length];
        const size = 6 + Math.random() * 6;
        return (
          <span
            key={i}
            className="confetti-piece absolute top-1/2 left-1/2"
            style={
              {
                width: `${size}px`,
                height: `${size}px`,
                background: color,
                borderRadius: i % 2 === 0 ? "50%" : "2px",
                "--end-transform": `translate(${x}px, ${y}px) rotate(${Math.random() * 540}deg)`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
