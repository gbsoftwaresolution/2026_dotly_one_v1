"use client";

import { ChevronDown, UserCircle2 } from "lucide-react";

import { useIdentityContext } from "@/context/IdentityContext";
import { getIdentityTypeLabel } from "@/lib/labels";

export function IdentitySwitcher() {
  const { activeIdentity, availableIdentities, switchIdentity, isLoading } =
    useIdentityContext();

  if (!activeIdentity || availableIdentities.length === 0) {
    return null;
  }

  return (
    <label className="relative block min-w-[200px]">
      <div className="relative overflow-hidden rounded-full border border-black/5 bg-black/5 px-4 py-2 backdrop-blur-3xl transition-transform duration-300 active:scale-95 dark:border-white/10 dark:bg-white/5">
        <div className="pointer-events-none flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <UserCircle2
              className="h-5 w-5 text-foreground/70"
              strokeWidth={2}
            />
            <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">
              {activeIdentity.displayName}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 text-foreground/50" />
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
      </div>
    </label>
  );
}
