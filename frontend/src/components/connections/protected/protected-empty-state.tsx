import { ShieldAlert, AlertCircle } from "lucide-react";

interface ProtectedEmptyStateProps {
  title?: string;
  description?: string;
  type?: "blocked" | "unavailable" | "risk";
}

export function ProtectedEmptyState({
  title = "Restricted because protected mode is on",
  description = "Unavailable until protected mode changes.",
  type = "blocked",
}: ProtectedEmptyStateProps) {
  const Icon =
    type === "blocked" || type === "risk" ? ShieldAlert : AlertCircle;
  const colorClass =
    type === "risk" ? "text-rose-500 bg-rose-50" : "text-slate-500 bg-slate-50";
  const ringClass = type === "risk" ? "ring-rose-100" : "ring-slate-100";

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-slate-200 ${colorClass} ring-1 ${ringClass}`}
    >
      <div className="h-12 w-12 rounded-full flex items-center justify-center mb-4 rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1">
        <Icon
          className={`h-6 w-6 ${type === "risk" ? "text-rose-500" : "text-slate-500"}`}
        />
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 max-w-sm">{description}</p>
    </div>
  );
}
