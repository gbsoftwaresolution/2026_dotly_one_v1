import { Info } from "lucide-react";
import { getPermissionEffectLabel } from "@/lib/labels";
import type { PermissionControlViewModel } from "@/lib/permissions-view-model";

interface OverrideStatusBadgeProps {
  vm: PermissionControlViewModel;
}

export function OverrideStatusBadge({ vm }: OverrideStatusBadgeProps) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          {vm.isOverridden ? (
            <span className="text-indigo-600">Custom override active</span>
          ) : (
            <span>Using system default</span>
          )}
        </p>
      </div>

      {vm.hasGuardrailIntervention && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 border border-amber-200">
          <Info className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <p className="text-sm text-amber-900 leading-relaxed">
            System safeguards prevent fully allowing this setting. Still
            restricted to{" "}
            <strong className="font-bold">
              {getPermissionEffectLabel(vm.effectiveEffect)}
            </strong>{" "}
            for safety reasons.
          </p>
        </div>
      )}
    </div>
  );
}
