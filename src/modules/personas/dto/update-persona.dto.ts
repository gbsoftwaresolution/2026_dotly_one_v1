import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

import { PersonaAccessMode } from "../../../common/enums/persona-access-mode.enum";
import { PersonaType } from "../../../common/enums/persona-type.enum";

function trimNullableString(value: unknown): unknown {
  if (value === null || typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export class UpdatePersonaDto {
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
}
