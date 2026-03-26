import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { ConnectionType } from "../../../common/enums/connection-type.enum";
import { IdentityType } from "../../../common/enums/identity-type.enum";
import { PermissionEffect } from "../../../common/enums/permission-effect.enum";
import { TrustState } from "../../../common/enums/trust-state.enum";
import { RiskSeverity, RiskSignal } from "../risk-engine";
import { RecordPolicy, ScreenshotPolicy } from "../identity.types";
import type { PermissionKey } from "../permission-keys";
import { TrimNullableString, TrimString } from "./identity-dto.shared";

class PreviewContentManualOverrideDto {
  @IsEnum(PermissionEffect)
  effect!: PermissionEffect;

  @TrimString()
  @IsString()
  permissionKey!: PermissionKey;
}

class PreviewContentRiskSignalRecordDto {
  @IsEnum(RiskSignal)
  signal!: RiskSignal;

  @IsEnum(RiskSeverity)
  severity!: RiskSeverity;
}

class PreviewContentAccessRuleDto {
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
  @IsDateString()
  expiryAt?: string | null;

  @IsOptional()
  @Min(0)
  viewLimit?: number | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(64)
  watermarkMode?: string | null;

  @IsOptional()
  @IsBoolean()
  aiAccessAllowed?: boolean | null;

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown> | null;
}

export class PreviewContentPermissionsDto {
  @IsOptional()
  @IsEnum(IdentityType)
  sourceIdentityType?: IdentityType | null;

  @IsEnum(ConnectionType)
  connectionType!: ConnectionType;

  @IsEnum(TrustState)
  trustState!: TrustState;

  @IsUUID()
  contentId!: string;

  @IsUUID()
  targetIdentityId!: string;

  @IsOptional()
  @Min(0)
  currentViewCount?: number;

  @IsOptional()
  @IsBoolean()
  applyRiskOverlay?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewContentManualOverrideDto)
  manualOverrides?: PreviewContentManualOverrideDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewContentRiskSignalRecordDto)
  previewRiskSignals?: PreviewContentRiskSignalRecordDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PreviewContentAccessRuleDto)
  contentRule?: PreviewContentAccessRuleDto | null;
}
