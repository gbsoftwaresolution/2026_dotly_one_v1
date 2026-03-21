"use client";

interface DiscoveryToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function DiscoveryToggle({
  enabled,
  onToggle,
  isLoading,
  disabled = false,
}: DiscoveryToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      {/* Label + status copy */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            Discovery Signal
          </p>
          {/* Live pulse indicator — only shown when broadcasting */}
          {enabled && !isLoading ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brandRose opacity-75 dark:bg-brandCyan" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brandRose dark:bg-brandCyan" />
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted">
          {enabled
            ? "Broadcasting — you are visible to others at this event."
            : "Stealth — you are hidden. Toggle on to appear in the participant list."}
        </p>
      </div>

      {/* High-gravity toggle switch */}
      <button
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle discovery signal"
        disabled={isLoading || disabled}
        onClick={() => onToggle(!enabled)}
        className={[
          "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
          "transition-colors duration-200 ease-in-out",
          "focus:outline-none focus:ring-2 focus:ring-offset-2",
          "focus:ring-brandRose dark:focus:ring-brandCyan",
          "dark:focus:ring-offset-bgOnyx",
          "disabled:cursor-not-allowed disabled:opacity-50",
          enabled
            ? "bg-brandRose dark:bg-brandCyan"
            : "bg-slate-200 dark:bg-zinc-700",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="sr-only">Toggle discovery</span>
        <span
          className={[
            "pointer-events-none inline-block h-6 w-6 transform rounded-full shadow-md ring-0",
            "transition-transform duration-200 ease-in-out",
            // Thumb color: white when ON (against brand bg), zinc when OFF
            enabled
              ? "translate-x-6 bg-white"
              : "translate-x-0 bg-white dark:bg-zinc-300",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </button>
    </div>
  );
}
