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

export class CreateLifeDocDto {
  @IsUUID()
  mediaId!: string;

  @IsEnum(LifeDocCategory)
  category!: LifeDocCategory;

  @IsEnum(LifeDocSubcategory)
  subcategory!: LifeDocSubcategory;

  // Required when subcategory === CUSTOM
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  customSubcategory?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  issuingAuthority?: string;

  // ISO date string (YYYY-MM-DD). Stored as DateTime internally.
  @IsOptional()
  @IsString()
  issueDate?: string;

  // ISO date string (YYYY-MM-DD). Stored as DateTime internally.
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
