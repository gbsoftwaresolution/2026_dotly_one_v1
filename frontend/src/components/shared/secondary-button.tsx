import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

type SecondaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    isLoading?: boolean;
    isSuccess?: boolean;
  }
>;

export function SecondaryButton({
  children,
  className,
  isLoading,
  isSuccess,
  disabled,
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex py-5 items-center justify-center rounded-2xl border px-5 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-bgOnyx",
        !isSuccess &&
          !isLoading &&
          "border-slate-200 bg-white/50 text-slate-900 hover:bg-slate-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white dark:hover:bg-zinc-800 focus:ring-brandRose dark:focus:ring-brandCyan",
        isLoading &&
          "border-slate-200 bg-slate-50 opacity-70 text-slate-400 cursor-not-wait dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500",
        isSuccess &&
          "border-emerald-500 bg-emerald-50/50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-400 focus:ring-emerald-500",
        className,
      )}
      {...props}
    >
      {isLoading ? "Processing..." : children}
    </button>
  );
}
