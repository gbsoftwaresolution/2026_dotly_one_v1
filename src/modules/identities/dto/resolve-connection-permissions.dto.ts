import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from "class-validator";

import { RiskSeverity, RiskSignal } from "../risk-engine";

class ResolveRiskSignalRecordDto {
  @IsEnum(RiskSignal)
  signal!: RiskSignal;

  @IsEnum(RiskSeverity)
  severity!: RiskSeverity;
}

export class ResolveConnectionPermissionsDto {
  @IsUUID()
  connectionId!: string;

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

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ResolveRiskSignalRecordDto)
  previewRiskSignals?: ResolveRiskSignalRecordDto[];
}
