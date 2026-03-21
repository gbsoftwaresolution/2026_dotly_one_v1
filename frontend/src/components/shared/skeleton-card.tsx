import { cn } from "@/lib/utils/cn";

interface SkeletonCardProps {
  className?: string;
  /** Number of rows to show in the content area */
  rows?: number;
  /** Show avatar circle on the left */
  showAvatar?: boolean;
}

function SkeletonLine({
  width = "full",
  height = "h-3",
}: {
  width?: string;
  height?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg skeleton",
        height,
        width === "full"
          ? "w-full"
          : width === "3/4"
            ? "w-3/4"
            : width === "1/2"
              ? "w-1/2"
              : width === "1/3"
                ? "w-1/3"
                : width === "2/3"
                  ? "w-2/3"
                  : "w-full",
      )}
    />
  );
}

export function SkeletonCard({
  className,
  rows = 2,
  showAvatar = true,
}: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-white/[0.06] dark:border-white/[0.05] bg-surface1/50 dark:bg-surface1/50 p-5",
        "animate-pulse",
        className,
      )}
      aria-hidden
    >
      <div className="flex items-start gap-4">
        {showAvatar && (
          <div className="h-12 w-12 flex-shrink-0 rounded-full skeleton" />
        )}

        <div className="flex-1 space-y-3 py-0.5">
          <SkeletonLine width="3/4" height="h-4" />
          {rows >= 2 && <SkeletonLine width="1/2" />}
          {rows >= 3 && <SkeletonLine width="2/3" />}
        </div>
      </div>

      {rows >= 4 && (
        <div className="mt-4 space-y-2">
          <SkeletonLine width="full" />
          <SkeletonLine width="3/4" />
        </div>
      )}
    </div>
  );
}
