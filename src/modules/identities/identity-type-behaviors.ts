import { IdentityType } from "../../common/enums/identity-type.enum";
import { PermissionEffect } from "../../common/enums/permission-effect.enum";

import type { PermissionTemplateValue } from "./identity.types";
import { PERMISSION_KEYS, type PermissionKey } from "./permission-keys";

export type IdentityBehaviorReasonCode =
  | "IDENTITY_BEHAVIOR_OK"
  | "IDENTITY_BEHAVIOR_BLOCKED"
  | "IDENTITY_BEHAVIOR_REQUIRES_BUSINESS_CONTEXT"
  | "IDENTITY_BEHAVIOR_REQUIRES_PRIVATE_PATTERN"
  | "IDENTITY_BEHAVIOR_EXPORT_RESTRICTED"
  | "IDENTITY_BEHAVIOR_RESHARE_RESTRICTED"
  | "IDENTITY_BEHAVIOR_SCHEDULE_PREFERRED";

export interface IdentityBehaviorRestrictionFlags {
  prefersProtectedConversation: boolean;
  allowsBusinessConversation: boolean;
  businessConversationAllowed: boolean;
  restrictsExport: boolean;
  exportRestricted: boolean;
  restrictsReshare: boolean;
  reshareRestricted: boolean;
  schedulingPreferredForCalls: boolean;
  schedulingBiasForCalls: boolean;
  restrictsDirectVideo: boolean;
}

export interface IdentityTypeBehaviorDefinition {
  identityType: IdentityType;
  permissionAdjustments: Partial<
    Record<PermissionKey, PermissionTemplateValue>
  >;
  allowsProtectedConversation: boolean;
  prefersProtectedConversation: boolean;
  allowsBusinessConversation: boolean;
  restrictsExport: boolean;
  restrictsReshare: boolean;
  schedulingPreferredForCalls: boolean;
  restrictsDirectVideo: boolean;
}

export interface IdentityTypePairBehaviorDefinition {
  sourceIdentityType: IdentityType;
  targetIdentityType: IdentityType | "*";
  permissionAdjustments: Partial<
    Record<PermissionKey, PermissionTemplateValue>
  >;
  allowsBusinessConversation?: boolean;
  allowsProtectedConversation?: boolean;
  prefersProtectedConversation?: boolean;
  restrictsExport?: boolean;
  restrictsReshare?: boolean;
  schedulingPreferredForCalls?: boolean;
  restrictsDirectVideo?: boolean;
  reasonCodes: IdentityBehaviorReasonCode[];
}

export interface IdentityTypeBehaviorSummary {
  sourceIdentityType: IdentityType;
  targetIdentityType: IdentityType | null;
  restrictionFlags: IdentityBehaviorRestrictionFlags;
  sourceAppliedKeys: PermissionKey[];
  pairAppliedKeys: PermissionKey[];
  reasonCodes: IdentityBehaviorReasonCode[];
}

export const IDENTITY_TYPE_BEHAVIOR_DEFINITIONS: Record<
  IdentityType,
  IdentityTypeBehaviorDefinition
> = {
  [IdentityType.Personal]: {
    identityType: IdentityType.Personal,
    permissionAdjustments: {},
    allowsProtectedConversation: true,
    prefersProtectedConversation: false,
    allowsBusinessConversation: false,
    restrictsExport: false,
    restrictsReshare: false,
    schedulingPreferredForCalls: false,
    restrictsDirectVideo: false,
  },
  [IdentityType.Professional]: {
    identityType: IdentityType.Professional,
    permissionAdjustments: {
      [PERMISSION_KEYS.actions.bookingRequestCreate]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.actions.supportTicketCreate]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.ai.summaryUse]: {
        effect: PermissionEffect.AllowWithLimits,
        limits: {
          maxUses: 10,
        },
      },
      [PERMISSION_KEYS.ai.replyUse]: {
        effect: PermissionEffect.AllowWithLimits,
        limits: {
          maxUses: 10,
        },
      },
    },
    allowsProtectedConversation: true,
    prefersProtectedConversation: false,
    allowsBusinessConversation: true,
    restrictsExport: false,
    restrictsReshare: false,
    schedulingPreferredForCalls: true,
    restrictsDirectVideo: false,
  },
  [IdentityType.Business]: {
    identityType: IdentityType.Business,
    permissionAdjustments: {
      [PERMISSION_KEYS.actions.bookingRequestCreate]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.actions.paymentRequestCreate]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.actions.invoiceIssue]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.actions.supportTicketCreate]: {
        effect: PermissionEffect.Allow,
      },
    },
    allowsProtectedConversation: false,
    prefersProtectedConversation: false,
    allowsBusinessConversation: true,
    restrictsExport: false,
    restrictsReshare: false,
    schedulingPreferredForCalls: false,
    restrictsDirectVideo: false,
  },
  [IdentityType.Couple]: {
    identityType: IdentityType.Couple,
    permissionAdjustments: {
      [PERMISSION_KEYS.mediaPrivacy.export]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.vault.itemReshare]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.profile.phoneView]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.profile.emailView]: {
        effect: PermissionEffect.Deny,
      },
    },
    allowsProtectedConversation: true,
    prefersProtectedConversation: true,
    allowsBusinessConversation: false,
    restrictsExport: true,
    restrictsReshare: true,
    schedulingPreferredForCalls: false,
    restrictsDirectVideo: true,
  },
  [IdentityType.Family]: {
    identityType: IdentityType.Family,
    permissionAdjustments: {
      [PERMISSION_KEYS.vault.itemView]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.vault.itemDownload]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.profile.basicView]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.vault.itemReshare]: {
        effect: PermissionEffect.AllowWithLimits,
        limits: {
          maxUses: 1,
        },
      },
      [PERMISSION_KEYS.mediaPrivacy.export]: {
        effect: PermissionEffect.AllowWithLimits,
        limits: {
          maxUses: 1,
        },
      },
    },
    allowsProtectedConversation: true,
    prefersProtectedConversation: true,
    allowsBusinessConversation: false,
    restrictsExport: true,
    restrictsReshare: true,
    schedulingPreferredForCalls: false,
    restrictsDirectVideo: false,
  },
};

export const IDENTITY_TYPE_PAIR_BEHAVIOR_DEFINITIONS: readonly IdentityTypePairBehaviorDefinition[] =
  [
    {
      sourceIdentityType: IdentityType.Couple,
      targetIdentityType: "*",
      permissionAdjustments: {
        [PERMISSION_KEYS.mediaPrivacy.export]: {
          effect: PermissionEffect.Deny,
        },
        [PERMISSION_KEYS.vault.itemReshare]: {
          effect: PermissionEffect.Deny,
        },
      },
      restrictsExport: true,
      restrictsReshare: true,
      prefersProtectedConversation: true,
      reasonCodes: [
        "IDENTITY_BEHAVIOR_REQUIRES_PRIVATE_PATTERN",
        "IDENTITY_BEHAVIOR_EXPORT_RESTRICTED",
        "IDENTITY_BEHAVIOR_RESHARE_RESTRICTED",
      ],
    },
    {
      sourceIdentityType: IdentityType.Business,
      targetIdentityType: IdentityType.Business,
      permissionAdjustments: {
        [PERMISSION_KEYS.actions.bookingRequestCreate]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.actions.paymentRequestCreate]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.actions.invoiceIssue]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.actions.supportTicketCreate]: {
          effect: PermissionEffect.Allow,
        },
      },
      allowsBusinessConversation: true,
      reasonCodes: ["IDENTITY_BEHAVIOR_OK"],
    },
    {
      sourceIdentityType: IdentityType.Family,
      targetIdentityType: IdentityType.Family,
      permissionAdjustments: {
        [PERMISSION_KEYS.vault.itemView]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.vault.itemDownload]: {
          effect: PermissionEffect.Allow,
        },
      },
      allowsProtectedConversation: true,
      prefersProtectedConversation: true,
      reasonCodes: ["IDENTITY_BEHAVIOR_OK"],
    },
    {
      sourceIdentityType: IdentityType.Professional,
      targetIdentityType: IdentityType.Business,
      permissionAdjustments: {
        [PERMISSION_KEYS.actions.bookingRequestCreate]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.actions.supportTicketCreate]: {
          effect: PermissionEffect.Allow,
        },
      },
      allowsBusinessConversation: true,
      schedulingPreferredForCalls: true,
      reasonCodes: ["IDENTITY_BEHAVIOR_SCHEDULE_PREFERRED"],
    },
    {
      sourceIdentityType: IdentityType.Couple,
      targetIdentityType: IdentityType.Personal,
      permissionAdjustments: {
        [PERMISSION_KEYS.mediaPrivacy.export]: {
          effect: PermissionEffect.Deny,
        },
        [PERMISSION_KEYS.vault.itemReshare]: {
          effect: PermissionEffect.Deny,
        },
      },
      allowsProtectedConversation: true,
      prefersProtectedConversation: true,
      restrictsExport: true,
      restrictsReshare: true,
      reasonCodes: [
        "IDENTITY_BEHAVIOR_REQUIRES_PRIVATE_PATTERN",
        "IDENTITY_BEHAVIOR_EXPORT_RESTRICTED",
      ],
    },
  ] as const;

export function getIdentityTypeBehavior(
  sourceIdentityType: IdentityType,
  targetIdentityType?: IdentityType | null,
): {
  sourceBehavior: IdentityTypeBehaviorDefinition;
  pairBehavior: IdentityTypePairBehaviorDefinition | null;
  summary: IdentityTypeBehaviorSummary;
} {
  const sourceBehavior = IDENTITY_TYPE_BEHAVIOR_DEFINITIONS[sourceIdentityType];
  const pairBehavior =
    targetIdentityType === undefined || targetIdentityType === null
      ? null
      : resolveIdentityTypePairBehavior(sourceIdentityType, targetIdentityType);
  const summary = buildIdentityBehaviorSummary(
    sourceIdentityType,
    targetIdentityType ?? null,
    sourceBehavior,
    pairBehavior,
  );

  return {
    sourceBehavior,
    pairBehavior,
    summary,
  };
}

export function resolveIdentityTypePairBehavior(
  sourceIdentityType: IdentityType,
  targetIdentityType: IdentityType,
): IdentityTypePairBehaviorDefinition | null {
  return (
    IDENTITY_TYPE_PAIR_BEHAVIOR_DEFINITIONS.find(
      (definition) =>
        definition.sourceIdentityType === sourceIdentityType &&
        (definition.targetIdentityType === targetIdentityType ||
          definition.targetIdentityType === "*"),
    ) ?? null
  );
}

function buildIdentityBehaviorSummary(
  sourceIdentityType: IdentityType,
  targetIdentityType: IdentityType | null,
  sourceBehavior: IdentityTypeBehaviorDefinition,
  pairBehavior: IdentityTypePairBehaviorDefinition | null,
): IdentityTypeBehaviorSummary {
  const sourceAppliedKeys = Object.keys(
    sourceBehavior.permissionAdjustments,
  ) as PermissionKey[];
  const pairAppliedKeys = pairBehavior
    ? (Object.keys(pairBehavior.permissionAdjustments) as PermissionKey[])
    : [];

  return {
    sourceIdentityType,
    targetIdentityType,
    restrictionFlags: {
      prefersProtectedConversation:
        pairBehavior?.prefersProtectedConversation ??
        sourceBehavior.prefersProtectedConversation,
      allowsBusinessConversation:
        pairBehavior?.allowsBusinessConversation ??
        sourceBehavior.allowsBusinessConversation,
      businessConversationAllowed:
        pairBehavior?.allowsBusinessConversation ??
        sourceBehavior.allowsBusinessConversation,
      restrictsExport:
        pairBehavior?.restrictsExport ?? sourceBehavior.restrictsExport,
      exportRestricted:
        pairBehavior?.restrictsExport ?? sourceBehavior.restrictsExport,
      restrictsReshare:
        pairBehavior?.restrictsReshare ?? sourceBehavior.restrictsReshare,
      reshareRestricted:
        pairBehavior?.restrictsReshare ?? sourceBehavior.restrictsReshare,
      schedulingPreferredForCalls:
        pairBehavior?.schedulingPreferredForCalls ??
        sourceBehavior.schedulingPreferredForCalls,
      schedulingBiasForCalls:
        pairBehavior?.schedulingPreferredForCalls ??
        sourceBehavior.schedulingPreferredForCalls,
      restrictsDirectVideo:
        pairBehavior?.restrictsDirectVideo ??
        sourceBehavior.restrictsDirectVideo,
    },
    sourceAppliedKeys,
    pairAppliedKeys,
    reasonCodes: [
      ...new Set([
        ...(sourceAppliedKeys.length > 0 ? ["IDENTITY_BEHAVIOR_OK"] : []),
        ...(pairBehavior?.reasonCodes ?? []),
      ]),
    ] as IdentityBehaviorReasonCode[],
  };
}
