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
        "flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all",
        highlight &&
          "border-brandRose/30 bg-brandRose/5 dark:border-brandCyan/30 dark:bg-brandCyan/5 shadow-[0_0_20px_rgba(255,83,112,0.08)] dark:shadow-[0_0_20px_rgba(0,245,212,0.08)]",
      )}
    >
      <p className="label-xs text-muted">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl font-bold",
          highlight ? "text-brandRose dark:text-brandCyan" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
