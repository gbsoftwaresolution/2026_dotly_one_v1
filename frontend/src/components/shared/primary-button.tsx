import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

type PrimaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    isLoading?: boolean;
    isSuccess?: boolean;
  }
>;

export function PrimaryButton({
  children,
  className,
  isLoading,
  isSuccess,
  disabled,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex py-5 items-center justify-center rounded-2xl px-5 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-bgOnyx",
        !isSuccess &&
          !isLoading &&
          "bg-brandRose text-white hover:opacity-90 active:scale-95 dark:bg-brandCyan dark:text-bgOnyx focus:ring-brandRose dark:focus:ring-brandCyan",
        isLoading &&
          "bg-brandRose/70 text-white opacity-70 cursor-not-wait dark:bg-brandCyan/70 dark:text-bgOnyx",
        isSuccess &&
          "bg-emerald-500 text-white dark:bg-emerald-400 dark:text-bgOnyx focus:ring-emerald-500",
        className,
      )}
      {...props}
    >
      {isLoading ? "Processing..." : children}
    </button>
  );
}
