import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { PermissionEffect } from "../../../common/enums/permission-effect.enum";
import type { PermissionLimits } from "../identity.types";
import type { PermissionKey } from "../permission-keys";
import {
  IDENTITY_REASON_MAX_LENGTH,
  PERMISSION_KEY_MAX_LENGTH,
  TrimNullableString,
  TrimString,
} from "./identity-dto.shared";

export class SetPermissionOverrideDto {
  @IsUUID()
  connectionId!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PERMISSION_KEY_MAX_LENGTH)
  permissionKey!: PermissionKey;

  @IsEnum(PermissionEffect)
  effect!: PermissionEffect;

  @IsOptional()
  @IsObject()
  limitsJson?: PermissionLimits | null;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(IDENTITY_REASON_MAX_LENGTH)
  reason?: string | null;

  @IsUUID()
  createdByIdentityId!: string;
}
