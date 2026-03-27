import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { Loader2, Check } from "lucide-react";
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
        "transition-all duration-500 hover:-translate-y-0.5",
        "shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]",
        // Size
        sizeClasses[size],
        // Width
        fullWidth && "w-full",
        // Default state
        !isSuccess &&
          !isLoading && [
            "bg-foreground text-background",
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
          "scale-[1.01]",
        ],
        // Disabled state
        disabled && !isLoading && "opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          <span>{loadingLabel ?? "Processing..."}</span>
        </span>
      ) : isSuccess ? (
        <span className="flex items-center gap-2">
          <Check className="h-4 w-4" strokeWidth={2.5} />
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
