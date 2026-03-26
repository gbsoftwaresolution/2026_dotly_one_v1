import { ConnectionType } from "../../common/enums/connection-type.enum";
import { RelationshipType } from "../../common/enums/relationship-type.enum";
import { PermissionEffect } from "../../common/enums/permission-effect.enum";

import { ConversationType } from "./identity.types";
import type {
  PermissionMergeReasonCode,
  PermissionTemplateValue,
} from "./identity.types";
import type { PermissionKey } from "./permission-keys";
import { PERMISSION_KEYS } from "./permission-keys";

export interface RelationshipCompatibilityFlags {
  prefersProtectedConversation: boolean;
  prefersBusinessConversation: boolean;
  supportsServiceFlow: boolean;
  allowsRoutineCalls: boolean;
  restrictsExport: boolean;
  restrictsReshare: boolean;
}

export interface RelationshipBehaviorDefinition {
  relationshipType: RelationshipType;
  permissionAdjustments: Partial<
    Record<PermissionKey, PermissionTemplateValue>
  >;
  compatibilityFlags: RelationshipCompatibilityFlags;
  prefersScheduledCalls: boolean;
  routineCallFriendly: boolean;
  serviceFlowFriendly: boolean;
  recommendedConversationType: ConversationType;
  reasonCodes: PermissionMergeReasonCode[];
}

export interface RelationshipAdjustmentTrace {
  relationshipType: RelationshipType;
  appliedKeys: PermissionKey[];
  reasonCodes: PermissionMergeReasonCode[];
}

export interface RelationshipBehaviorSummary {
  relationshipType: RelationshipType;
  appliedKeys: PermissionKey[];
  compatibilityFlags: RelationshipCompatibilityFlags;
  recommendedConversationType: ConversationType;
  prefersScheduledCalls: boolean;
  routineCallFriendly: boolean;
  serviceFlowFriendly: boolean;
  reasonCodes: PermissionMergeReasonCode[];
}

const ALLOW = { effect: PermissionEffect.Allow };
const ALLOW_WITH_LIMITS = { effect: PermissionEffect.AllowWithLimits };
const DENY = { effect: PermissionEffect.Deny };

export const RELATIONSHIP_BEHAVIOR_DEFINITIONS: Record<
  RelationshipType,
  RelationshipBehaviorDefinition
> = {
  [RelationshipType.Unknown]: {
    relationshipType: RelationshipType.Unknown,
    permissionAdjustments: {},
    compatibilityFlags: createCompatibilityFlags(),
    prefersScheduledCalls: false,
    routineCallFriendly: false,
    serviceFlowFriendly: false,
    recommendedConversationType: ConversationType.Direct,
    reasonCodes: ["RELATIONSHIP_NO_CHANGE"],
  },
  [RelationshipType.Friend]: {
    relationshipType: RelationshipType.Friend,
    permissionAdjustments: {
      [PERMISSION_KEYS.messaging.voiceSend]: ALLOW,
      [PERMISSION_KEYS.calling.voiceStart]: ALLOW,
    },
    compatibilityFlags: createCompatibilityFlags({
      allowsRoutineCalls: true,
    }),
    prefersScheduledCalls: false,
    routineCallFriendly: true,
    serviceFlowFriendly: false,
    recommendedConversationType: ConversationType.Direct,
    reasonCodes: ["RELATIONSHIP_PROMOTED"],
  },
  [RelationshipType.Partner]: {
    relationshipType: RelationshipType.Partner,
    permissionAdjustments: {
      [PERMISSION_KEYS.mediaPrivacy.protectedSend]: ALLOW,
      [PERMISSION_KEYS.vault.itemView]: ALLOW,
      [PERMISSION_KEYS.vault.itemDownload]: ALLOW,
      [PERMISSION_KEYS.mediaPrivacy.export]: DENY,
      [PERMISSION_KEYS.vault.itemReshare]: DENY,
    },
    compatibilityFlags: createCompatibilityFlags({
      prefersProtectedConversation: true,
      restrictsExport: true,
      restrictsReshare: true,
      allowsRoutineCalls: true,
    }),
    prefersScheduledCalls: false,
    routineCallFriendly: true,
    serviceFlowFriendly: false,
    recommendedConversationType: ConversationType.ProtectedDirect,
    reasonCodes: ["RELATIONSHIP_RESTRICTED"],
  },
  [RelationshipType.FamilyMember]: {
    relationshipType: RelationshipType.FamilyMember,
    permissionAdjustments: {
      [PERMISSION_KEYS.vault.itemView]: ALLOW,
      [PERMISSION_KEYS.vault.itemDownload]: ALLOW,
      [PERMISSION_KEYS.profile.basicView]: ALLOW,
      [PERMISSION_KEYS.mediaPrivacy.export]: ALLOW_WITH_LIMITS,
      [PERMISSION_KEYS.vault.itemReshare]: ALLOW_WITH_LIMITS,
    },
    compatibilityFlags: createCompatibilityFlags({
      prefersProtectedConversation: true,
      allowsRoutineCalls: true,
      restrictsExport: true,
      restrictsReshare: true,
    }),
    prefersScheduledCalls: false,
    routineCallFriendly: true,
    serviceFlowFriendly: false,
    recommendedConversationType: ConversationType.ProtectedDirect,
    reasonCodes: ["RELATIONSHIP_PROMOTED"],
  },
  [RelationshipType.Colleague]: {
    relationshipType: RelationshipType.Colleague,
    permissionAdjustments: {
      [PERMISSION_KEYS.actions.bookingRequestCreate]: ALLOW,
      [PERMISSION_KEYS.actions.supportTicketCreate]: ALLOW,
      [PERMISSION_KEYS.calling.voiceStart]: ALLOW,
    },
    compatibilityFlags: createCompatibilityFlags({
      prefersBusinessConversation: true,
      allowsRoutineCalls: true,
    }),
    prefersScheduledCalls: true,
    routineCallFriendly: true,
    serviceFlowFriendly: false,
    recommendedConversationType: ConversationType.BusinessDirect,
    reasonCodes: ["RELATIONSHIP_PROMOTED"],
  },
  [RelationshipType.Client]: {
    relationshipType: RelationshipType.Client,
    permissionAdjustments: {
      [PERMISSION_KEYS.actions.bookingRequestCreate]: ALLOW,
      [PERMISSION_KEYS.actions.paymentRequestCreate]: ALLOW,
      [PERMISSION_KEYS.actions.supportTicketCreate]: ALLOW,
    },
    compatibilityFlags: createCompatibilityFlags({
      prefersBusinessConversation: true,
      supportsServiceFlow: true,
      allowsRoutineCalls: true,
    }),
    prefersScheduledCalls: true,
    routineCallFriendly: true,
    serviceFlowFriendly: true,
    recommendedConversationType: ConversationType.BusinessDirect,
    reasonCodes: ["RELATIONSHIP_PROMOTED"],
  },
  [RelationshipType.Vendor]: {
    relationshipType: RelationshipType.Vendor,
    permissionAdjustments: {
      [PERMISSION_KEYS.actions.invoiceIssue]: ALLOW,
      [PERMISSION_KEYS.actions.paymentRequestCreate]: ALLOW,
      [PERMISSION_KEYS.actions.supportTicketCreate]: ALLOW,
    },
    compatibilityFlags: createCompatibilityFlags({
      prefersBusinessConversation: true,
      supportsServiceFlow: true,
    }),
    prefersScheduledCalls: true,
    routineCallFriendly: false,
    serviceFlowFriendly: true,
    recommendedConversationType: ConversationType.BusinessDirect,
    reasonCodes: ["RELATIONSHIP_PROMOTED"],
  },
  [RelationshipType.VerifiedBusinessContact]: {
    relationshipType: RelationshipType.VerifiedBusinessContact,
    permissionAdjustments: {
      [PERMISSION_KEYS.actions.bookingRequestCreate]: ALLOW,
      [PERMISSION_KEYS.actions.paymentRequestCreate]: ALLOW,
      [PERMISSION_KEYS.actions.supportTicketCreate]: ALLOW,
    },
    compatibilityFlags: createCompatibilityFlags({
      prefersBusinessConversation: true,
      supportsServiceFlow: true,
      allowsRoutineCalls: true,
    }),
    prefersScheduledCalls: true,
    routineCallFriendly: true,
    serviceFlowFriendly: true,
    recommendedConversationType: ConversationType.BusinessDirect,
    reasonCodes: ["RELATIONSHIP_PROMOTED"],
  },
  [RelationshipType.InnerCircle]: {
    relationshipType: RelationshipType.InnerCircle,
    permissionAdjustments: {
      [PERMISSION_KEYS.mediaPrivacy.download]: ALLOW,
      [PERMISSION_KEYS.vault.itemView]: ALLOW,
      [PERMISSION_KEYS.vault.itemDownload]: ALLOW,
      [PERMISSION_KEYS.profile.basicView]: ALLOW,
    },
    compatibilityFlags: createCompatibilityFlags({
      prefersProtectedConversation: true,
      allowsRoutineCalls: true,
    }),
    prefersScheduledCalls: false,
    routineCallFriendly: true,
    serviceFlowFriendly: false,
    recommendedConversationType: ConversationType.ProtectedDirect,
    reasonCodes: ["RELATIONSHIP_PROMOTED"],
  },
  [RelationshipType.HouseholdService]: {
    relationshipType: RelationshipType.HouseholdService,
    permissionAdjustments: {
      [PERMISSION_KEYS.actions.bookingRequestCreate]: ALLOW,
      [PERMISSION_KEYS.actions.supportTicketCreate]: ALLOW,
    },
    compatibilityFlags: createCompatibilityFlags({
      prefersBusinessConversation: true,
      supportsServiceFlow: true,
      allowsRoutineCalls: true,
    }),
    prefersScheduledCalls: true,
    routineCallFriendly: true,
    serviceFlowFriendly: true,
    recommendedConversationType: ConversationType.BusinessDirect,
    reasonCodes: ["RELATIONSHIP_PROMOTED"],
  },
  [RelationshipType.SupportAgent]: {
    relationshipType: RelationshipType.SupportAgent,
    permissionAdjustments: {
      [PERMISSION_KEYS.actions.supportTicketCreate]: ALLOW,
      [PERMISSION_KEYS.actions.bookingRequestCreate]: ALLOW,
    },
    compatibilityFlags: createCompatibilityFlags({
      prefersBusinessConversation: true,
      supportsServiceFlow: true,
    }),
    prefersScheduledCalls: true,
    routineCallFriendly: false,
    serviceFlowFriendly: true,
    recommendedConversationType: ConversationType.BusinessDirect,
    reasonCodes: ["RELATIONSHIP_PROMOTED"],
  },
};

export function getRelationshipBehavior(
  relationshipType: RelationshipType | null | undefined,
): RelationshipBehaviorDefinition {
  return (
    RELATIONSHIP_BEHAVIOR_DEFINITIONS[
      relationshipType ?? RelationshipType.Unknown
    ] ?? RELATIONSHIP_BEHAVIOR_DEFINITIONS[RelationshipType.Unknown]
  );
}

export function summarizeRelationshipBehavior(
  relationshipType: RelationshipType | null | undefined,
): RelationshipBehaviorSummary {
  const definition = getRelationshipBehavior(relationshipType);
  const appliedKeys = Object.keys(
    definition.permissionAdjustments,
  ) as PermissionKey[];

  return {
    relationshipType: definition.relationshipType,
    appliedKeys,
    compatibilityFlags: definition.compatibilityFlags,
    recommendedConversationType: definition.recommendedConversationType,
    prefersScheduledCalls: definition.prefersScheduledCalls,
    routineCallFriendly: definition.routineCallFriendly,
    serviceFlowFriendly: definition.serviceFlowFriendly,
    reasonCodes: definition.reasonCodes,
  };
}

export function inferRelationshipTypeFromConnectionType(
  connectionType: ConnectionType,
): RelationshipType {
  switch (connectionType) {
    case ConnectionType.Partner:
      return RelationshipType.Partner;
    case ConnectionType.Family:
      return RelationshipType.FamilyMember;
    case ConnectionType.Colleague:
      return RelationshipType.Colleague;
    case ConnectionType.Client:
      return RelationshipType.Client;
    case ConnectionType.Vendor:
      return RelationshipType.Vendor;
    case ConnectionType.VerifiedBusiness:
      return RelationshipType.VerifiedBusinessContact;
    case ConnectionType.InnerCircle:
      return RelationshipType.InnerCircle;
    default:
      return RelationshipType.Unknown;
  }
}

function createCompatibilityFlags(
  overrides?: Partial<RelationshipCompatibilityFlags>,
): RelationshipCompatibilityFlags {
  return {
    prefersProtectedConversation: false,
    prefersBusinessConversation: false,
    supportsServiceFlow: false,
    allowsRoutineCalls: false,
    restrictsExport: false,
    restrictsReshare: false,
    ...overrides,
  };
}
