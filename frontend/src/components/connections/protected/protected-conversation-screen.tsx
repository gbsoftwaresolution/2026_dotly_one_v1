"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Video,
  FileText,
  Forward,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";

import { ProtectedModeBanner } from "@/components/connections/protected/protected-mode-banner";
import { ProtectedRestrictionsPanel } from "@/components/connections/protected/protected-restrictions-panel";
import { ProtectedActionState } from "@/components/connections/protected/protected-action-state";
import {
  explainResolvedPermissions,
  getConnection,
  getResolvedPermissions,
} from "@/lib/api/connections";
import { getProtectedRestrictions } from "@/lib/protected-mode";
import type {
  IdentityConnection,
  ResolvedPermissionsMap,
} from "@/types/connection";
import type { ResolvedPermissionsExplanation } from "@/types/permissions";

interface ProtectedConversationScreenProps {
  connectionId: string;
}

export function ProtectedConversationScreen({
  connectionId,
}: ProtectedConversationScreenProps) {
  const [connection, setConnection] = useState<IdentityConnection | null>(null);
  const [permissions, setPermissions] = useState<ResolvedPermissionsMap | null>(
    null,
  );
  const [permissionsExplanation, setPermissionsExplanation] =
    useState<ResolvedPermissionsExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cancelled = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const [conn, perms, explanation] = await Promise.all([
          getConnection(connectionId),
          getResolvedPermissions(connectionId),
          explainResolvedPermissions(connectionId),
        ]);

        if (cancelled) return;
        setConnection(conn);
        setPermissions(perms);
        setPermissionsExplanation(explanation);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load conversation.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    },
    [connectionId],
  );

  useEffect(() => {
    let cancelled = false;
    void load(cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-5">
        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-[72px] w-full bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-[400px] w-full bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !connection) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-5">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-rose-500 mb-4" />
          <h2 className="text-xl font-bold text-rose-900 mb-2">
            Failed to load environment
          </h2>
          <p className="text-rose-700 mb-6">
            {error || "Connection not found"}
          </p>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const restrictions = getProtectedRestrictions(
    permissions,
    permissionsExplanation,
  );

  const getExplanationText = (key: string, fallback: string) => {
    const match = permissionsExplanation?.permissions?.find(
      (permission) => permission.key === key,
    );

    return match?.explanationText || fallback;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-5">
      <Link
        className="inline-flex items-center gap-2 text-base font-semibold text-sky-700 hover:text-sky-800"
        href={`/app/connections/${connectionId}`}
      >
        <ArrowLeft className="h-5 w-5" />
        Back to profile
      </Link>

      <ProtectedModeBanner
        permissions={permissions}
        explanation={permissionsExplanation}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Chat with {connection.targetIdentity?.displayName || "Unknown"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {restrictions.isProtected
            ? "Protected conversation"
            : "Standard conversation"}
        </p>

        <div className="mt-8 space-y-4">
          <div className="flex gap-4 rounded-2xl bg-slate-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-600">
              {connection.targetIdentity?.displayName?.charAt(0) || "?"}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {connection.targetIdentity?.displayName}
              </p>
              <p className="mt-1 text-slate-700">
                Hi there, here is the secret document you requested.
              </p>
              <div className="mt-3 flex gap-2">
                <ProtectedActionState
                  label="Forward message"
                  effect={restrictions.exports.effect}
                  reasonText={getExplanationText(
                    restrictions.exports.key,
                    "Restricted because protected mode is on.",
                  )}
                >
                  <button className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
                    <Forward className="h-3 w-3" />
                    Forward
                  </button>
                </ProtectedActionState>

                <ProtectedActionState
                  label="Export document"
                  effect={restrictions.exports.effect}
                  reasonText={getExplanationText(
                    restrictions.exports.key,
                    "Unavailable until protected mode changes.",
                  )}
                >
                  <button className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
                    <FileText className="h-3 w-3" />
                    Save Attachment
                  </button>
                </ProtectedActionState>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3 border-t border-slate-100 pt-6">
          <button className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-left text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            Type a message...
          </button>

          <ProtectedActionState
            label="Video Call"
            effect={restrictions.calls.effect}
            reasonText={getExplanationText(
              restrictions.calls.key,
              "Unavailable until protected mode changes.",
            )}
          >
            <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
              <Video className="h-5 w-5" />
            </button>
          </ProtectedActionState>

          <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      <ProtectedRestrictionsPanel
        permissions={permissions}
        explanation={permissionsExplanation}
      />
    </div>
  );
}
