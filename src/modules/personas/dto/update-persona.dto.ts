import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

import { PersonaAccessMode } from "../../../common/enums/persona-access-mode.enum";
import { PersonaType } from "../../../common/enums/persona-type.enum";
import {
  PERSONA_ROUTING_DISPLAY_NAME_MAX_LENGTH,
  PERSONA_ROUTING_KEY_MAX_LENGTH,
  PERSONA_ROUTING_KEY_PATTERN,
  normalizePersonaRoutingDisplayName,
  normalizePersonaRoutingKey,
} from "../persona-routing";

function trimNullableString(value: unknown): unknown {
  if (value === null || typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export class UpdatePersonaDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  identityId?: string;

  @IsOptional()
  @IsEnum(PersonaType)
  type?: PersonaType;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  jobTitle?: string;

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
  @Transform(({ value }) =>
    value === null || typeof value === "string"
      ? (() => {
          if (value === null) {
            return null;
          }

          const trimmedValue = value.trim();
          return trimmedValue.length > 0 ? trimmedValue : null;
        })()
      : value,
  )
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  profilePhotoUrl?: string | null;

  @IsOptional()
  @IsEnum(PersonaAccessMode)
  accessMode?: PersonaAccessMode;

  @IsOptional()
  @IsBoolean()
  verifiedOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @Transform(({ value }) => normalizePersonaRoutingKey(value))
  @IsString()
  @Matches(PERSONA_ROUTING_KEY_PATTERN, {
    message:
      "routingKey may only contain lowercase letters, numbers, hyphens, and underscores",
  })
  @MaxLength(PERSONA_ROUTING_KEY_MAX_LENGTH)
  routingKey?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizePersonaRoutingDisplayName(value))
  @IsString()
  @MaxLength(PERSONA_ROUTING_DISPLAY_NAME_MAX_LENGTH)
  routingDisplayName?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefaultRouting?: boolean;

  @IsOptional()
  @IsObject()
  routingRulesJson?: Record<string, unknown> | null;
}
