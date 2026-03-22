import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

import { ContactRequestSourceType } from "../../../common/enums/contact-request-source-type.enum";

export class ListContactsQueryDto {
  @IsOptional()
  @IsEnum(ContactRequestSourceType)
  sourceType?: ContactRequestSourceType;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }

    return value;
  })
  @IsBoolean()
  recent?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  })
  @IsString()
  @MaxLength(120)
  q?: string;
}
