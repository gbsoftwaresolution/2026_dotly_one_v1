"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { PrimaryButton } from "@/components/shared/primary-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { contactsApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { ContactRelationshipState } from "@/types/contact";

import { BlockUserButton } from "./block-user-button";

interface RelationshipActionsProps {
  relationshipId: string;
  initialState: ContactRelationshipState;
  isExpired: boolean;
  targetPersonaId: string;
  displayName: string;
}

function getStateBadge(state: ContactRelationshipState) {
  switch (state) {
    case "instant_access":
      return <StatusBadge label="Instant Access" tone="warning" />;
    case "expired":
      return <StatusBadge label="Expired" tone="neutral" />;
    case "approved":
    default:
      return <StatusBadge label="Approved" tone="success" />;
  }
}

export function RelationshipActions({
  relationshipId,
  initialState,
  isExpired: initialIsExpired,
  targetPersonaId,
  displayName,
}: RelationshipActionsProps) {
  const router = useRouter();
  const [state, setState] = useState<ContactRelationshipState>(initialState);
  const [isExpired, setIsExpired] = useState(initialIsExpired);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [expireError, setExpireError] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isExpiring, setIsExpiring] = useState(false);

  async function handleUpgrade() {
    setIsUpgrading(true);
    setUpgradeError(null);

    try {
      const result = await contactsApi.upgrade(relationshipId);
      setState(result.state);
      router.refresh();
    } catch (error) {
      setUpgradeError(
        error instanceof ApiError
          ? error.message
          : "Failed to upgrade. Please try again.",
      );
    } finally {
      setIsUpgrading(false);
    }
  }

  async function handleExpire() {
    setIsExpiring(true);
    setExpireError(null);

    try {
      const result = await contactsApi.expire(relationshipId);
      setState(result.state);
      setIsExpired(true);
      router.refresh();
    } catch (error) {
      setExpireError(
        error instanceof ApiError
          ? error.message
          : "Failed to expire. Please try again.",
      );
    } finally {
      setIsExpiring(false);
    }
  }

  const wasInstantAccess = initialState === "instant_access";
  const upgradedViaAction = wasInstantAccess && state === "approved";
  const expiredViaAction = wasInstantAccess && state === "expired";
  const showUpgrade = state === "instant_access" && !isExpired;
  const showExpire = state === "instant_access" && !isExpired;

  if (!upgradedViaAction && !expiredViaAction && !showUpgrade && !showExpire) {
    // Nothing interactive to show for stable approved or server-side expired
    return null;
  }

  return (
    <div className="space-y-3">
      <BlockUserButton personaId={targetPersonaId} displayName={displayName} />

      {/* Upgraded success confirmation */}
      {upgradedViaAction ? (
        <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50/80 px-4 py-3 dark:border-green-900 dark:bg-green-950/30">
          <div className="flex-1 space-y-0.5">
            <p className="font-sans text-sm font-semibold text-green-700 dark:text-green-300">
              Connection upgraded
            </p>
            <p className="font-sans text-xs text-green-700/80 dark:text-green-400/80">
              This contact is now permanently approved.
            </p>
          </div>
          {getStateBadge(state)}
        </div>
      ) : null}

      {/* Expired via action confirmation */}
      {expiredViaAction ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/30">
          <p className="font-sans text-sm font-semibold text-rose-700 dark:text-rose-300">
            Instant access manually ended
          </p>
          <p className="font-sans text-xs text-rose-700/80 dark:text-rose-400/80 mt-0.5">
            This relationship is now read-only.
          </p>
        </div>
      ) : null}

      {/* Action buttons */}
      {showUpgrade ? (
        <div className="space-y-2">
          <PrimaryButton
            onClick={() => void handleUpgrade()}
            disabled={isUpgrading || isExpiring}
            className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpgrading ? "Upgrading..." : "Upgrade to Approved"}
          </PrimaryButton>
          {upgradeError ? (
            <p className="font-sans text-xs text-rose-600 dark:text-rose-400 px-1">
              {upgradeError}
            </p>
          ) : null}
        </div>
      ) : null}

      {showExpire ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void handleExpire()}
            disabled={isExpiring || isUpgrading}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-transparent py-4 px-5 text-sm font-semibold text-foreground transition-all hover:bg-slate-50 hover:border-border active:scale-95 dark:hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExpiring ? "Expiring..." : "Expire Now"}
          </button>
          {expireError ? (
            <p className="font-sans text-xs text-rose-600 dark:text-rose-400 px-1">
              {expireError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
