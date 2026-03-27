"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";

import { ConnectionSummaryCard } from "@/components/connections/connection-summary-card";
import { IdentitySummaryWidget } from "@/components/identities/identity-summary-widget";
import { IdentitySwitcher } from "@/components/identities/identity-switcher";
import { useIdentityContext } from "@/context/IdentityContext";
import { getIdentityConnections } from "@/lib/api/identities";
import {
  getConnectionStatusLabel,
  getConnectionTypeLabel,
  getRelationshipTypeLabel,
  getTrustStateLabel,
} from "@/lib/labels";
import {
  ConnectionStatus,
  ConnectionType,
  RelationshipType,
  TrustState,
  type IdentityConnection,
} from "@/types/connection";

const ALL_FILTER = "all";

export function ConnectionsPageRoute() {
  const { activeIdentity } = useIdentityContext();
  const [connections, setConnections] = useState<IdentityConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    ConnectionStatus | typeof ALL_FILTER
  >(ALL_FILTER);
  const [typeFilter, setTypeFilter] = useState<
    ConnectionType | typeof ALL_FILTER
  >(ALL_FILTER);
  const [trustFilter, setTrustFilter] = useState<
    TrustState | typeof ALL_FILTER
  >(ALL_FILTER);
  const [relationshipFilter, setRelationshipFilter] = useState<
    RelationshipType | typeof ALL_FILTER
  >(ALL_FILTER);

  const loadConnections = useCallback(async () => {
    if (!activeIdentity) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getIdentityConnections(activeIdentity.id);
      setConnections(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load connections.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeIdentity]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const filteredConnections = useMemo(() => {
    return connections.filter((connection) => {
      if (statusFilter !== ALL_FILTER && connection.status !== statusFilter) {
        return false;
      }

      if (
        typeFilter !== ALL_FILTER &&
        connection.connectionType !== typeFilter
      ) {
        return false;
      }

      if (trustFilter !== ALL_FILTER && connection.trustState !== trustFilter) {
        return false;
      }

      if (
        relationshipFilter !== ALL_FILTER &&
        connection.relationshipType !== relationshipFilter
      ) {
        return false;
      }

      return true;
    });
  }, [connections, relationshipFilter, statusFilter, trustFilter, typeFilter]);

  if (!activeIdentity) {
    return (
      <p className="p-8 text-lg text-slate-600">
        Choose a Dotly identity to see the trust network around it.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-5">
      <section className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-3xl bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-4xl font-bold tracking-tight text-slate-950">
            Connections
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
            See which first exchanges became trusted relationships, how strong
            each connection feels, and where access still needs intention.
          </p>
        </div>
        <IdentitySwitcher />
      </section>

      <IdentitySummaryWidget identity={activeIdentity} />

      <section className="rounded-3xl -slate-200 p-5 rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1">
        <h2 className="text-xl font-bold text-slate-900">
          Curate the network view
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Status
            </span>
            <select
              aria-label="Filter by status"
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900"
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as ConnectionStatus | typeof ALL_FILTER,
                )
              }
              value={statusFilter}
            >
              <option value={ALL_FILTER}>All statuses</option>
              {Object.values(ConnectionStatus).map((status) => (
                <option key={status} value={status}>
                  {getConnectionStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Connection type
            </span>
            <select
              aria-label="Filter by connection type"
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900"
              onChange={(event) =>
                setTypeFilter(
                  event.target.value as ConnectionType | typeof ALL_FILTER,
                )
              }
              value={typeFilter}
            >
              <option value={ALL_FILTER}>All types</option>
              {Object.values(ConnectionType).map((type) => (
                <option key={type} value={type}>
                  {getConnectionTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Trust level
            </span>
            <select
              aria-label="Filter by trust state"
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900"
              onChange={(event) =>
                setTrustFilter(
                  event.target.value as TrustState | typeof ALL_FILTER,
                )
              }
              value={trustFilter}
            >
              <option value={ALL_FILTER}>All trust levels</option>
              {Object.values(TrustState).map((trustState) => (
                <option key={trustState} value={trustState}>
                  {getTrustStateLabel(trustState)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Relationship
            </span>
            <select
              aria-label="Filter by relationship type"
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900"
              onChange={(event) =>
                setRelationshipFilter(
                  event.target.value as RelationshipType | typeof ALL_FILTER,
                )
              }
              value={relationshipFilter}
            >
              <option value={ALL_FILTER}>All relationships</option>
              {Object.values(RelationshipType).map((relationshipType) => (
                <option key={relationshipType} value={relationshipType}>
                  {getRelationshipTypeLabel(relationshipType)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-24 w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-24 w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-24 w-full animate-pulse rounded-2xl bg-slate-200" />
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-rose-500" />
          <h2 className="mb-2 text-xl font-bold text-rose-900">
            Connections are temporarily out of view
          </h2>
          <p className="mb-6 text-rose-700">{error}</p>
          <button
            onClick={() => void loadConnections()}
            className="inline-flex items-center gap-2 rounded-[24px] bg-rose-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      ) : filteredConnections.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight tracking-tight text-slate-900">
            {connections.length === 0
              ? "No trusted relationships yet"
              : "No relationships match this view"}
          </h2>
          <p className="mt-2 text-lg text-slate-600">
            {connections.length === 0
              ? "The people who move from first exchange into your Dotly network will appear here."
              : "Try a broader lens to bring more of the network back into view."}
          </p>
        </div>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredConnections.map((connection) => (
            <ConnectionSummaryCard
              connection={connection}
              key={connection.id}
            />
          ))}
        </section>
      )}
    </div>
  );
}
