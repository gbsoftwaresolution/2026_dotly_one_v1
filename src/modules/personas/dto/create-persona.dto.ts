import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

import { PersonaAccessMode } from "../../../common/enums/persona-access-mode.enum";
import { PersonaType } from "../../../common/enums/persona-type.enum";
import {
  PERSONA_USERNAME_MAX_LENGTH,
  PERSONA_USERNAME_MIN_LENGTH,
  PERSONA_USERNAME_PATTERN,
  normalizePersonaUsername,
} from "../persona-username";

export class CreatePersonaDto {
  @IsEnum(PersonaType)
  type!: PersonaType;

  @Transform(({ value }) => normalizePersonaUsername(value))
  @IsString()
  @MinLength(PERSONA_USERNAME_MIN_LENGTH)
  @Matches(PERSONA_USERNAME_PATTERN)
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

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(120)
  companyName!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(160)
  tagline!: string;

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
}
