import { Transform } from "class-transformer";
import {
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

import { AgencyProfileStatus } from "../../../common/enums/agency-profile-status.enum";

import {
  AGENCY_SLUG_MAX_LENGTH,
  AGENCY_SLUG_PATTERN,
  normalizeAgencySlug,
} from "../agency-slug";

export class UpdateAgencyProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? normalizeAgencySlug(value) : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(AGENCY_SLUG_MAX_LENGTH)
  @Matches(AGENCY_SLUG_PATTERN)
  slug?: string;

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
  @MaxLength(160)
  tagline?: string | null;

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
  @MaxLength(5000)
  description?: string | null;

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
  logoUrl?: string | null;

  @IsOptional()
  @IsEnum(AgencyProfileStatus)
  status?: AgencyProfileStatus;
}
