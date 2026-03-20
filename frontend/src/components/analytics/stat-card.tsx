import { cn } from "@/lib/utils/cn";

export interface StatCardProps {
  label: string;
  value: number | string;
  highlight?: boolean;
}

export function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_16px_rgb(0,0,0,0.04)] dark:border-zinc-900 dark:bg-zinc-950",
        highlight && "ring-1 ring-brandRose/50 dark:ring-brandCyan/50",
      )}
    >
      <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl font-semibold",
          highlight ? "text-brandRose dark:text-brandCyan" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
