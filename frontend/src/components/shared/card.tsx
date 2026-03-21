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
        // Base structure
        "relative rounded-card overflow-hidden",
        // Dark mode: glass surface on deep background
        "dark:bg-surface1 dark:border dark:border-white/[0.06]",
        // Light mode: clean white card with soft shadow
        "bg-white border border-black/[0.06]",
        // Elevation variants
        elevated &&
          "dark:bg-surface2 dark:border-white/[0.08] shadow-card-lg dark:shadow-card-lg",
        !elevated &&
          "shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_0_rgba(255,255,255,0.9)] dark:shadow-card",
        // Interactive hover states
        interactive &&
          "transition-all duration-250 ease-smooth cursor-pointer hover:dark:border-white/[0.10] hover:dark:shadow-card-lg hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 active:scale-[0.99] active:translate-y-0",
        // Inner highlight line (Apple material feel)
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
