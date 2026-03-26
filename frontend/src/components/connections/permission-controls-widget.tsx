"use client";

import { useState } from "react";
import { ShieldAlert, CheckCircle2, ShieldOff, AlertCircle } from "lucide-react";

import { updatePermissionOverride, refreshResolvedPermissions } from "@/lib/api/connections";
import { buildPermissionViewModels } from "@/lib/permissions-view-model";
import { generatePermissionSummary } from "@/lib/permissions-summary";
import { PermissionEffect } from "@/types/connection";
import type { ResolvedPermissionsMap } from "@/types/connection";
import type { PermissionCategory, PermissionOverride } from "@/types/permissions";

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
  const [permissions, setPermissions] = useState<ResolvedPermissionsMap | null>(initialPermissions);
  const [overrides, setOverrides] = useState<PermissionOverride[]>(initialOverrides);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    Messaging: true, // open first by default
  });
  
  // Feedback States
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
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

  const handleOverrideChange = async (key: string, newEffect: PermissionEffect) => {
    // Reset feedback for this key
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setSuccesses((prev) => ({ ...prev, [key]: false }));
    setIsUpdating((prev) => ({ ...prev, [key]: true }));

    try {
      const updatedOverride = await updatePermissionOverride(connectionId, key, newEffect);
      
      // Update local override state
      setOverrides((prev) => {
        const filtered = prev.filter(o => o.key !== key);
        return [...filtered, updatedOverride];
      });

      // Fetch fresh resolved permissions to accurately compute effective effect
      const freshPermissions = await refreshResolvedPermissions(connectionId);
      setPermissions(freshPermissions);
      
      // Show success
      setSuccesses((prev) => ({ ...prev, [key]: true }));

      // Clear success feedback after 3 seconds
      setTimeout(() => {
        setSuccesses((prev) => ({ ...prev, [key]: false }));
      }, 3000);

    } catch (err) {
      console.error("Failed to update permission:", err);
      setErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Failed to save permission.",
      }));
    } finally {
      setIsUpdating((prev) => ({ ...prev, [key]: false }));
    }
  };

  const getSummaryIcon = (point: string) => {
    if (point.includes("blocked") || point.includes("restricted")) return <ShieldOff className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />;
    if (point.includes("approval") || point.includes("limited")) return <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />;
    return <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />;
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 px-6 py-6 bg-slate-50">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <ShieldAlert className="h-6 w-6 text-indigo-600" />
          Access and Permissions
        </h2>
        <p className="mt-1 text-lg text-slate-600 mb-6">
          Control exactly what this person or system can do. Changes take effect immediately.
        </p>

        {/* High Contrast Summary Banner */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 mb-4">
            Permission Summary
          </h3>
          <ul className="space-y-3">
            {summaryPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                {getSummaryIcon(point)}
                <span className="text-lg font-medium text-slate-800">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {(Object.keys(groupedViewModels) as PermissionCategory[]).map((category) => {
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
                  showSuccess={successes[vm.key] || false}
                  error={errors[vm.key]}
                  onChange={handleOverrideChange}
                />
              ))}
            </PermissionControlGroup>
          );
        })}
      </div>
    </section>
  );
}
