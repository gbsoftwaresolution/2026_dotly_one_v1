"use client";

import { cn } from "@/lib/utils/cn";

export type QrMode = "standard" | "quick_connect";

interface QrModeToggleProps {
  value: QrMode;
  onChange: (value: QrMode) => void;
}

const modeOptions: Array<{ value: QrMode; label: string }> = [
  { value: "standard", label: "Standard" },
  { value: "quick_connect", label: "Quick Connect" },
];

export function QrModeToggle({ value, onChange }: QrModeToggleProps) {
  return (
    <div className="grid grid-cols-2 rounded-2xl border border-border bg-slate-100/80 p-1">
      {modeOptions.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "min-h-11 rounded-xl px-4 text-sm font-semibold transition",
              isActive
                ? "bg-white text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
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
