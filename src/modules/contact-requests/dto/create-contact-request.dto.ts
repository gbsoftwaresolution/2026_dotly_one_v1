import { Transform } from "class-transformer";
import {
  Matches,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { ContactRequestSourceType } from "../../../common/enums/contact-request-source-type.enum";
import {
  PERSONA_USERNAME_MAX_LENGTH,
  PERSONA_USERNAME_PATTERN,
  normalizePersonaUsername,
} from "../../personas/persona-username";

export class CreateContactRequestDto {
  @IsOptional()
  @IsUUID()
  toPersonaId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const normalizedValue = normalizePersonaUsername(value);
    return typeof normalizedValue === "string" && normalizedValue.length > 0
      ? normalizedValue
      : null;
  })
  @IsString()
  @Matches(PERSONA_USERNAME_PATTERN)
  @MaxLength(PERSONA_USERNAME_MAX_LENGTH)
  toUsername?: string | null;

  @IsUUID()
  fromPersonaId!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  })
  @IsString()
  @MaxLength(280)
  reason?: string | null;

  @IsEnum(ContactRequestSourceType)
  sourceType!: ContactRequestSourceType;

  @IsOptional()
  @IsUUID()
  sourceId?: string | null;
}
