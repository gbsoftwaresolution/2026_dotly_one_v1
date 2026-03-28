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
        "flex flex-col justify-between rounded-[24px] bg-white/50 backdrop-blur-md p-4 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 transition-all duration-500 hover:-translate-y-1 dark:bg-zinc-900/60 dark:ring-white/10",
        highlight &&
          "bg-white/60 ring-black/10 dark:bg-zinc-800/60 dark:ring-white/10",
      )}
    >
      <p className="label-xs text-muted">{label}</p>
      <p className={cn("mt-2 font-mono text-2xl font-bold", "text-foreground")}>
        {value}
      </p>
    </div>
  );
}
