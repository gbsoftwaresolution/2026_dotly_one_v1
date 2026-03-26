import { PermissionEffect } from "../../common/enums/permission-effect.enum";

import { CONTENT_ACTION_KEYS } from "./content-permission-mapping";
import type {
  ContentAccessRuleValue,
  ContentActionKey,
  ContentConnectionPermissionSubset,
  ContentPermissionResolution,
  ContentPermissionSummary,
  ContentPolicyTrace,
  ContentSummary,
} from "./identity.types";

export function applyContentAccessRule(
  basePermissions: ContentConnectionPermissionSubset,
  contentRule: ContentAccessRuleValue | null,
  options?: {
    contentId?: string;
    targetIdentityId?: string;
    currentViewCount?: number;
    now?: Date;
  },
): {
  effectiveContentPermissions: Record<
    ContentActionKey,
    ContentPermissionResolution
  >;
  contentTrace: ContentPolicyTrace;
  restrictionSummary: ContentPermissionSummary;
  contentSummary: ContentSummary;
} {
  const now = options?.now ?? new Date();
  const currentViewCount = options?.currentViewCount ?? 0;
  const expired =
    contentRule?.expiryAt !== null &&
    contentRule?.expiryAt !== undefined &&
    contentRule.expiryAt.getTime() <= now.getTime();
  const viewLimitReached =
    contentRule?.viewLimit !== null &&
    contentRule?.viewLimit !== undefined &&
    currentViewCount >= contentRule.viewLimit;
  const effectiveContentPermissions = {} as Record<
    ContentActionKey,
    ContentPermissionResolution
  >;
  const contentTrace = {} as ContentPolicyTrace;
  const blockedActions: ContentActionKey[] = [];
  const restrictionReasons = new Set<
    ContentPermissionSummary["reasons"][number]
  >();

  for (const actionKey of CONTENT_ACTION_KEYS) {
    const basePermission = basePermissions[actionKey];

    if (basePermission.effect === PermissionEffect.Deny) {
      effectiveContentPermissions[actionKey] = {
        effect: PermissionEffect.Deny,
      };
      contentTrace[actionKey] = {
        basePermissionKey: basePermission.basePermissionKey,
        baseEffect: basePermission.effect,
        contentRulePresent: contentRule !== null,
        contentRuleDecision: "BASE_DENY",
        finalEffect: PermissionEffect.Deny,
        reasonCode: "CONTENT_BASE_DENY_PRESERVED",
      };
      blockedActions.push(actionKey);
      restrictionReasons.add("CONTENT_BASE_DENY_PRESERVED");
      continue;
    }

    const restriction = deriveContentRestriction(actionKey, contentRule, {
      baseEffect: basePermission.effect,
      expired,
      viewLimitReached,
    });

    effectiveContentPermissions[actionKey] = {
      effect: restriction.effect,
    };
    contentTrace[actionKey] = {
      basePermissionKey: basePermission.basePermissionKey,
      baseEffect: basePermission.effect,
      contentRulePresent: contentRule !== null,
      contentRuleDecision: restriction.decision,
      finalEffect: restriction.effect,
      reasonCode: restriction.reasonCode,
    };

    if (restriction.effect === PermissionEffect.Deny) {
      blockedActions.push(actionKey);
      restrictionReasons.add(restriction.reasonCode);
    }
  }

  return {
    effectiveContentPermissions,
    contentTrace,
    restrictionSummary: {
      rulePresent: contentRule !== null,
      expired,
      viewLimitReached,
      blockedActions,
      reasons: [...restrictionReasons],
    },
    contentSummary: {
      contentId: contentRule?.contentId ?? options?.contentId ?? "",
      targetIdentityId:
        contentRule?.targetIdentityId ?? options?.targetIdentityId ?? "",
      rulePresent: contentRule !== null,
      expiryAt: contentRule?.expiryAt ?? null,
      viewLimit: contentRule?.viewLimit ?? null,
      currentViewCount,
      watermarkMode: contentRule?.watermarkMode ?? null,
      aiAccessAllowed: contentRule?.aiAccessAllowed ?? null,
    },
  };
}

function deriveContentRestriction(
  actionKey: ContentActionKey,
  contentRule: ContentAccessRuleValue | null,
  context: {
    baseEffect: PermissionEffect;
    expired: boolean;
    viewLimitReached: boolean;
  },
): {
  effect: PermissionEffect;
  decision:
    | "INHERIT"
    | "ALLOW"
    | "DENY"
    | "EXPIRED"
    | "VIEW_LIMIT_REACHED"
    | "SCREENSHOT_DENY"
    | "RECORD_DENY"
    | "AI_DENY";
  reasonCode:
    | "CONTENT_INHERITED"
    | "CONTENT_RULE_APPLIED"
    | "CONTENT_EXPIRED"
    | "CONTENT_VIEW_LIMIT_REACHED"
    | "CONTENT_SCREENSHOT_DENIED"
    | "CONTENT_RECORD_DENIED"
    | "CONTENT_AI_DENIED"
    | "CONTENT_NO_RULE";
} {
  if (contentRule === null) {
    return {
      effect: context.baseEffect,
      decision: "INHERIT",
      reasonCode: "CONTENT_NO_RULE",
    };
  }

  if (
    context.expired &&
    (actionKey === "content.view" ||
      actionKey === "content.download" ||
      actionKey === "content.forward" ||
      actionKey === "content.export")
  ) {
    return {
      effect: PermissionEffect.Deny,
      decision: "EXPIRED",
      reasonCode: "CONTENT_EXPIRED",
    };
  }

  if (actionKey === "content.view" && context.viewLimitReached) {
    return {
      effect: PermissionEffect.Deny,
      decision: "VIEW_LIMIT_REACHED",
      reasonCode: "CONTENT_VIEW_LIMIT_REACHED",
    };
  }

  if (
    actionKey === "content.screenshot" &&
    contentRule.screenshotPolicy === "DENY"
  ) {
    return {
      effect: PermissionEffect.Deny,
      decision: "SCREENSHOT_DENY",
      reasonCode: "CONTENT_SCREENSHOT_DENIED",
    };
  }

  if (actionKey === "content.record" && contentRule.recordPolicy === "DENY") {
    return {
      effect: PermissionEffect.Deny,
      decision: "RECORD_DENY",
      reasonCode: "CONTENT_RECORD_DENIED",
    };
  }

  if (
    actionKey === "content.ai_access" &&
    contentRule.aiAccessAllowed === false
  ) {
    return {
      effect: PermissionEffect.Deny,
      decision: "AI_DENY",
      reasonCode: "CONTENT_AI_DENIED",
    };
  }

  if (
    (actionKey === "content.view" && contentRule.canView === false) ||
    (actionKey === "content.download" && contentRule.canDownload === false) ||
    (actionKey === "content.forward" && contentRule.canForward === false) ||
    (actionKey === "content.export" && contentRule.canExport === false)
  ) {
    return {
      effect: PermissionEffect.Deny,
      decision: "DENY",
      reasonCode: "CONTENT_RULE_APPLIED",
    };
  }

  return {
    effect: context.baseEffect,
    decision:
      contentRule.screenshotPolicy === "ALLOW" ||
      contentRule.recordPolicy === "ALLOW"
        ? "ALLOW"
        : "INHERIT",
    reasonCode: "CONTENT_INHERITED",
  };
}
