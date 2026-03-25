import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

interface CardProps extends PropsWithChildren {
  className?: string;
  /** Elevates the card surface one level */
  elevated?: boolean;
  /** Adds a subtle glow on hover */
  interactive?: boolean;
}

export function Card({
  children,
  className,
  elevated,
  interactive,
}: CardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card bg-white/88 ring-1 ring-black/[0.05] dark:bg-zinc-950/88 dark:ring-white/[0.06]",
        elevated &&
          "shadow-[0_10px_34px_rgba(0,0,0,0.10)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.30)]",
        !elevated && "shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        interactive &&
          "cursor-pointer transition-all duration-300 ease-[0.16,1,0.3,1] hover:scale-[0.995] hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)] active:scale-[0.99]",
        "before:absolute before:inset-x-0 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        "dark:before:via-white/[0.08]",
        className,
      )}
    >
      <div className="relative z-10 p-5">{children}</div>
    </div>
  );
}
