import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from "class-validator";

import { PermissionDebugVerbosity } from "../permission-debug";
import { RiskSeverity, RiskSignal } from "../risk-engine";

class ExplainPermissionsRiskSignalRecordDto {
  @IsEnum(RiskSignal)
  signal!: RiskSignal;

  @IsEnum(RiskSeverity)
  severity!: RiskSeverity;
}

export class ExplainResolvedPermissionsDto {
  @IsUUID()
  connectionId!: string;

  @IsOptional()
  @IsBoolean()
  applyRiskOverlay?: boolean;

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;

  @IsOptional()
  @IsBoolean()
  preferCache?: boolean;

  @IsOptional()
  @IsBoolean()
  preferSnapshot?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ExplainPermissionsRiskSignalRecordDto)
  previewRiskSignals?: ExplainPermissionsRiskSignalRecordDto[];

  @IsOptional()
  @IsEnum(PermissionDebugVerbosity)
  verbosity?: PermissionDebugVerbosity;
}
