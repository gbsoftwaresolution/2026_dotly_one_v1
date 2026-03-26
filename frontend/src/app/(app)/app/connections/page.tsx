"use client";

import { useEffect, useMemo, useState } from "react";

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

export default function ConnectionsPage() {
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

  useEffect(() => {
    async function loadConnections() {
      if (!activeIdentity) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getIdentityConnections(activeIdentity.id);
        setConnections(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load your connections.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadConnections();
  }, [activeIdentity]);

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
        Choose an identity to view connections.
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
            See who this identity knows, how trusted each connection is, and
            what access they have.
          </p>
        </div>
        <IdentitySwitcher />
      </section>

      <IdentitySummaryWidget identity={activeIdentity} />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Filter connections</h2>
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
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-lg text-slate-600 shadow-sm">
          Loading connections...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-lg text-rose-800 shadow-sm">
          {error}
        </div>
      ) : filteredConnections.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            No connections found
          </h2>
          <p className="mt-2 text-lg text-slate-600">
            {connections.length === 0
              ? "This identity does not have any connections yet."
              : "Try changing the filters to see more connections."}
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
