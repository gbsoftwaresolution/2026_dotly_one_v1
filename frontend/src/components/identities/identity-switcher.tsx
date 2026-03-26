"use client";

import { ChevronDown, UserCircle2 } from "lucide-react";

import { useIdentityContext } from "@/context/IdentityContext";
import { getIdentityTypeLabel } from "@/lib/labels";

export function IdentitySwitcher() {
  const { activeIdentity, availableIdentities, switchIdentity, isLoading } =
    useIdentityContext();

  if (!activeIdentity) {
    return null;
  }

  return (
    <label className="relative block min-w-[280px]">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        Active identity
      </span>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="pointer-events-none flex items-center gap-3 px-4 py-3 pr-12">
          <UserCircle2 className="h-9 w-9 text-sky-600" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">
              {activeIdentity.displayName}
            </p>
            <p className="truncate text-sm text-slate-600">
              {getIdentityTypeLabel(activeIdentity.identityType)}
              {activeIdentity.handle ? ` - @${activeIdentity.handle}` : ""}
            </p>
          </div>
        </div>

        <select
          aria-label="Switch identity"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          disabled={isLoading}
          onChange={(event) => switchIdentity(event.target.value)}
          value={activeIdentity.id}
        >
          {availableIdentities.map((identity) => (
            <option key={identity.id} value={identity.id}>
              {identity.displayName}
            </option>
          ))}
        </select>

        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
      </div>
    </label>
  );
}
