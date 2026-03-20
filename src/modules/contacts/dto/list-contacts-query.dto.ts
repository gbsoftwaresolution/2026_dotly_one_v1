import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

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

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  })
  @IsString()
  @MaxLength(120)
  q?: string;
}
