import { SkeletonCard } from "@/components/shared/skeleton-card";

export function AppLoadingShell() {
  return (
    <div className="mx-auto flex min-h-screen-dvh max-w-app flex-col bg-transparent">
      <header className="sticky top-0 z-header border-b border-black/[0.06] bg-white/75 backdrop-blur-2xl dark:border-white/[0.06] dark:bg-bgOnyx/75">
        <div className="safe-pt" />
        <div className="safe-pl safe-pr flex items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-16 animate-pulse rounded-full bg-foreground/8 dark:bg-white/10" />
              <div className="h-4 w-24 animate-pulse rounded-full bg-foreground/8 dark:bg-white/10" />
            </div>
            <div className="h-4 w-52 animate-pulse rounded-full bg-foreground/8 dark:bg-white/10" />
            <div className="h-4 w-44 animate-pulse rounded-full bg-foreground/8 dark:bg-white/10" />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="h-8 w-8 animate-pulse rounded-full bg-foreground/8 dark:bg-white/10" />
            <div className="h-9 w-20 animate-pulse rounded-[1rem] bg-foreground/8 dark:bg-white/10" />
          </div>
        </div>
      </header>

      <main className="safe-pl safe-pr flex-1 px-5 py-5 pb-nav">
        <div className="space-y-4">
          <div className="min-h-[116px] rounded-3xl bg-foreground/[0.03] p-6 shadow-inner ring-1 ring-inset ring-black/5 backdrop-blur dark:bg-white/[0.045] dark:ring-white/5">
            <div className="space-y-3">
              <div className="h-8 w-40 animate-pulse rounded-2xl bg-border/50" />
              <div className="h-4 w-64 animate-pulse rounded-xl bg-border/40" />
              <div className="grid grid-cols-3 gap-3 pt-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-[1.3rem] bg-background/80 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-black/10 dark:ring-white/10"
                  />
                ))}
              </div>
            </div>
          </div>

          <SkeletonCard rows={4} />
          <SkeletonCard rows={4} />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-nav border-t border-black/[0.06] bg-white/80 backdrop-blur-2xl dark:border-white/[0.06] dark:bg-bgOnyx/80">
        <div className="safe-pl safe-pr mx-auto max-w-app px-2 py-1.5">
          <div className="flex gap-1 overflow-x-auto">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-[60px] min-w-[74px] animate-pulse rounded-[1.25rem] bg-foreground/6 dark:bg-white/8"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
