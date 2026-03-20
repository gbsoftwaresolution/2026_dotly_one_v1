"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "onyx" | "luminous";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("onyx");
  const [mounted, setMounted] = useState(false);

  // On mount, read from localStorage or default to onyx
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("dotly_theme") as Theme | null;
    if (stored === "luminous" || stored === "onyx") {
      setThemeState(stored);
    } else {
      setThemeState("onyx");
      localStorage.setItem("dotly_theme", "onyx");
    }
  }, []);

  // Sync with HTML class and localStorage
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "onyx") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("dotly_theme", theme);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => setThemeState(newTheme);
  const toggleTheme = () =>
    setThemeState((prev) => (prev === "onyx" ? "luminous" : "onyx"));

  // Prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
