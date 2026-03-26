import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateNested,
} from "class-validator";

import {
  PermissionDebugVerbosity,
  type PermissionExplainRequest,
} from "../permission-debug";
import { ALL_PERMISSION_KEYS, type PermissionKey } from "../permission-keys";
import { RiskSeverity, RiskSignal } from "../risk-engine";

class ExplainRiskSignalRecordDto {
  @IsEnum(RiskSignal)
  signal!: RiskSignal;

  @IsEnum(RiskSeverity)
  severity!: RiskSeverity;
}

export class ExplainResolvedPermissionDto implements PermissionExplainRequest {
  @IsUUID()
  connectionId!: string;

  @IsIn(ALL_PERMISSION_KEYS)
  permissionKey!: PermissionKey;

  @IsOptional()
  @IsBoolean()
  applyRiskOverlay?: boolean;

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ExplainRiskSignalRecordDto)
  previewRiskSignals?: ExplainRiskSignalRecordDto[];

  @IsOptional()
  @IsEnum(PermissionDebugVerbosity)
  verbosity?: PermissionDebugVerbosity;
}
