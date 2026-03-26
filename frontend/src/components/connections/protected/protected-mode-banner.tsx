import { ShieldCheck, Info } from "lucide-react";
import { getProtectedRestrictions } from "@/lib/protected-mode";
import type { ResolvedPermissionsMap } from "@/types/connection";
import type { ResolvedPermissionsExplanation } from "@/types/permissions";

interface ProtectedModeBannerProps {
  permissions: ResolvedPermissionsMap | null;
  explanation?: ResolvedPermissionsExplanation | null;
}

export function ProtectedModeBanner({
  permissions,
  explanation,
}: ProtectedModeBannerProps) {
  const { isProtected, summaryText } = getProtectedRestrictions(
    permissions,
    explanation,
  );

  if (!isProtected) {
    return null;
  }

  return (
    <div className="flex flex-col rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-md sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <div className="mt-4 flex-1 sm:mt-0">
        <h3 className="text-lg font-bold tracking-tight text-white">
          Protected Mode On
        </h3>
        <p className="mt-1 text-sm text-slate-300 leading-relaxed max-w-2xl">
          {summaryText ??
            "This conversation uses stricter privacy controls. Exporting, resharing, and some AI actions may be limited. If a risky condition is detected, sensitive actions will be blocked."}
        </p>
      </div>
      <div className="mt-4 sm:mt-0 sm:shrink-0">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
        >
          <Info className="h-4 w-4" />
          Learn more
        </button>
      </div>
    </div>
  );
}
