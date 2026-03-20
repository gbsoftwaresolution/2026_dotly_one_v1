"use client";

import { useTheme } from "@/context/ThemeContext";

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="rounded-full bg-slate-100 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200 active:scale-95 dark:bg-zinc-800 dark:text-brandCyan dark:hover:bg-zinc-700"
    >
      {theme === "onyx" ? "ONYX PROTOCOL" : "LUMINOUS MODE"}
    </button>
  );
}
