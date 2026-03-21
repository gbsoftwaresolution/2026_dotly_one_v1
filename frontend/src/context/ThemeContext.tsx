"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

import {
  applyThemeToDocument,
  DEFAULT_THEME,
  isTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme/theme";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof document === "undefined") {
    return DEFAULT_THEME;
  }

  const documentTheme = document.documentElement.dataset.theme ?? null;

  if (isTheme(documentTheme)) {
    return documentTheme;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  return isTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => setThemeState(newTheme);
  const toggleTheme = () =>
    setThemeState((prev) => (prev === "onyx" ? "luminous" : "onyx"));

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
