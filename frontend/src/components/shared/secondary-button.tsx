import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

type SecondaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    isLoading?: boolean;
    isSuccess?: boolean;
    fullWidth?: boolean;
    size?: "sm" | "md" | "lg";
  }
>;

export function SecondaryButton({
  children,
  className,
  isLoading,
  isSuccess,
  disabled,
  fullWidth,
  size = "md",
  ...props
}: SecondaryButtonProps) {
  const sizeClasses = {
    sm: "h-10 px-4 text-[13px] rounded-full",
    md: "h-12 px-6 text-[15px] rounded-full",
    lg: "h-[56px] px-8 text-[17px] rounded-full",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        // Base
        "relative inline-flex items-center justify-center font-medium tracking-wide overflow-hidden backdrop-blur-xl",
        "select-none no-select tap-feedback",
        // Size
        sizeClasses[size],
        // Width
        fullWidth && "w-full",
        // Default state - Premium subtle card feel
        !isSuccess &&
          !isLoading && [
            "bg-foreground/[0.03] dark:bg-foreground/[0.05] text-foreground",
            "ring-1 ring-black/5 dark:ring-white/10 shadow-sm",
            "hover:bg-foreground/[0.05] dark:hover:bg-foreground/[0.08] hover:scale-[0.98]",
            "transition-all duration-[140ms] ease-[0.16,1,0.3,1]",
            "active:scale-[0.96] active:shadow-none",
            "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-bgOnyx",
          ],
        // Loading state
        isLoading && [
          "bg-foreground/[0.02] text-foreground/40 ring-1 ring-black/5 dark:ring-white/5",
          "cursor-not-allowed",
        ],
        // Success state
        isSuccess && [
          "ring-1 ring-status-success/30 bg-status-success/10 text-status-success",
          "transition-all duration-[180ms] ease-[0.16,1,0.3,1]",
        ],
        // Disabled
        disabled && !isLoading && "opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          <span>Processing…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
