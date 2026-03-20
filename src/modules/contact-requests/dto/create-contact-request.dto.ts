import { Transform } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { ContactRequestSourceType } from "../../../common/enums/contact-request-source-type.enum";

export class CreateContactRequestDto {
  @IsUUID()
  toPersonaId!: string;

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
