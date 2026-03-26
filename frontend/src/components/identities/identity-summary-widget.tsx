"use client";

import { BadgeCheck, UserCircle2 } from "lucide-react";

import type { Identity } from "@/types/identity";
import { getIdentityTypeLabel } from "@/lib/labels";

interface IdentitySummaryWidgetProps {
  identity: Identity;
}

export function IdentitySummaryWidget({
  identity,
}: IdentitySummaryWidgetProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
          <UserCircle2 className="h-10 w-10" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Viewing as
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            {identity.displayName}
          </h2>
          <p className="mt-1 text-base text-slate-600">
            {getIdentityTypeLabel(identity.identityType)}
            {identity.handle ? ` - @${identity.handle}` : ""}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
            <BadgeCheck className="h-4 w-4" />
            {identity.verificationLevel.replace(/_/g, " ")}
          </div>
        </div>
      </div>
    </section>
  );
}
