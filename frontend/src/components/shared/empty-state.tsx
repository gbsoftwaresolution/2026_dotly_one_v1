import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";

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
    <div className="flex animate-fade-in flex-col items-center justify-center space-y-5 rounded-[24px] bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)] px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.03] dark:bg-white/[0.04] ring-1 ring-black/5 dark:ring-white/10 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]">
        <FolderOpen
          className="h-6 w-6 text-muted"
          strokeWidth={1.5}
          aria-hidden
        />
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
