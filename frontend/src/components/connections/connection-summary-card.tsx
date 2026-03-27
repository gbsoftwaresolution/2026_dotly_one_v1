import Link from "next/link";
import { User } from "lucide-react";

import {
  getConnectionStatusLabel,
  getConnectionTypeLabel,
  getRelationshipTypeLabel,
  getTrustStateColor,
  getTrustStateLabel,
} from "@/lib/labels";
import { routes } from "@/lib/constants/routes";
import type { IdentityConnection } from "@/types/connection";

interface ConnectionSummaryCardProps {
  connection: IdentityConnection;
}

export function ConnectionSummaryCard({
  connection,
}: ConnectionSummaryCardProps) {
  const targetIdentity = connection.targetIdentity;
  const targetName = targetIdentity?.displayName ?? "Unknown contact";
  const initial = targetName.charAt(0).toUpperCase();

  return (
    <Link
      className="block rounded-3xl -slate-200 p-5 transition hover:-translate-y-0.5 hover:-sky-300 hover:-md rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1"
      href={routes.app.connectionDetail(connection.id)}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-lg font-bold text-sky-700">
          {initial || <User className="h-6 w-6" />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-semibold tracking-tight tracking-tight text-slate-900">
            {targetName}
          </p>
          <p className="mt-1 truncate text-base text-slate-600">
            {targetIdentity?.handle
              ? `@${targetIdentity.handle}`
              : connection.targetIdentityId}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${getTrustStateColor(connection.trustState)}`}
            >
              {getTrustStateLabel(connection.trustState)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              {getConnectionTypeLabel(connection.connectionType)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              {getRelationshipTypeLabel(connection.relationshipType)}
            </span>
          </div>

          <p className="mt-4 text-sm font-medium text-slate-500">
            Status: {getConnectionStatusLabel(connection.status)}
          </p>
        </div>
      </div>
    </Link>
  );
}
