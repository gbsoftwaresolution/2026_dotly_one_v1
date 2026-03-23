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
    <div className="flex animate-fade-in flex-col items-center justify-center space-y-5 rounded-card border border-dashed border-black/[0.08] bg-white/70 px-6 py-14 text-center dark:border-white/[0.06] dark:bg-white/[0.02]">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-black/[0.08] bg-black/[0.03] dark:border-white/[0.06] dark:bg-white/[0.04]">
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

      <div className="max-w-[260px] space-y-2">
        <h2 className="font-sans text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{description}</p>
      </div>

      {action ? (
        <div className="w-full max-w-[240px] pt-1">{action}</div>
      ) : null}
    </div>
  );
}
