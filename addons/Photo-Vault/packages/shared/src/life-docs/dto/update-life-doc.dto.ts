import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  LifeDocAccessRole,
  LifeDocCategory,
  LifeDocReminderSetting,
  LifeDocSubcategory,
  LifeDocVisibility,
} from "../life-docs.types";

class LifeDocAccessMemberDto {
  @IsUUID()
  userId!: string;

  @IsEnum(LifeDocAccessRole)
  role!: LifeDocAccessRole;
}

class LifeDocAccessRolesDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LifeDocAccessMemberDto)
  sharedMembers?: LifeDocAccessMemberDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LifeDocAccessMemberDto)
  guardians?: LifeDocAccessMemberDto[];

  @IsOptional()
  @IsBoolean()
  notifySharedMembers?: boolean;
}

export class UpdateLifeDocDto {
  @IsOptional()
  @IsEnum(LifeDocCategory)
  category?: LifeDocCategory;

  @IsOptional()
  @IsEnum(LifeDocSubcategory)
  subcategory?: LifeDocSubcategory;

  // Allowed only when subcategory === CUSTOM (or document is already CUSTOM)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  customSubcategory?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
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
  @IsBoolean()
  renewalRequired?: boolean;

  @IsOptional()
  @IsEnum(LifeDocReminderSetting)
  reminderSetting?: LifeDocReminderSetting;

  @IsOptional()
  @IsEnum(LifeDocVisibility)
  visibility?: LifeDocVisibility;

  @IsOptional()
  @ValidateNested()
  @Type(() => LifeDocAccessRolesDto)
  accessRoles?: LifeDocAccessRolesDto;
}
