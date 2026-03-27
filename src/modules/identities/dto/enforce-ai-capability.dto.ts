import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from "class-validator";

import { AIExecutionContext, AICapability } from "../ai-permission";
import { RiskSeverity, RiskSignal } from "../risk-engine";

class PreviewRiskSignalRecordDto {
  @IsEnum(RiskSignal)
  signal!: RiskSignal;

  @IsEnum(RiskSeverity)
  severity!: RiskSeverity;
}

export class EnforceAICapabilityDto {
  @IsUUID()
  conversationId!: string;

  @IsOptional()
  @IsUUID()
  currentUserId?: string;

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
