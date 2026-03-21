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
    <div className="rounded-[22px] border border-border bg-white/60 p-4 dark:bg-white/[0.03]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-border p-2">
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