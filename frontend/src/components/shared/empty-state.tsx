import type { ReactNode } from "react";

import { Card } from "./card";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed text-center">
      <div className="flex flex-col items-center justify-center space-y-4 py-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-slate-300 dark:text-zinc-700"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8" />
        </svg>
        <div className="space-y-2">
          <h2 className="font-sans text-base font-semibold text-foreground">
            {title}
          </h2>
          <p className="font-mono text-xs leading-6 text-muted">
            {description}
          </p>
        </div>
        {action ? <div className="w-full pt-2">{action}</div> : null}
      </div>
    </Card>
  );
}
