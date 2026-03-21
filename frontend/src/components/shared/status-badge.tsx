import { cn } from "@/lib/utils/cn";

interface StatusBadgeProps {
  label: string;
  tone?:
    | "neutral"
    | "success"
    | "warning"
    | "error"
    | "info"
    | "cyan"
    | "violet";
  dot?: boolean;
}

const toneClasses: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  neutral:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.08] dark:text-white/70 dark:border-white/[0.10]",
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-status-success/10 dark:text-status-success dark:border-status-success/20",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-status-warning/10 dark:text-status-warning dark:border-status-warning/20",
  error:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-status-error/10 dark:text-status-error dark:border-status-error/20",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-status-info/10 dark:text-status-info dark:border-status-info/20",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-brandCyan/10 dark:text-brandCyan dark:border-brandCyan/20",
  violet:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-brandViolet/10 dark:text-brandViolet dark:border-brandViolet/20",
};

const dotColors: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  neutral: "bg-slate-400 dark:bg-white/50",
  success: "bg-emerald-500 dark:bg-status-success",
  warning: "bg-amber-500 dark:bg-status-warning",
  error: "bg-rose-500 dark:bg-status-error",
  info: "bg-blue-500 dark:bg-status-info",
  cyan: "bg-cyan-500 dark:bg-brandCyan",
  violet: "bg-violet-500 dark:bg-brandViolet",
};

export function StatusBadge({
  label,
  tone = "neutral",
  dot = false,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1",
        "font-mono text-[10px] font-black uppercase tracking-[0.10em]",
        "border",
        toneClasses[tone],
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 rounded-full flex-shrink-0",
            dotColors[tone],
          )}
        />
      )}
      {label}
    </span>
  );
}
