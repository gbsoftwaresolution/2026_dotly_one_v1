import {
  ShieldAlert,
  Lock,
  Bot,
  Video,
  Share2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import {
  getProtectedRestrictions,
  ProtectedActionState,
} from "@/lib/protected-mode";
import { PermissionEffect } from "@/types/connection";
import type { ResolvedPermissionsMap } from "@/types/connection";
import { getPermissionEffectLabel } from "@/lib/labels";
import type { ResolvedPermissionsExplanation } from "@/types/permissions";

interface ProtectedRestrictionsPanelProps {
  permissions: ResolvedPermissionsMap | null;
  explanation?: ResolvedPermissionsExplanation | null;
}

export function ProtectedRestrictionsPanel({
  permissions,
  explanation,
}: ProtectedRestrictionsPanelProps) {
  const restrictions = getProtectedRestrictions(permissions, explanation);

  if (!restrictions.isProtected) {
    return null;
  }

  const getStatusIcon = (effect: PermissionEffect) => {
    switch (effect) {
      case PermissionEffect.Allow:
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case PermissionEffect.RequestApproval:
      case PermissionEffect.AllowWithLimits:
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case PermissionEffect.Deny:
        return <XCircle className="h-5 w-5 text-rose-500" />;
      default:
        return <HelpCircle className="h-5 w-5 text-slate-400" />;
    }
  };

  const getStatusColor = (effect: PermissionEffect) => {
    switch (effect) {
      case PermissionEffect.Allow:
        return "text-emerald-700 bg-emerald-50 ring-emerald-200";
      case PermissionEffect.RequestApproval:
      case PermissionEffect.AllowWithLimits:
        return "text-amber-700 bg-amber-50 ring-amber-200";
      case PermissionEffect.Deny:
        return "text-rose-700 bg-rose-50 ring-rose-200";
      default:
        return "text-slate-700 bg-slate-50 ring-slate-200";
    }
  };

  const renderRow = (
    icon: React.ReactNode,
    state: ProtectedActionState,
    description: string,
  ) => {
    return (
      <div className="flex items-start justify-between py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-slate-400">{icon}</div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {state.label}
            </p>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <div className="ml-4 flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${getStatusColor(state.effect)}`}
          >
            {getPermissionEffectLabel(state.effect)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-3xl -slate-200 overflow-hidden rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1">
      <div className="border-b border-slate-200 px-6 py-5 bg-slate-50">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <ShieldAlert className="h-5 w-5 text-slate-700" />
          Active Restrictions
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {restrictions.summaryText ||
            "Summary of current safety limits for this conversation."}
        </p>
      </div>

      <div className="px-6 divide-y divide-slate-100">
        {renderRow(
          <Share2 className="h-5 w-5" />,
          restrictions.sharing,
          "Access to sensitive identity details",
        )}
        {renderRow(
          <Lock className="h-5 w-5" />,
          restrictions.exports,
          "Sending data out of this chat",
        )}
        {renderRow(
          <Bot className="h-5 w-5" />,
          restrictions.ai,
          "AI delegation and summarization",
        )}
        {renderRow(
          <Video className="h-5 w-5" />,
          restrictions.calls,
          "Voice and video calling",
        )}
      </div>
    </section>
  );
}
