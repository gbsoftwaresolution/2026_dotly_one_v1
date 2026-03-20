import { Card } from "./card";
import { cn } from "@/lib/utils/cn";

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <Card className={cn("animate-pulse py-5", className)}>
      <div className="flex items-start gap-4">
        {/* Avatar/Icon skeleton */}
        <div className="h-12 w-12 shrink-0 rounded-full bg-slate-100 dark:bg-zinc-900" />

        {/* Content skeleton */}
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-zinc-900" />
          <div className="space-y-2">
            <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-zinc-900" />
            <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-zinc-900" />
          </div>
        </div>
      </div>
    </Card>
  );
}
