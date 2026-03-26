import type { ConnectionType } from "../../common/enums/connection-type.enum";
import type { IdentityType } from "../../common/enums/identity-type.enum";
import type { PermissionEffect } from "../../common/enums/permission-effect.enum";
import type { RelationshipType } from "../../common/enums/relationship-type.enum";
import type { TrustState } from "../../common/enums/trust-state.enum";
import type { IdentityTypeBehaviorSummary } from "./identity-type-behaviors";
import type { RelationshipBehaviorSummary } from "./relationship-engine";
import type { RiskSeverity, RiskSignal, RiskSignalRecord } from "./risk-engine";

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

export interface RelationshipMetadata {
  establishedAt?: string;
  tags?: string[];
  notes?: string;
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
  | "IDENTITY_BEHAVIOR_NO_CHANGE"
  | "IDENTITY_BEHAVIOR_PROMOTED"
  | "IDENTITY_BEHAVIOR_RESTRICTED"
  | "IDENTITY_PAIR_RULE_APPLIED"
  | "IDENTITY_BEHAVIOR_FLAG_ONLY"
  | "RELATIONSHIP_NO_CHANGE"
  | "RELATIONSHIP_PROMOTED"
  | "RELATIONSHIP_RESTRICTED"
  | "RELATIONSHIP_FLAG_ONLY"
  | "TRUST_NO_CHANGE"
  | "TRUST_PROMOTED"
  | "TRUST_RESTRICTED"
  | "TRUST_BLOCKED"
  | "TRUST_LIMITS_MERGED"
  | "OVERRIDE_NO_CHANGE"
  | "OVERRIDE_APPLIED"
  | "OVERRIDE_LIMITS_MERGED"
  | "OVERRIDE_BLOCKED_BY_GUARDRAIL"
  | "OVERRIDE_SKIPPED_HARD_DENY"
  | "OVERRIDE_PRESERVED_SYSTEM_PERMISSION"
  | "RISK_NO_CHANGE"
  | "RISK_RESTRICTED"
  | "RISK_BLOCKED"
  | "RISK_MULTI_SIGNAL_RESTRICTED"
  | "RISK_PRESERVED_SYSTEM_PERMISSION";

export interface PermissionResolutionStageTrace {
  baseEffect: PermissionEffect;
  identityBehaviorEffect: PermissionEffect | null;
  postIdentityBehaviorEffect: PermissionEffect;
  relationshipBehaviorEffect: PermissionEffect | null;
  postRelationshipEffect: PermissionEffect;
  adjustmentEffect: PermissionEffect | null;
  postTrustEffect: PermissionEffect;
  manualOverrideEffect: PermissionEffect | null;
  preRiskEffect: PermissionEffect;
  riskAdjustmentEffect: PermissionEffect | null;
  finalEffect: PermissionEffect;
  mergeMode: MergeMode;
  overrideApplied: boolean;
  guardrailApplied: boolean;
  riskApplied: boolean;
  riskReasons: RiskSignal[];
  reasonCode: PermissionMergeReasonCode;
}

export type PermissionMergeTraceEntry = PermissionResolutionStageTrace;

export type PermissionMergeTrace = Partial<
  Record<PermissionKey, PermissionMergeTraceEntry>
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

export interface ResolvedPermissionValueStageful extends PermissionTemplateValue {
  postTrustEffect: PermissionEffect;
  manualOverrideEffect: PermissionEffect | null;
  finalEffect: PermissionEffect;
  trace: PermissionResolutionStageTrace;
}

export interface ManualOverrideValue {
  permissionKey: PermissionKey;
  effect: PermissionEffect;
  limits?: PermissionLimits | ConnectionPolicyTemplateLimits | null;
  reason?: string | null;
  createdAt: Date;
  createdByIdentityId: string;
}

export type ManualOverrideMap = Partial<
  Record<PermissionKey, ManualOverrideValue>
>;

export interface ManualOverrideGuardrailDecision {
  blocked: boolean;
  reasonCode:
    | "OVERRIDE_BLOCKED_BY_GUARDRAIL"
    | "OVERRIDE_SKIPPED_HARD_DENY"
    | "OVERRIDE_PRESERVED_SYSTEM_PERMISSION"
    | null;
}

export interface TrustAdjustedPermissionsResult {
  mergedPermissions: ConnectionPolicyTemplatePermissions;
  mergeTrace: PermissionMergeTrace;
}

export interface IdentityBehaviorAdjustedPermissionsResult {
  mergedPermissions: ConnectionPolicyTemplatePermissions;
  mergeTrace: PermissionMergeTrace;
  behaviorSummary: IdentityTypeBehaviorSummary;
}

export interface RelationshipBehaviorAdjustedPermissionsResult {
  mergedPermissions: ConnectionPolicyTemplatePermissions;
  mergeTrace: PermissionMergeTrace;
  relationshipSummary: RelationshipBehaviorSummary;
}

export interface OverrideAdjustedPermissionsResult {
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

export interface PreviewPermissionsWithIdentityBehaviorResult {
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
  sourceIdentityType: IdentityType;
  targetIdentityType: IdentityType | null;
  connectionType: ConnectionType;
  trustState: TrustState;
  behaviorSummary: IdentityTypeBehaviorSummary;
  postIdentityBehaviorPermissions: ConnectionPolicyTemplatePermissions;
  finalPermissions: ConnectionPolicyTemplatePermissions;
  mergeTrace: PermissionMergeTrace;
}

export interface PreviewPermissionsWithRelationshipResult {
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
  sourceIdentityType: IdentityType;
  targetIdentityType: IdentityType | null;
  connectionType: ConnectionType;
  trustState: TrustState;
  relationshipType: RelationshipType;
  identityBehaviorSummary: IdentityTypeBehaviorSummary;
  relationshipBehaviorSummary: RelationshipBehaviorSummary;
  postIdentityBehaviorPermissions: ConnectionPolicyTemplatePermissions;
  postRelationshipBehaviorPermissions: ConnectionPolicyTemplatePermissions;
  finalPermissions: ConnectionPolicyTemplatePermissions;
  mergeTrace: PermissionMergeTrace;
}

export interface ConnectionPermissionOverrideRecord {
  permissionKey: PermissionKey;
  effect: PermissionEffect;
  limits: PermissionLimits | ConnectionPolicyTemplateLimits | null;
  reason: string | null;
  createdAt: Date;
  createdByIdentityId: string;
}

export interface PreviewResolvedPermissionsForConnectionResult {
  connection: {
    id: string;
    sourceIdentityId: string;
    targetIdentityId: string;
    relationshipType: RelationshipType;
    connectionType: ConnectionType;
    trustState: TrustState;
    status: string;
  };
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
  overrides: {
    count: number;
    items: ConnectionPermissionOverrideRecord[];
  };
  finalPermissions: ConnectionPolicyTemplatePermissions;
  mergeTrace: PermissionMergeTrace;
}

export interface ConnectionPermissionResolutionSummary {
  count: number;
  overriddenKeys: PermissionKey[];
}

export interface RiskEvaluationSummary {
  appliedSignals: RiskSignal[];
  highestSeverity: RiskSeverity | null;
  blockedProtectedMode: boolean;
  blockedPayments: boolean;
  blockedCalls: boolean;
  aiRestricted: boolean;
}

export enum ScreenshotPolicy {
  Inherit = "INHERIT",
  Allow = "ALLOW",
  Deny = "DENY",
}

export enum RecordPolicy {
  Inherit = "INHERIT",
  Allow = "ALLOW",
  Deny = "DENY",
}

export type ContentActionKey =
  | "content.view"
  | "content.download"
  | "content.forward"
  | "content.export"
  | "content.screenshot"
  | "content.record"
  | "content.ai_access";

export type ContentRestrictionReason =
  | "CONTENT_INHERITED"
  | "CONTENT_RULE_APPLIED"
  | "CONTENT_EXPIRED"
  | "CONTENT_VIEW_LIMIT_REACHED"
  | "CONTENT_SCREENSHOT_DENIED"
  | "CONTENT_RECORD_DENIED"
  | "CONTENT_AI_DENIED"
  | "CONTENT_NO_RULE"
  | "CONTENT_BASE_DENY_PRESERVED";

export interface ContentAccessRuleValue {
  contentId: string;
  targetIdentityId: string;
  canView: boolean;
  canDownload: boolean;
  canForward: boolean;
  canExport: boolean;
  screenshotPolicy: ScreenshotPolicy;
  recordPolicy: RecordPolicy;
  expiryAt: Date | null;
  viewLimit: number | null;
  watermarkMode: string | null;
  aiAccessAllowed: boolean | null;
  metadataJson: Record<string, unknown> | null;
  createdByIdentityId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentBasePermissionResolution {
  basePermissionKey: PermissionKey;
  effect: PermissionEffect;
  inheritedFromConnection: boolean;
}

export type ContentConnectionPermissionSubset = Record<
  ContentActionKey,
  ContentBasePermissionResolution
>;

export interface ContentPermissionResolution {
  effect: PermissionEffect;
}

export interface ContentPolicyTraceEntry {
  basePermissionKey: PermissionKey;
  baseEffect: PermissionEffect;
  contentRulePresent: boolean;
  contentRuleDecision:
    | "INHERIT"
    | "ALLOW"
    | "DENY"
    | "EXPIRED"
    | "VIEW_LIMIT_REACHED"
    | "SCREENSHOT_DENY"
    | "RECORD_DENY"
    | "AI_DENY"
    | "BASE_DENY";
  finalEffect: PermissionEffect;
  reasonCode: ContentRestrictionReason;
}

export type ContentPolicyTrace = Record<
  ContentActionKey,
  ContentPolicyTraceEntry
>;

export interface ContentSummary {
  contentId: string;
  targetIdentityId: string;
  rulePresent: boolean;
  expiryAt: Date | null;
  viewLimit: number | null;
  currentViewCount: number;
  watermarkMode: string | null;
  aiAccessAllowed: boolean | null;
}

export interface ContentPermissionSummary {
  rulePresent: boolean;
  expired: boolean;
  viewLimitReached: boolean;
  blockedActions: ContentActionKey[];
  reasons: ContentRestrictionReason[];
}

export interface ResolvedContentPermissionsForConnectionResult {
  connection: {
    id: string;
    sourceIdentityId: string;
    targetIdentityId: string;
    sourceIdentityType: IdentityType;
    connectionType: ConnectionType;
    trustState: TrustState;
    status: string;
    templateKey: string;
    policyVersion: number;
  };
  contentSummary: ContentSummary;
  baseConnectionPermissions: ContentConnectionPermissionSubset;
  effectiveContentPermissions: Record<
    ContentActionKey,
    ContentPermissionResolution
  >;
  contentTrace: ContentPolicyTrace;
  restrictionSummary: ContentPermissionSummary;
}

export interface PreviewContentPermissionsResult {
  sourceIdentityType: IdentityType | null;
  connectionType: ConnectionType;
  trustState: TrustState;
  contentSummary: ContentSummary;
  baseConnectionPermissions: ContentConnectionPermissionSubset;
  effectiveContentPermissions: Record<
    ContentActionKey,
    ContentPermissionResolution
  >;
  contentTrace: ContentPolicyTrace;
  restrictionSummary: ContentPermissionSummary;
  riskSummary: RiskEvaluationSummary;
}

export enum ConversationType {
  Direct = "DIRECT",
  ProtectedDirect = "PROTECTED_DIRECT",
  BusinessDirect = "BUSINESS_DIRECT",
}

export enum ConversationStatus {
  Active = "ACTIVE",
  Archived = "ARCHIVED",
  Blocked = "BLOCKED",
  Locked = "LOCKED",
}

export interface IdentityConversationContext {
  conversationId: string;
  connectionId: string;
  sourceIdentityId: string;
  targetIdentityId: string;
  conversationType: ConversationType;
  conversationStatus: ConversationStatus;
  title: string | null;
  metadataJson: Record<string, unknown> | null;
  lastResolvedAt: Date | null;
  lastPermissionHash: string | null;
  createdByIdentityId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationPermissionBindingSummary {
  storedHash: string | null;
  currentHash: string;
  lastResolvedAt: Date | null;
  currentResolvedAt: Date;
  stale: boolean;
}

export interface ConversationResolutionTrace {
  templateKey: string;
  policyVersion: number;
  trustState: TrustState;
  overrideCount: number;
  riskSignals: RiskSignal[];
}

export interface BoundConversationPermissions {
  conversationId: string;
  connectionId: string;
  sourceIdentityId: string;
  targetIdentityId: string;
  conversationType: ConversationType;
  conversationStatus: ConversationStatus;
  resolvedConnectionPermissions: ResolvedConnectionPermissions;
  contentCapabilitySummary: {
    protectedCapable: boolean;
    vaultCapable: boolean;
    aiCapable: boolean;
  };
  bindingSummary: ConversationPermissionBindingSummary;
  traceSummary: ConversationResolutionTrace;
  resolvedAt: Date;
  stale: boolean;
}

export interface ConversationBindingStalenessResult {
  stale: boolean;
  currentHash: string;
  storedHash: string | null;
  lastResolvedAt: Date | null;
  currentResolvedAt: Date;
}

export interface ResolveConversationContextResult {
  conversation: IdentityConversationContext;
  resolvedPermissions: ResolvedConnectionPermissions;
  stale: boolean;
  bindingSummary: ConversationPermissionBindingSummary;
  traceSummary: ConversationResolutionTrace;
}

export type { IdentityTypeBehaviorSummary } from "./identity-type-behaviors";

export type IdentityBehaviorRuleSummary = IdentityTypeBehaviorSummary;

export interface ResolvedPermissionValue extends PermissionTemplateValue {
  postTrustEffect: PermissionEffect;
  manualOverrideEffect: PermissionEffect | null;
  finalEffect: PermissionEffect;
  trace: PermissionResolutionStageTrace;
}

export type ResolvedPermissionMap = Partial<
  Record<PermissionKey, ResolvedPermissionValue>
>;

export interface ResolvedConnectionPermissions {
  connectionId: string;
  sourceIdentityId: string;
  targetIdentityId: string;
  sourceIdentity?: ConnectionIdentitySummary;
  targetIdentity?: ConnectionIdentitySummary;
  sourceIdentityType: IdentityType;
  relationshipType: RelationshipType;
  connectionType: ConnectionType;
  trustState: TrustState;
  status: string;
  template: {
    templateKey: string;
    policyVersion: number;
  };
  identityBehaviorSummary: IdentityTypeBehaviorSummary;
  relationshipBehaviorSummary: RelationshipBehaviorSummary;
  overridesSummary: ConnectionPermissionResolutionSummary;
  riskSummary: RiskEvaluationSummary;
  permissions: ResolvedPermissionMap;
  trace: PermissionMergeTrace;
  resolvedAt: Date;
}

export interface ConnectionIdentitySummary {
  id: string;
  displayName: string;
  handle: string | null;
  identityType: IdentityType;
  verificationLevel: string;
  status: string;
}

export interface ConnectionPermissionSnapshotRecord {
  id: string;
  connectionId: string;
  policyVersion: number;
  permissionsJson: ConnectionPolicyTemplatePermissions;
  metadataJson: PermissionSnapshotMetadata | null;
  computedAt: Date;
}

export interface PermissionSnapshotMetadata {
  resolverVersion: string;
  templateKey: string;
  templatePolicyVersion: number;
  applyRiskOverlay: boolean;
  trustState: TrustState;
  connectionType: ConnectionType;
  relationshipType: RelationshipType;
  overrideCount: number;
  riskSummaryHash: string;
  sourceHash: string;
  computedAt: Date;
}

export interface SnapshotFreshnessCheckResult {
  fresh: boolean;
  reason:
    | "FRESH"
    | "MISSING"
    | "RESOLVER_VERSION_MISMATCH"
    | "RISK_OVERLAY_MISMATCH"
    | "SOURCE_HASH_MISMATCH"
    | "RISK_PREVIEW_UNSAFE"
    | "MISSING_METADATA";
  expectedSourceHash: string | null;
  actualSourceHash: string | null;
}

export interface CachedResolvedConnectionPermissions {
  cacheKey: string;
  resolved: ResolvedConnectionPermissions;
  sourceHash: string;
  resolverVersion: string;
}

export interface CachedConversationContext {
  cacheKey: string;
  context: ResolveConversationContextResult;
  permissionHash: string;
  resolverVersion: string;
}

export interface PreviewPermissionsWithRiskResult {
  sourceIdentityType: IdentityType | null;
  connectionType: ConnectionType;
  trustState: TrustState;
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
  overridesSummary: ConnectionPermissionResolutionSummary;
  riskSummary: RiskEvaluationSummary;
  finalPermissions: ConnectionPolicyTemplatePermissions;
  mergeTrace: PermissionMergeTrace;
  previewRiskSignals: RiskSignalRecord[];
}
