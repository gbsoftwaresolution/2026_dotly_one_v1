import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

type PrimaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    isLoading?: boolean;
    isSuccess?: boolean;
    loadingLabel?: string;
    /** Full-width layout */
    fullWidth?: boolean;
    /** Smaller size variant */
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
        // Default state — dark: electric cyan gradient, light: hot rose gradient
        !isSuccess &&
          !isLoading && [
            "dark:bg-gradient-cyan dark:text-bgOnyx dark:shadow-[0_0_0_1px_rgba(0,212,255,0.3),0_4px_16px_rgba(0,212,255,0.20)]",
            "bg-gradient-rose text-white shadow-[0_0_0_1px_rgba(255,51,102,0.3),0_4px_16px_rgba(255,51,102,0.20)]",
            "tap-feedback transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-[140ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            "hover:opacity-95 hover:-translate-y-px hover:shadow-glow dark:hover:shadow-glow",
            "active:translate-y-0 active:shadow-none",
            "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-bgOnyx",
          ],
        // Loading state
        isLoading && [
          "dark:bg-brandCyan/30 dark:text-bgOnyx/60",
          "bg-brandRose/30 text-white/60",
          "cursor-not-allowed",
        ],
        // Success state
        isSuccess && [
          "bg-status-success text-white dark:text-bgOnyx",
          "shadow-[0_0_0_1px_rgba(48,209,88,0.3),0_4px_16px_rgba(48,209,88,0.20)]",
          "scale-[1.01] tap-feedback transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        ],
        // Disabled state
        disabled && !isLoading && "opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {/* Inner highlight line */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
      />

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
              strokeWidth="2"
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
