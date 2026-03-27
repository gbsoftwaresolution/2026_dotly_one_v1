import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import { ConnectionStatus } from "../../../common/enums/connection-status.enum";
import { ConnectionType } from "../../../common/enums/connection-type.enum";
import {
  IdentityMemberRole,
  IdentityMemberStatus,
} from "../../../common/enums/identity-member-role.enum";
import {
  IdentityOperatorRole,
  IdentityOperatorStatus,
} from "../../../common/enums/identity-operator-role.enum";
import { PermissionEffect } from "../../../common/enums/permission-effect.enum";
import { RelationshipType } from "../../../common/enums/relationship-type.enum";
import { TrustState } from "../../../common/enums/trust-state.enum";
import { AIExecutionContext, AICapability } from "../ai-permission";
import { ActionType } from "../action-permission";
import { CallInitiationMode, CallType } from "../call-permission";
import { ConversationStatus } from "../identity.types";
import type { PermissionLimits } from "../identity.types";
import { RecordPolicy, ScreenshotPolicy } from "../identity.types";
import { PermissionDebugVerbosity } from "../permission-debug";
import { ALL_PERMISSION_KEYS, type PermissionKey } from "../permission-keys";
import { PermissionAuditEventType } from "../permission-audit";
import { RiskSeverity, RiskSignal } from "../risk-engine";

export class IdentityIdParamDto {
  @IsUUID()
  identityId!: string;
}

export class IdentityMemberIdParamDto extends IdentityIdParamDto {
  @IsUUID()
  memberId!: string;
}

export class IdentityOperatorIdParamDto extends IdentityIdParamDto {
  @IsUUID()
  operatorId!: string;
}

export class ConnectionIdParamDto {
  @IsUUID()
  connectionId!: string;
}

export class ConversationIdParamDto {
  @IsUUID()
  conversationId!: string;
}

export class ConnectionPermissionKeyParamDto {
  @IsUUID()
  connectionId!: string;

  @IsIn(ALL_PERMISSION_KEYS)
  permissionKey!: PermissionKey;
}

export class ConnectionContentParamDto {
  @IsUUID()
  connectionId!: string;

  @IsUUID()
  contentId!: string;
}

export class ListConnectionsForIdentityQueryDto {
  @IsOptional()
  @IsEnum(ConnectionStatus)
  status?: ConnectionStatus;
}

export class ResolveConnectionPermissionsQueryDto {
  @IsOptional()
  @IsBoolean()
  persistSnapshot?: boolean;

  @IsOptional()
  @IsBoolean()
  preferCache?: boolean;

  @IsOptional()
  @IsBoolean()
  preferSnapshot?: boolean;

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;

  @IsOptional()
  @IsBoolean()
  applyRiskOverlay?: boolean;
}

export class ExplainResolvedPermissionsQueryDto extends ResolveConnectionPermissionsQueryDto {
  @IsOptional()
  @IsEnum(PermissionDebugVerbosity)
  verbosity?: PermissionDebugVerbosity;
}

export class ExplainResolvedPermissionQueryDto extends ExplainResolvedPermissionsQueryDto {}

export class DiffCurrentPermissionsAgainstSnapshotQueryDto {
  @IsOptional()
  @IsBoolean()
  applyRiskOverlay?: boolean;

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class UpdateConnectionTypeRequestDto {
  @IsEnum(ConnectionType)
  connectionType!: ConnectionType;
}

export class UpdateTrustStateRequestDto {
  @IsEnum(TrustState)
  trustState!: TrustState;
}

export class UpdateConnectionRelationshipTypeRequestDto {
  @IsEnum(RelationshipType)
  relationshipType!: RelationshipType;
}

export class SetPermissionOverrideRequestDto {
  @IsEnum(PermissionEffect)
  effect!: PermissionEffect;

  @IsOptional()
  @IsObject()
  limitsJson?: PermissionLimits | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;

  @IsUUID()
  createdByIdentityId!: string;
}

export class ListConversationsForIdentityQueryDto {
  @IsOptional()
  @IsUUID()
  personaId?: string;

  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;
}

export class UpdateConversationStatusRequestDto {
  @IsEnum(ConversationStatus)
  status!: ConversationStatus;
}

export class UpdatePersonaAssignmentsRequestDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  personaIds!: string[];
}

export class CreateIdentityMemberRequestDto {
  @IsUUID()
  personId!: string;

  @IsEnum(IdentityMemberRole)
  role!: IdentityMemberRole;

  @IsOptional()
  @IsEnum(IdentityMemberStatus)
  status?: IdentityMemberStatus;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  personaIds?: string[];
}

export class UpdateIdentityMemberRequestDto {
  @IsOptional()
  @IsEnum(IdentityMemberRole)
  role?: IdentityMemberRole;

  @IsOptional()
  @IsEnum(IdentityMemberStatus)
  status?: IdentityMemberStatus;
}

export class CreateIdentityOperatorRequestDto {
  @IsUUID()
  personId!: string;

  @IsEnum(IdentityOperatorRole)
  role!: IdentityOperatorRole;

  @IsOptional()
  @IsEnum(IdentityOperatorStatus)
  status?: IdentityOperatorStatus;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  personaIds?: string[];
}

export class UpdateIdentityOperatorRequestDto {
  @IsOptional()
  @IsEnum(IdentityOperatorRole)
  role?: IdentityOperatorRole;

  @IsOptional()
  @IsEnum(IdentityOperatorStatus)
  status?: IdentityOperatorStatus;
}

export class GetContentAccessRuleQueryDto {
  @IsUUID()
  contentId!: string;

  @IsUUID()
  targetIdentityId!: string;
}

export class ResolveContentPermissionsQueryDto {
  @IsUUID()
  targetIdentityId!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  currentViewCount?: number;

  @IsOptional()
  @IsBoolean()
  persistSnapshot?: boolean;
}

export class EnforceActionRequestDto {
  @IsUUID()
  actorIdentityId!: string;

  @IsEnum(ActionType)
  actionType!: ActionType;

  @IsOptional()
  @IsUUID()
  contentId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  currentViewCount?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class EnforceCallRequestDto {
  @IsUUID()
  actorIdentityId!: string;

  @IsEnum(CallType)
  callType!: CallType;

  @IsEnum(CallInitiationMode)
  initiationMode!: CallInitiationMode;

  @IsOptional()
  @IsBoolean()
  screenCaptureDetected?: boolean;

  @IsOptional()
  @IsBoolean()
  castingDetected?: boolean;

  @IsOptional()
  @IsBoolean()
  deviceIntegrityCompromised?: boolean;

  @IsOptional()
  @IsBoolean()
  currentProtectedModeExpectation?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

class PreviewRiskSignalRecordDto {
  @IsEnum(RiskSignal)
  signal!: RiskSignal;

  @IsEnum(RiskSeverity)
  severity!: RiskSeverity;
}

export class EnforceAICapabilityRequestDto {
  @IsUUID()
  actorIdentityId!: string;

  @IsEnum(AICapability)
  capability!: AICapability;

  @IsEnum(AIExecutionContext)
  contextType!: AIExecutionContext;

  @IsOptional()
  @IsUUID()
  contentId?: string;

  @IsOptional()
  @IsBoolean()
  isProtectedContent?: boolean;

  @IsOptional()
  @IsBoolean()
  isVaultContent?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewRiskSignalRecordDto)
  previewRiskSignals?: PreviewRiskSignalRecordDto[];
}

export class ListPermissionAuditEventsQueryDto {
  @IsOptional()
  @IsEnum(PermissionAuditEventType)
  eventType?: PermissionAuditEventType;

  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsUUID()
  actorIdentityId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SetContentAccessRuleRequestDto {
  @IsUUID()
  contentId!: string;

  @IsUUID()
  targetIdentityId!: string;

  @IsOptional()
  @IsBoolean()
  canView?: boolean;

  @IsOptional()
  @IsBoolean()
  canDownload?: boolean;

  @IsOptional()
  @IsBoolean()
  canForward?: boolean;

  @IsOptional()
  @IsBoolean()
  canExport?: boolean;

  @IsOptional()
  @IsEnum(ScreenshotPolicy)
  screenshotPolicy?: ScreenshotPolicy;

  @IsOptional()
  @IsEnum(RecordPolicy)
  recordPolicy?: RecordPolicy;

  @IsOptional()
  @IsString()
  expiryAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  viewLimit?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  watermarkMode?: string | null;

  @IsOptional()
  @IsBoolean()
  aiAccessAllowed?: boolean | null;

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown> | null;

  @IsUUID()
  createdByIdentityId!: string;
}
