import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  ValidateNested,
} from "class-validator";

import { ConnectionType } from "../../../common/enums/connection-type.enum";
import { IdentityType } from "../../../common/enums/identity-type.enum";
import { PermissionEffect } from "../../../common/enums/permission-effect.enum";
import { TrustState } from "../../../common/enums/trust-state.enum";
import { RiskSeverity, RiskSignal } from "../risk-engine";
import type { PermissionKey } from "../permission-keys";

class PreviewRiskSignalRecordDto {
  @IsEnum(RiskSignal)
  signal!: RiskSignal;

  @IsEnum(RiskSeverity)
  severity!: RiskSeverity;
}

class PreviewManualOverrideDto {
  @IsEnum(PermissionEffect)
  effect!: PermissionEffect;

  permissionKey!: PermissionKey;
}

export class PreviewPermissionsWithRiskDto {
  @IsOptional()
  @IsEnum(IdentityType)
  sourceIdentityType?: IdentityType | null;

  @IsEnum(ConnectionType)
  connectionType!: ConnectionType;

  @IsEnum(TrustState)
  trustState!: TrustState;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewManualOverrideDto)
  manualOverrides?: PreviewManualOverrideDto[];

  @IsOptional()
  @IsBoolean()
  applyRiskOverlay?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewRiskSignalRecordDto)
  previewRiskSignals?: PreviewRiskSignalRecordDto[];
}
