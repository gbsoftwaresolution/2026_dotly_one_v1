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
        "flex flex-col justify-between rounded-2xl bg-white/80 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 transition-all duration-300 hover:scale-[0.995] dark:bg-zinc-950/80 dark:ring-white/[0.06]",
        highlight &&
          "bg-foreground/[0.04] ring-black/10 dark:bg-white/[0.06] dark:ring-white/10",
      )}
    >
      <p className="label-xs text-muted">{label}</p>
      <p className={cn("mt-2 font-mono text-2xl font-bold", "text-foreground")}>
        {value}
      </p>
    </div>
  );
}
