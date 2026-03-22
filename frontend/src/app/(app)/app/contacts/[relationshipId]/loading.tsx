import { Card } from "@/components/shared/card";

export default function Loading() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
        <div className="h-4 w-64 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
      </div>

      <Card className="space-y-6">
        <div className="flex flex-col items-center gap-4 pt-2">
          <div className="h-24 w-24 animate-pulse rounded-3xl bg-slate-200 dark:bg-zinc-800" />
          <div className="space-y-2 text-center">
            <div className="h-6 w-40 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
            <div className="mx-auto h-4 w-24 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2 bg-surface p-4">
              <div className="h-3 w-20 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
              <div className="h-4 w-24 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="h-5 w-32 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
      </Card>
    </section>
  );
}