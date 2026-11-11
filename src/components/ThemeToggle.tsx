"use client";

import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-[var(--color-cream-2)] transition-colors ${className}`}
    >
      <span className="relative w-5 h-5 block">
        {/* Sun */}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="absolute inset-0 w-full h-full transition-all duration-300"
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark ? "rotate(-90deg) scale(0.6)" : "rotate(0) scale(1)",
            color: "var(--color-ochre-600)",
          }}
        >
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
            <line x1="4.5" y1="4.5" x2="6" y2="6" />
            <line x1="18" y1="18" x2="19.5" y2="19.5" />
            <line x1="4.5" y1="19.5" x2="6" y2="18" />
            <line x1="18" y1="6" x2="19.5" y2="4.5" />
          </g>
        </svg>
        {/* Moon */}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="absolute inset-0 w-full h-full transition-all duration-300"
          style={{
            opacity: isDark ? 1 : 0,
            transform: isDark ? "rotate(0) scale(1)" : "rotate(90deg) scale(0.6)",
            color: "var(--color-ochre-300)",
          }}
        >
          <path
            d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"
            fill="currentColor"
          />
        </svg>
      </span>
    </button>
  );
}
