import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-5 rounded-card border border-dashed border-white/[0.08] dark:border-white/[0.06] bg-white/[0.02] dark:bg-white/[0.02] px-6 py-14 text-center animate-fade-in">
      {/* Circular icon container */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] dark:bg-white/[0.04] border border-white/[0.08] dark:border-white/[0.06]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-muted"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      </div>

      <div className="space-y-2 max-w-[240px]">
        <h2 className="font-sans text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="font-mono text-[11px] leading-relaxed text-muted">
          {description}
        </p>
      </div>

      {action ? (
        <div className="w-full max-w-[240px] pt-1">{action}</div>
      ) : null}
    </div>
  );
}
