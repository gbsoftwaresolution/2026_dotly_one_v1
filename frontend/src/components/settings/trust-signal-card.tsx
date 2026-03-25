import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type TrustSignalTone = "success" | "warning" | "info";

const toneClassNames: Record<TrustSignalTone, string> = {
  success:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  info: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

export function TrustSignalCard({
  title,
  status,
  description,
  detail,
  tone,
  icon,
}: {
  title: string;
  status: string;
  description: string;
  detail?: string;
  tone: TrustSignalTone;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[22px] bg-white/80 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 transition-all duration-200 hover:scale-[0.995] dark:bg-zinc-950/80 dark:ring-white/[0.06]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-foreground/[0.03] p-2 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]",
                toneClassNames[tone],
              )}
            >
              {status}
            </span>
          </div>
          <p className="text-sm leading-6 text-muted">{description}</p>
          {detail ? (
            <p className="truncate font-mono text-xs text-muted">{detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
