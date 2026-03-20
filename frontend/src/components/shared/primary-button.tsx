import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

type PrimaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement>
>;

export function PrimaryButton({
  children,
  className,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex py-5 items-center justify-center rounded-2xl bg-brandRose px-5 text-sm font-bold text-white transition-all active:scale-95 hover:opacity-90 dark:bg-brandCyan dark:text-bgOnyx focus:outline-none focus:ring-2 focus:ring-brandRose dark:focus:ring-brandCyan focus:ring-offset-2 dark:focus:ring-offset-bgOnyx",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
