import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Makes the title larger — for top-level section headings */
  large?: boolean;
}

export function PageHeader({
  title,
  description,
  action,
  large,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="space-y-1 min-w-0">
        <h1
          className={cn(
            "font-bold tracking-tight text-foreground leading-tight",
            large ? "text-3xl sm:text-3xl" : "text-[1.75rem] sm:text-2xl",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex w-full items-center sm:w-auto sm:shrink-0">
          {action}
        </div>
      ) : null}
    </header>
  );
}
