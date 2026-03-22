import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

import {
  IsFutureDateString,
  toTrimmedNullableString,
} from "./follow-up-dto.shared";

export class UpdateFollowUpDto {
  @IsOptional()
  @IsFutureDateString()
  remindAt?: string;

  @IsOptional()
  @Transform(({ value }) => toTrimmedNullableString(value))
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}