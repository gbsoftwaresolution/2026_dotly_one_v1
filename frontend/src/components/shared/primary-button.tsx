import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

type PrimaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    isLoading?: boolean;
    isSuccess?: boolean;
    loadingLabel?: string;
    fullWidth?: boolean;
    size?: "sm" | "md" | "lg";
  }
>;

export function PrimaryButton({
  children,
  className,
  isLoading,
  isSuccess,
  loadingLabel,
  disabled,
  fullWidth,
  size = "md",
  ...props
}: PrimaryButtonProps) {
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
        "relative inline-flex items-center justify-center font-semibold tracking-wide overflow-hidden",
        "select-none no-select tap-feedback",
        // Size
        sizeClasses[size],
        // Width
        fullWidth && "w-full",
        // Default state — High contrast monochrome (Apple Enterprise)
        !isSuccess &&
          !isLoading && [
            "bg-foreground text-background shadow-md",
            "hover:scale-[0.98] transition-all duration-[140ms] ease-[0.16,1,0.3,1]",
            "active:scale-[0.96] active:shadow-sm",
            "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-bgOnyx",
          ],
        // Loading state
        isLoading && [
          "bg-foreground/50 text-background/60",
          "cursor-not-allowed",
        ],
        // Success state
        isSuccess && [
          "bg-status-success text-white dark:text-bgOnyx",
          "scale-[1.01] transition-all duration-[180ms] ease-[0.16,1,0.3,1]",
        ],
        // Disabled state
        disabled && !isLoading && "opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          <span>{loadingLabel ?? "Processing..."}</span>
        </span>
      ) : isSuccess ? (
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M3 8l4 4 6-6"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
