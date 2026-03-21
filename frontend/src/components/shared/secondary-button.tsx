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
    sm: "h-10 px-4 text-xs rounded-xl",
    md: "h-14 px-6 text-sm rounded-2xl",
    lg: "h-16 px-8 text-base rounded-2xl",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        // Base
        "relative inline-flex items-center justify-center font-bold tracking-tight overflow-hidden",
        "select-none no-select",
        // Size
        sizeClasses[size],
        // Width
        fullWidth && "w-full",
        // Default state
        !isSuccess &&
          !isLoading && [
            // Dark mode: glass surface
            "dark:bg-white/[0.06] dark:border dark:border-white/[0.08] dark:text-white",
            "dark:hover:bg-white/[0.10] dark:hover:border-white/[0.12]",
            // Light mode: white surface
            "bg-white border border-black/[0.08] text-slate-900",
            "hover:bg-slate-50 hover:border-black/[0.12]",
            // Shared interactions
            "transition-all duration-250 ease-spring",
            "hover:-translate-y-px active:scale-[0.97] active:translate-y-0",
            "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-bgOnyx",
          ],
        // Loading state
        isLoading && [
          "dark:bg-white/[0.04] dark:border dark:border-white/[0.06] dark:text-white/40",
          "bg-slate-100 border border-black/[0.06] text-slate-400",
          "cursor-not-allowed",
        ],
        // Success state
        isSuccess && [
          "border border-status-success/30 bg-status-success/10 text-status-success",
        ],
        // Disabled
        disabled && !isLoading && "opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {/* Inner highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
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
