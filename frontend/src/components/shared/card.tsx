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
        "relative overflow-hidden rounded-[24px]",
        "bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10",
        elevated ? "shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)]" : "shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]",
        interactive &&
          "cursor-pointer transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] active:scale-[0.99]",
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
