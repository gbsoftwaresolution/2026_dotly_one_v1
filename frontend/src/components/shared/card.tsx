import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

interface CardProps extends PropsWithChildren {
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all dark:border-zinc-900 dark:bg-zinc-950 dark:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
