import type { ConnectionType } from "../../common/enums/connection-type.enum";
import type { IdentityType } from "../../common/enums/identity-type.enum";
import type { PermissionEffect } from "../../common/enums/permission-effect.enum";
import type { TrustState } from "../../common/enums/trust-state.enum";

import type { PermissionKey } from "./permission-keys";
import { PERMISSION_KEYS } from "./permission-keys";

export interface IdentityMetadata {
  labels?: string[];
  externalRef?: string;
  tags?: string[];
}

export interface ConnectionMetadata {
  source?: string;
  labels?: string[];
  lastReviewedAt?: string;
}

export interface PermissionLimits {
  maxUses?: number;
  expiresAt?: string;
  allowedFormats?: string[];
}

export interface PermissionSnapshotEntry {
  effect: PermissionEffect;
  limits?: PermissionLimits | null;
}

export type PermissionSnapshotPayload = Record<string, PermissionSnapshotEntry>;

export interface ConnectionPolicyTemplateLimits {
  maxMediaSizeMb?: number;
  exportAllowed?: boolean;
  watermarkRequired?: boolean;
  aiDefaultEnabled?: boolean;
  requiresCallScheduling?: boolean;
  requiresMutualConsent?: boolean;
  allowsProtectedMode?: boolean;
}

export interface TrustStateAdjustmentFlags {
  forceRestrictedProfileFields?: boolean;
  disableCalls?: boolean;
  disablePayments?: boolean;
  forceProtectedMediaLimited?: boolean;
  denyExport?: boolean;
  denyReshare?: boolean;
  aiDisabled?: boolean;
  markAsHighRisk?: boolean;
}

export interface PermissionTemplateValue {
  effect: PermissionEffect;
  limits?: PermissionLimits | ConnectionPolicyTemplateLimits;
}

export const CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS = [
  PERMISSION_KEYS.messaging.textSend,
  PERMISSION_KEYS.messaging.voiceSend,
  PERMISSION_KEYS.messaging.imageSend,
  PERMISSION_KEYS.messaging.videoSend,
  PERMISSION_KEYS.messaging.documentSend,
  PERMISSION_KEYS.calling.voiceStart,
  PERMISSION_KEYS.calling.videoStart,
  PERMISSION_KEYS.calling.directRing,
  PERMISSION_KEYS.mediaPrivacy.protectedSend,
  PERMISSION_KEYS.mediaPrivacy.download,
  PERMISSION_KEYS.mediaPrivacy.forward,
  PERMISSION_KEYS.mediaPrivacy.export,
  PERMISSION_KEYS.vault.itemAttach,
  PERMISSION_KEYS.vault.itemView,
  PERMISSION_KEYS.vault.itemDownload,
  PERMISSION_KEYS.vault.itemReshare,
  PERMISSION_KEYS.profile.basicView,
  PERMISSION_KEYS.profile.fullView,
  PERMISSION_KEYS.profile.phoneView,
  PERMISSION_KEYS.profile.emailView,
  PERMISSION_KEYS.actions.bookingRequestCreate,
  PERMISSION_KEYS.actions.paymentRequestCreate,
  PERMISSION_KEYS.actions.supportTicketCreate,
  PERMISSION_KEYS.ai.summaryUse,
  PERMISSION_KEYS.ai.replyUse,
  PERMISSION_KEYS.relationship.block,
  PERMISSION_KEYS.relationship.report,
  PERMISSION_KEYS.relationship.mute,
] as const satisfies readonly PermissionKey[];

export type CoreConnectionTemplatePermissionKey =
  (typeof CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS)[number];

export type ConnectionPolicyTemplatePermissions = Record<
  CoreConnectionTemplatePermissionKey,
  PermissionTemplateValue
> &
  Partial<Record<PermissionKey, PermissionTemplateValue>>;

export interface ConnectionPolicyTemplateSeedDefinition {
  sourceIdentityType: IdentityType | null;
  connectionType: ConnectionType;
  templateKey: string;
  displayName: string;
  description?: string;
  policyVersion: number;
  permissions: ConnectionPolicyTemplatePermissions;
  limits?: ConnectionPolicyTemplateLimits | null;
  isSystem: boolean;
  isActive: boolean;
}

export interface ConnectionPolicyTemplateRecord {
  id: string;
  sourceIdentityType: IdentityType | null;
  connectionType: ConnectionType;
  templateKey: string;
  displayName: string;
  description: string | null;
  policyVersion: number;
  permissionsJson: ConnectionPolicyTemplatePermissions;
  limitsJson: ConnectionPolicyTemplateLimits | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MergeMode = "RESTRICTIVE" | "PERMISSIVE";

export type PermissionMergeReasonCode =
  | "TEMPLATE_BASE"
  | "TRUST_NO_CHANGE"
  | "TRUST_PROMOTED"
  | "TRUST_RESTRICTED"
  | "TRUST_BLOCKED"
  | "TRUST_LIMITS_MERGED";

export interface PermissionMergeTraceEntry {
  baseEffect: PermissionEffect;
  adjustmentEffect: PermissionEffect | null;
  finalEffect: PermissionEffect;
  mergeMode: MergeMode;
  reasonCode: PermissionMergeReasonCode;
}

export type PermissionMergeTrace = Record<
  CoreConnectionTemplatePermissionKey,
  PermissionMergeTraceEntry
>;

export interface TrustStateAdjustmentDefinition {
  trustState: TrustState;
  mergeMode: MergeMode;
  permissions: Partial<Record<PermissionKey, PermissionTemplateValue>>;
  limits?: ConnectionPolicyTemplateLimits | null;
  flags?: TrustStateAdjustmentFlags;
}

export interface ResolvedPermissionValueLite extends PermissionTemplateValue {
  trace: PermissionMergeTraceEntry;
}

export interface TrustAdjustedPermissionsResult {
  mergedPermissions: ConnectionPolicyTemplatePermissions;
  mergeTrace: PermissionMergeTrace;
}

export interface PreviewPermissionsWithTrustStateInput {
  sourceIdentityType?: IdentityType | null;
  connectionType: ConnectionType;
  trustState: TrustState;
}

export interface PreviewPermissionsWithTrustStateResult {
  template: Pick<
    ConnectionPolicyTemplateRecord,
    | "id"
    | "sourceIdentityType"
    | "connectionType"
    | "templateKey"
    | "displayName"
    | "description"
    | "policyVersion"
  >;
  trustState: TrustState;
  mergedPermissions: ConnectionPolicyTemplatePermissions;
  mergeTrace: PermissionMergeTrace;
}
