import { Transform } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

import {
  IsFutureDateString,
  toTrimmedNullableString,
  toTrimmedString,
} from "./follow-up-dto.shared";
import {
  FOLLOW_UP_PRESETS,
  type FollowUpPreset,
} from "../follow-up-preset.util";

export class CreateFollowUpDto {
  @IsUUID()
  relationshipId!: string;

  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsIn(FOLLOW_UP_PRESETS)
  preset?: FollowUpPreset;

  @Transform(({ value }) => toTrimmedString(value))
  @ValidateIf(
    (object: CreateFollowUpDto) =>
      object.customDate !== undefined ||
      (object.preset === undefined && object.remindAt === undefined),
  )
  @IsFutureDateString()
  customDate?: string;

  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsFutureDateString()
  remindAt?: string;

  @IsOptional()
  @Transform(({ value }) => toTrimmedNullableString(value))
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}