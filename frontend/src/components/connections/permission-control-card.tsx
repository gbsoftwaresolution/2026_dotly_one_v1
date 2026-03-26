import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { PermissionEffect } from "@/types/connection";
import { getPermissionEffectLabel } from "@/lib/labels";
import type { PermissionControlViewModel } from "@/lib/permissions-view-model";
import { OverrideStatusBadge } from "./override-status-badge";
import { PermissionExplainWidget } from "./permission-explain-widget";

interface PermissionControlCardProps {
  connectionId: string;
  vm: PermissionControlViewModel;
  isUpdating: boolean;
  isRefreshing?: boolean;
  showSuccess?: boolean;
  error?: string;
  onChange: (key: string, newEffect: PermissionEffect) => void;
}

const OPTIONS = [
  { effect: PermissionEffect.Allow, label: "Allow" },
  { effect: PermissionEffect.RequestApproval, label: "Ask" },
  { effect: PermissionEffect.AllowWithLimits, label: "Limit" },
  { effect: PermissionEffect.Deny, label: "Block" },
];

function getEffectColorBadge(effect: PermissionEffect): string {
  switch (effect) {
    case PermissionEffect.Allow:
      return "bg-emerald-100 text-emerald-800 ring-emerald-500/20";
    case PermissionEffect.RequestApproval:
      return "bg-amber-100 text-amber-800 ring-amber-500/20";
    case PermissionEffect.AllowWithLimits:
      return "bg-sky-100 text-sky-800 ring-sky-500/20";
    case PermissionEffect.Deny:
      return "bg-rose-100 text-rose-800 ring-rose-500/20";
    default:
      return "bg-slate-100 text-slate-800 ring-slate-500/20";
  }
}

export function PermissionControlCard({
  connectionId,
  vm,
  isUpdating,
  isRefreshing,
  showSuccess,
  error,
  onChange,
}: PermissionControlCardProps) {
  const selectedEffect = vm.overrideEffect ?? vm.effectiveEffect;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-6 shadow-sm bg-slate-50/50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h4 className="text-xl font-bold text-slate-900">{vm.label}</h4>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${getEffectColorBadge(vm.effectiveEffect)}`}
            >
              {getPermissionEffectLabel(vm.effectiveEffect)}
            </span>
          </div>
          <p className="mt-1.5 text-lg text-slate-600 leading-relaxed">
            {vm.description}
          </p>
          <OverrideStatusBadge vm={vm} />
        </div>
      </div>

      {/* Accessible Segmented Control */}
      <div className="mt-2 space-y-3">
        <fieldset disabled={isUpdating} className="group relative">
          <legend className="sr-only">Set permission for {vm.label}</legend>

          {isUpdating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-50/50 backdrop-blur-[1px]">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-xl bg-slate-200/50 p-1.5 ring-1 ring-inset ring-slate-200">
            {OPTIONS.map((opt) => {
              const isSelected = selectedEffect === opt.effect;

              return (
                <label
                  key={opt.effect}
                  className={`
                    relative flex cursor-pointer items-center justify-center rounded-lg px-4 py-3 text-base font-bold transition-all
                    focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2
                    ${
                      isSelected
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name={`permission-${vm.key}`}
                    value={opt.effect}
                    checked={isSelected}
                    onChange={() => onChange(vm.key, opt.effect)}
                    className="sr-only"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Feedback Messaging */}
        {showSuccess && !error && !isUpdating && (
          <div
            role="status"
            className="flex items-center gap-2 text-emerald-700 animate-in fade-in slide-in-from-top-1"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Changes saved securely.</span>
          </div>
        )}

        {error && !isUpdating && (
          <div
            role="alert"
            className="flex items-center gap-2 text-rose-700 animate-in fade-in slide-in-from-top-1"
          >
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Superseded Override Warning */}
        {vm.overrideEffect &&
          vm.overrideEffect !== vm.effectiveEffect &&
          !isUpdating &&
          !isRefreshing &&
          !error && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800 ring-1 ring-inset ring-amber-500/20">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <span className="font-semibold block">
                  System safeguards still apply
                </span>
                Your preference was saved as{" "}
                <strong>{getPermissionEffectLabel(vm.overrideEffect)}</strong>,
                but this action remains{" "}
                <strong>{getPermissionEffectLabel(vm.effectiveEffect)}</strong>{" "}
                due to active safety rules.
              </div>
            </div>
          )}
      </div>

      <PermissionExplainWidget
        connectionId={connectionId}
        vm={vm}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}
