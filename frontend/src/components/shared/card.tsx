import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

interface CardProps extends PropsWithChildren {
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-200 bg-white/50 p-5 shadow-sm backdrop-blur-xl transition-all dark:border-zinc-900 dark:bg-bgOnyx/50",
        className,
      )}
    >
      {children}
    </div>
  );
}
