"use client";

import { useEffect, useState } from "react";

import { useTheme } from "@/context/ThemeContext";

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? theme === "onyx" : true;

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative h-8 w-14 rounded-pill transition-all duration-350 ease-spring active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-bgOnyx no-select overflow-hidden"
      style={{
        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(0,0,0,0.08)",
      }}
    >
      {/* Track background */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-pill transition-colors duration-350"
      />

      {/* Thumb */}
      <span
        aria-hidden
        className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-all duration-350 ease-spring shadow-float flex items-center justify-center"
        style={{
          left: isDark ? "calc(100% - 25px)" : "3px",
          background: isDark
            ? "linear-gradient(135deg, #00D4FF 0%, #7C3AED 100%)"
            : "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
        }}
      >
        {/* Sun icon (light mode) */}
        {!isDark && (
          <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden>
            <circle cx="8" cy="8" r="3" fill="white" />
            <path
              d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
        {/* Moon icon (dark mode) */}
        {isDark && (
          <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden>
            <path
              d="M13.5 9.5A6 6 0 016.5 2.5a6 6 0 100 11 6 6 0 007-4z"
              fill="white"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
