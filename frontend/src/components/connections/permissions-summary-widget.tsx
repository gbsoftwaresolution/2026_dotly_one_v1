import { getPermissionEffectLabel, getPermissionKeyLabel } from "@/lib/labels";
import type { ResolvedPermissionsMap } from "@/types/connection";
import { PermissionEffect } from "@/types/connection";

interface PermissionsSummaryWidgetProps {
  permissions: ResolvedPermissionsMap | null;
}

function getEffectTone(effect: PermissionEffect): string {
  switch (effect) {
    case PermissionEffect.Allow:
      return "bg-emerald-100 text-emerald-800";
    case PermissionEffect.Deny:
      return "bg-rose-100 text-rose-800";
    case PermissionEffect.RequestApproval:
      return "bg-amber-100 text-amber-800";
    case PermissionEffect.AllowWithLimits:
    default:
      return "bg-sky-100 text-sky-800";
  }
}

export function PermissionsSummaryWidget({
  permissions,
}: PermissionsSummaryWidgetProps) {
  const items = permissions ? Object.entries(permissions.permissions) : [];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-2xl font-bold text-slate-900">
          Permissions Summary
        </h2>
        <p className="mt-1 text-base text-slate-600">
          Clear access rules for this connection.
        </p>
      </div>

      <div className="p-6">
        {items.length === 0 ? (
          <p className="text-lg text-slate-500">
            No permission details are available yet.
          </p>
        ) : (
          <div className="space-y-4">
            {items.map(([key, permission]) => (
              <div
                key={key}
                className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-lg font-medium text-slate-900">
                  {getPermissionKeyLabel(key)}
                </p>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getEffectTone(permission.finalEffect)}`}
                >
                  {getPermissionEffectLabel(permission.finalEffect)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
