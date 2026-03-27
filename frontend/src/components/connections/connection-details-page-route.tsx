"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";

import { PermissionControlsWidget } from "@/components/connections/permission-controls-widget";
import {
  getConnection,
  getResolvedPermissions,
  listPermissionOverrides,
} from "@/lib/api/connections";
import { routes } from "@/lib/constants/routes";
import { getOrCreateConversationForConnection } from "@/lib/conversation-routing";
import {
  getConnectionStatusLabel,
  getConnectionTypeLabel,
  getRelationshipTypeLabel,
  getTrustStateColor,
  getTrustStateLabel,
} from "@/lib/labels";
import type {
  IdentityConnection,
  ResolvedPermissionsMap,
} from "@/types/connection";
import type { PermissionOverride } from "@/types/permissions";

interface ConnectionDetailsPageRouteProps {
  connectionId: string;
}

export function ConnectionDetailsPageRoute({
  connectionId,
}: ConnectionDetailsPageRouteProps) {
  const router = useRouter();
  const [connection, setConnection] = useState<IdentityConnection | null>(null);
  const [permissions, setPermissions] = useState<ResolvedPermissionsMap | null>(
    null,
  );
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningConversation, setIsOpeningConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [connectionData, permissionData, overridesData] = await Promise.all(
        [
          getConnection(connectionId),
          getResolvedPermissions(connectionId),
          listPermissionOverrides(connectionId),
        ],
      );

      setConnection(connectionData);
      setPermissions(permissionData);
      setOverrides(overridesData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "We couldn't load this connection.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-5 animate-pulse">
        <div className="h-48 w-full rounded-3xl bg-slate-200" />
        <div className="h-40 w-full rounded-3xl bg-slate-200" />
        <div className="h-96 w-full rounded-3xl bg-slate-200" />
      </div>
    );
  }

  if (error || !connection) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-5">
        <Link
          className="inline-flex items-center gap-2 text-base font-semibold text-sky-700 transition-colors hover:text-sky-800"
          href={routes.app.connections}
        >
          <ArrowLeft className="h-5 w-5" />
          Back to connections
        </Link>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm transition-shadow duration-200">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-rose-500" />
          <h2 className="mb-2 text-xl font-bold text-rose-900">
            We couldn&apos;t load this connection
          </h2>
          <p className="mb-6 text-rose-700">
            {error || "This connection is not available right now."}
          </p>
          <button
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const targetIdentity = connection.targetIdentity;

  async function handleOpenConversation() {
    if (!connection || isOpeningConversation) {
      return;
    }

    const activeConnection = connection;

    setIsOpeningConversation(true);
    setError(null);

    try {
      const conversation = await getOrCreateConversationForConnection({
        connectionId: activeConnection.id,
        sourceIdentityId: activeConnection.sourceIdentityId,
        targetIdentityId: activeConnection.targetIdentityId,
        createdByIdentityId: activeConnection.createdByIdentityId,
        connectionType: activeConnection.connectionType,
        relationshipType: activeConnection.relationshipType,
      });

      router.push(routes.app.conversationDetail(conversation.conversationId));
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "We couldn't open this conversation.",
      );
      setIsOpeningConversation(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-5">
      <div className="space-y-5 rounded-3xl bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6 shadow-sm ring-1 ring-slate-200">
        <Link
          className="inline-flex items-center gap-2 text-base font-semibold text-sky-700 transition-colors hover:text-sky-800"
          href={routes.app.connections}
        >
          <ArrowLeft className="h-5 w-5" />
          Back to connections
        </Link>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Connection overview
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950">
            {targetIdentity?.displayName ?? "Unknown contact"}
          </h1>
          <div className="mt-2 flex items-center gap-4">
            <p className="text-lg text-slate-600">
              {targetIdentity?.handle
                ? `@${targetIdentity.handle}`
                : connection.targetIdentityId}
            </p>
            <button
              type="button"
              onClick={() => void handleOpenConversation()}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              {isOpeningConversation ? "Opening..." : "Open conversation"}
            </button>
          </div>
          {connection.note ? (
            <p className="mt-4 max-w-3xl text-lg text-slate-700">
              {connection.note}
            </p>
          ) : null}
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <ShieldCheck className="h-6 w-6 text-sky-700" />
            Status and privacy
          </h2>
        </div>

        <div className="grid gap-5 px-6 py-6 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Status
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {getConnectionStatusLabel(connection.status)}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Trust level
            </p>
            <span
              className={`mt-2 inline-flex rounded-full px-4 py-1.5 text-base font-semibold ${getTrustStateColor(connection.trustState)}`}
            >
              {getTrustStateLabel(connection.trustState)}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Connection type
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {getConnectionTypeLabel(connection.connectionType)}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Relationship
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {getRelationshipTypeLabel(connection.relationshipType)}
            </p>
          </div>
        </div>
      </section>

      <PermissionControlsWidget
        connectionId={connectionId}
        initialPermissions={permissions}
        initialOverrides={overrides}
      />
    </div>
  );
}
