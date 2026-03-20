import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

type SecondaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement>
>;

export function SecondaryButton({
  children,
  className,
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex py-5 items-center justify-center rounded-2xl border border-slate-200 bg-white/50 px-5 text-sm font-bold text-slate-900 transition-all hover:bg-slate-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-brandRose dark:focus:ring-brandCyan focus:ring-offset-2 dark:focus:ring-offset-bgOnyx",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
