import {
  IsEnum,
  IsBoolean,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

import { RecordPolicy, ScreenshotPolicy } from "../identity.types";
import { TrimNullableString } from "./identity-dto.shared";

export class SetContentAccessRuleDto {
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

  @IsUUID()
  createdByIdentityId!: string;
}
