import { cn } from "@/lib/utils/cn";

interface VerificationStatusBadgeProps {
  isVerified: boolean;
  compact?: boolean;
}

export function VerificationStatusBadge({
  isVerified,
  compact = false,
}: VerificationStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono font-semibold uppercase tracking-[0.16em]",
        compact ? "text-[9px]" : "text-[10px]",
        isVerified
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
    >
      {isVerified ? "Verified email" : "Email unverified"}
    </span>
  );
}