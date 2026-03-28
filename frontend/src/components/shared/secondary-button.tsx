import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { Loader2 } from "lucide-react";
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
        "relative inline-flex items-center justify-center font-medium tracking-wide overflow-hidden",
        "bg-white/60 backdrop-blur-3xl dark:bg-zinc-900/60 ring-1 ring-black/5 dark:ring-white/10",
        "shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)]",
        "transition-all duration-500 hover:-translate-y-0.5",
        "select-none no-select tap-feedback",
        // Size
        sizeClasses[size],
        // Width
        fullWidth && "w-full",
        // Default state
        !isSuccess &&
          !isLoading && [
            "text-foreground",
            "active:scale-[0.96] active:shadow-none",
            "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-bgOnyx",
          ],
        // Loading state
        isLoading && [
          "text-foreground/40",
          "cursor-not-allowed",
        ],
        // Success state
        isSuccess && [
          "ring-status-success/30 bg-status-success/10 text-status-success",
        ],
        // Disabled
        disabled && !isLoading && "opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          <span>Processing…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
