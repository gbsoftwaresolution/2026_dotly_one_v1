import { ReactNode, useState } from "react";
import { Lock, AlertCircle, Info } from "lucide-react";
import { PermissionEffect } from "@/types/connection";
import { getPermissionEffectLabel } from "@/lib/labels";

interface ProtectedActionStateProps {
  effect: PermissionEffect;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  reasonText?: string;
  children: ReactNode;
  "aria-label"?: string;
}

export function ProtectedActionState({
  effect,
  label,
  icon,
  onClick,
  reasonText,
  children,
  ...props
}: ProtectedActionStateProps) {
  const [showReason, setShowReason] = useState(false);

  const isBlocked = effect === PermissionEffect.Deny;
  const isLimited =
    effect === PermissionEffect.AllowWithLimits ||
    effect === PermissionEffect.RequestApproval;
  const isAllowed = effect === PermissionEffect.Allow;

  const defaultReason = isBlocked
    ? "Restricted because protected mode is on."
    : isLimited
      ? "Unavailable until protected mode changes."
      : "Allowed";

  const explanation = reasonText || defaultReason;

  if (isAllowed) {
    return <div onClick={onClick}>{children}</div>;
  }

  return (
    <div className="relative group">
      <div
        className={`relative ${isBlocked ? "opacity-60 grayscale-[0.5] cursor-not-allowed" : ""}`}
      >
        <div className="pointer-events-none" aria-disabled={isBlocked}>
          {children}
        </div>

        {/* Overlay block capture */}
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[1px] rounded-[24px] border border-slate-200 cursor-pointer"
          onClick={() => setShowReason(!showReason)}
          role="button"
          aria-label={`Action restricted: ${label}`}
          {...props}
        >
          {isBlocked ? (
            <Lock className="h-6 w-6 text-slate-700 rounded-full p-1 rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1" />
          ) : (
            <AlertCircle className="h-6 w-6 text-amber-600 rounded-full p-1 rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1" />
          )}
        </div>
      </div>

      {showReason && (
        <div className="absolute top-full left-0 z-20 mt-2 w-64 rounded-[24px] bg-slate-900 p-4 shadow-xl ring-1 ring-white/10 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">
                {isBlocked ? "Blocked for safety" : "Ask first"}
              </p>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                {explanation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
