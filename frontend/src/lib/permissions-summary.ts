import { PermissionEffect } from "../types/connection";
import type { PermissionCategory } from "../types/permissions";
import type { PermissionControlViewModel } from "./permissions-view-model";

/**
 * Generates a plain-language summary of the current permissions state.
 * Designed to be senior-friendly and easy to understand at a glance.
 */
export function generatePermissionSummary(
  groupedViewModels: Record<PermissionCategory, PermissionControlViewModel[]>
): string[] {
  const summaries: string[] = [];
  const allControls = Object.values(groupedViewModels).flat();
  
  if (allControls.length === 0) {
    return ["No permission details available."];
  }

  let allowedCount = 0;
  let approvalCount = 0;
  let blockedCount = 0;

  for (const ctrl of allControls) {
    if (ctrl.effectiveEffect === PermissionEffect.Allow) allowedCount++;
    if (ctrl.effectiveEffect === PermissionEffect.RequestApproval) approvalCount++;
    if (ctrl.effectiveEffect === PermissionEffect.Deny) blockedCount++;
  }

  // General trends
  if (blockedCount === allControls.length) {
    summaries.push("All interactions are currently blocked.");
  } else if (allowedCount === allControls.length) {
    summaries.push("All interactions are allowed.");
  } else if (allowedCount > allControls.length / 2) {
    summaries.push("Most interactions are allowed.");
  } else if (blockedCount > allControls.length / 2) {
    summaries.push("Most interactions are blocked.");
  }

  if (approvalCount > 0) {
    summaries.push("Some actions will ask for your approval first.");
  }

  // Specific category callouts
  const protectedSharing = groupedViewModels["Protected Sharing"];
  if (
    protectedSharing?.some(
      (c) => c.effectiveEffect === PermissionEffect.Deny || c.effectiveEffect === PermissionEffect.AllowWithLimits
    )
  ) {
    summaries.push("Sharing of your protected data (like location or health) is restricted.");
  }

  const aiAssistance = groupedViewModels["AI Assistance"];
  if (
    aiAssistance?.some(
      (c) => c.effectiveEffect === PermissionEffect.AllowWithLimits || c.effectiveEffect === PermissionEffect.Deny
    )
  ) {
    summaries.push("AI agent assistance is limited or disabled.");
  }

  return summaries;
}
