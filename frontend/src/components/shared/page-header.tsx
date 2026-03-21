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
    <header className="flex items-start justify-between gap-4 pb-1">
      <div className="space-y-1 min-w-0">
        <h1
          className={cn(
            "font-bold tracking-tight text-foreground leading-tight",
            large ? "text-3xl" : "text-2xl",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="shrink-0 flex items-center">{action}</div>
      ) : null}
    </header>
  );
}
