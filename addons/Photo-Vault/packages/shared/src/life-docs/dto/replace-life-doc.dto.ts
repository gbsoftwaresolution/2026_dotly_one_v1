import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import {
  LifeDocReminderSetting,
  LifeDocVisibility,
} from "../life-docs.types";

export class ReplaceLifeDocDto {
  @IsUUID()
  mediaId!: string;

  // Optional overrides when replacing.
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  issuingAuthority?: string;

  @IsOptional()
  @IsString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsEnum(LifeDocReminderSetting)
  reminderSetting?: LifeDocReminderSetting;

  @IsOptional()
  @IsEnum(LifeDocVisibility)
  visibility?: LifeDocVisibility;
}
