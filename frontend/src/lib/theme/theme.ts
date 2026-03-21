export type Theme = "onyx" | "luminous";

export const THEME_STORAGE_KEY = "dotly_theme";
export const DEFAULT_THEME: Theme = "onyx";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "onyx" || value === "luminous";
}

export function resolveTheme(value: string | null | undefined): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

export function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "onyx");
  root.style.colorScheme = theme === "onyx" ? "dark" : "light";
}

export function buildThemeInitScript() {
  return `(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const defaultTheme = ${JSON.stringify(DEFAULT_THEME)};
  const root = document.documentElement;
  const storedTheme = window.localStorage.getItem(storageKey);
  const theme = storedTheme === "luminous" || storedTheme === "onyx"
    ? storedTheme
    : defaultTheme;

  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "onyx");
  root.style.colorScheme = theme === "onyx" ? "dark" : "light";
})();`;
}
