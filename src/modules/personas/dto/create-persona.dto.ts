import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  IsUUID,
  ValidateIf,
} from "class-validator";

import { PersonaAccessMode } from "../../../common/enums/persona-access-mode.enum";
import { PersonaType } from "../../../common/enums/persona-type.enum";
import {
  PERSONA_USERNAME_MAX_LENGTH,
  PERSONA_USERNAME_MIN_LENGTH,
  PERSONA_USERNAME_PATTERN,
  PERSONA_USERNAME_STANDARD_MIN_LENGTH,
  normalizePersonaUsername,
} from "../persona-username";

function trimNullableString(value: unknown): unknown {
  if (value === null || typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export class CreatePersonaDto {
  @IsOptional()
  @IsUUID()
  identityId?: string;

  @IsEnum(PersonaType)
  type!: PersonaType;

  @Transform(({ value }) => normalizePersonaUsername(value))
  @IsString()
  @MinLength(PERSONA_USERNAME_MIN_LENGTH)
  @Matches(PERSONA_USERNAME_PATTERN)
  @MinLength(PERSONA_USERNAME_STANDARD_MIN_LENGTH, {
    message:
      "Standard usernames require at least 6 characters. Shorter usernames are reserved for premium claims.",
  })
  @MaxLength(PERSONA_USERNAME_MAX_LENGTH)
  username!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  jobTitle!: string;

  @IsOptional()
  @Transform(({ value }) => trimNullableString(value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  companyName?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimNullableString(value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  tagline?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimNullableString(value))
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  websiteUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  profilePhotoUrl?: string | null;

  @IsEnum(PersonaAccessMode)
  accessMode!: PersonaAccessMode;

  @IsOptional()
  @IsBoolean()
  verifiedOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  routingKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  routingDisplayName?: string;

  @IsOptional()
  @IsBoolean()
  isDefaultRouting?: boolean;

  @IsOptional()
  @IsObject()
  routingRulesJson?: Record<string, unknown> | null;
}
