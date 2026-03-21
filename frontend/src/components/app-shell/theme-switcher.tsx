"use client";

import { useEffect, useState } from "react";

import { useTheme } from "@/context/ThemeContext";

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button
      onClick={toggleTheme}
      className="rounded-full bg-slate-100 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200 active:scale-95 dark:bg-zinc-800 dark:text-brandCyan dark:hover:bg-zinc-700"
    >
      {mounted
        ? theme === "onyx"
          ? "ONYX PROTOCOL"
          : "LUMINOUS MODE"
        : "THEME MODE"}
    </button>
  );
}
