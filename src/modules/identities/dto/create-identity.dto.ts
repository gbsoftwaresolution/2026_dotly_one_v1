import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { IdentityType } from "../../../common/enums/identity-type.enum";
import type { IdentityMetadata } from "../identity.types";

import {
  IDENTITY_DISPLAY_NAME_MAX_LENGTH,
  IDENTITY_HANDLE_MAX_LENGTH,
  IDENTITY_STATUS_MAX_LENGTH,
  IDENTITY_VERIFICATION_LEVEL_MAX_LENGTH,
  TrimNullableLowercaseString,
  TrimString,
} from "./identity-dto.shared";

export class CreateIdentityDto {
  @IsOptional()
  @IsUUID()
  personId?: string;

  @IsEnum(IdentityType)
  identityType!: IdentityType;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(IDENTITY_DISPLAY_NAME_MAX_LENGTH)
  displayName!: string;

  @IsOptional()
  @TrimNullableLowercaseString()
  @IsString()
  @MaxLength(IDENTITY_HANDLE_MAX_LENGTH)
  handle?: string | null;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(IDENTITY_VERIFICATION_LEVEL_MAX_LENGTH)
  verificationLevel!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(IDENTITY_STATUS_MAX_LENGTH)
  status!: string;

  @IsOptional()
  @IsObject()
  metadataJson?: IdentityMetadata | null;
}
