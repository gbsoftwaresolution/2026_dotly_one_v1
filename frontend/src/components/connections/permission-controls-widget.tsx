"use client";

import { useState } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  ShieldOff,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import {
  updatePermissionOverride,
  refreshResolvedPermissions,
} from "@/lib/api/connections";
import { buildPermissionViewModels } from "@/lib/permissions-view-model";
import { generatePermissionSummary } from "@/lib/permissions-summary";
import { PermissionEffect } from "@/types/connection";
import type { ResolvedPermissionsMap } from "@/types/connection";
import type {
  PermissionCategory,
  PermissionOverride,
} from "@/types/permissions";

import { PermissionControlGroup } from "./permission-control-group";
import { PermissionControlCard } from "./permission-control-card";

interface PermissionControlsWidgetProps {
  connectionId: string;
  initialPermissions: ResolvedPermissionsMap | null;
  initialOverrides: PermissionOverride[];
}

export function PermissionControlsWidget({
  connectionId,
  initialPermissions,
  initialOverrides,
}: PermissionControlsWidgetProps) {
  const [permissions, setPermissions] = useState<ResolvedPermissionsMap | null>(
    initialPermissions,
  );
  const [overrides, setOverrides] =
    useState<PermissionOverride[]>(initialOverrides);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    {
      Messaging: true, // open first by default
    },
  );

  // Feedback States
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successes, setSuccesses] = useState<Record<string, boolean>>({});

  const groupedViewModels = buildPermissionViewModels(permissions, overrides);
  const summaryPoints = generatePermissionSummary(groupedViewModels);

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleOverrideChange = async (
    key: string,
    newEffect: PermissionEffect,
  ) => {
    // Reset feedback for this key
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setSuccesses((prev) => ({ ...prev, [key]: false }));
    setSyncError(null);
    setIsUpdating((prev) => ({ ...prev, [key]: true }));
    setIsRefreshing(true);

    try {
      const updatedOverride = await updatePermissionOverride(
        connectionId,
        key,
        newEffect,
      );

      // Update local override state
      setOverrides((prev) => {
        const filtered = prev.filter((o) => o.key !== key);
        return [...filtered, updatedOverride];
      });

      // Show success for the save operation itself
      setSuccesses((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setSuccesses((prev) => ({ ...prev, [key]: false }));
      }, 3000);

      // Fetch fresh resolved permissions to accurately compute effective effect
      try {
        const freshPermissions = await refreshResolvedPermissions(connectionId);
        setPermissions(freshPermissions);
      } catch (refreshErr) {
        console.error("Failed to sync resolved permissions:", refreshErr);
        setSyncError(
          "Changes saved, but failed to sync the latest policy. Some controls may show outdated status.",
        );
      }
    } catch (err) {
      console.error("Failed to update permission:", err);
      setErrors((prev) => ({
        ...prev,
        [key]:
          err instanceof Error ? err.message : "Failed to save permission.",
      }));
    } finally {
      setIsUpdating((prev) => ({ ...prev, [key]: false }));
      // If no other keys are updating, clear the refreshing flag
      setIsRefreshing(false);
    }
  };

  const handleRetrySync = async () => {
    setSyncError(null);
    setIsRefreshing(true);
    try {
      const freshPermissions = await refreshResolvedPermissions(connectionId);
      setPermissions(freshPermissions);
    } catch (err) {
      console.error("Manual sync failed:", err);
      setSyncError("Failed to sync the latest policy. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSummaryIcon = (point: string) => {
    if (point.includes("blocked") || point.includes("restricted"))
      return <ShieldOff className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />;
    if (point.includes("approval") || point.includes("limited"))
      return <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />;
    return (
      <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
    );
  };

  return (
    <section className="rounded-3xl -slate-200 overflow-hidden rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1">
      <div className="border-b border-slate-200 px-6 py-6 bg-slate-50">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight tracking-tight text-slate-900">
          <ShieldAlert className="h-6 w-6 text-indigo-600" />
          Access and Permissions
        </h2>
        <p className="mt-1 text-lg text-slate-600 mb-6">
          Control exactly what this person or system can do. Changes take effect
          immediately.
        </p>

        {/* High Contrast Summary Banner */}
        <div className="rounded-2xl -slate-200 p-5 space-y-3 rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 mb-4">
            Permission Summary
          </h3>
          <ul className="space-y-3">
            {summaryPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                {getSummaryIcon(point)}
                <span className="text-lg font-medium text-slate-800">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="divide-y divide-slate-100 relative">
        {syncError && (
          <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2 text-rose-800 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" />
              <p>{syncError}</p>
            </div>
            <button
              onClick={handleRetrySync}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-rose-100 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Retry Sync
            </button>
          </div>
        )}

        {isRefreshing && !syncError && (
          <div className="absolute top-0 right-4 -mt-12 flex items-center gap-2 text-sm font-medium text-slate-500 animate-pulse">
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
            Syncing policy...
          </div>
        )}

        {(Object.keys(groupedViewModels) as PermissionCategory[]).map(
          (category) => {
            const viewModels = groupedViewModels[category];
            if (!viewModels || viewModels.length === 0) return null;

            const isOpen = openCategories[category];

            return (
              <PermissionControlGroup
                key={category}
                title={category}
                isOpen={isOpen}
                onToggle={() => toggleCategory(category)}
              >
                {viewModels.map((vm) => (
                  <PermissionControlCard
                    key={vm.key}
                    connectionId={connectionId}
                    vm={vm}
                    isUpdating={isUpdating[vm.key] || false}
                    isRefreshing={isRefreshing}
                    showSuccess={successes[vm.key] || false}
                    error={errors[vm.key]}
                    onChange={handleOverrideChange}
                  />
                ))}
              </PermissionControlGroup>
            );
          },
        )}
      </div>
    </section>
  );
}
