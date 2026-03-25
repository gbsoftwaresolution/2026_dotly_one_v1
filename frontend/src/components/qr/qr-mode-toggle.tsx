"use client";

import { cn } from "@/lib/utils/cn";

export type QrMode = "standard" | "quick_connect";

interface QrModeToggleProps {
  value: QrMode;
  onChange: (value: QrMode) => void;
}

const modeOptions: Array<{ value: QrMode; label: string }> = [
  { value: "standard", label: "Contact" },
  { value: "quick_connect", label: "Connect" },
];

export function QrModeToggle({ value, onChange }: QrModeToggleProps) {
  return (
    <div className="grid grid-cols-2 rounded-2xl bg-foreground/[0.03] p-1 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
      {modeOptions.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "min-h-11 rounded-xl px-4 text-sm font-semibold transition-all",
              isActive
                ? "bg-foreground text-background shadow-sm"
                : "text-muted hover:bg-foreground/[0.05] hover:text-foreground dark:hover:bg-white/[0.06]",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
