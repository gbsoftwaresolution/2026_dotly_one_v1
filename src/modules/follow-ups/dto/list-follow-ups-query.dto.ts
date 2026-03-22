import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsUUID } from "class-validator";

import { FollowUpStatus } from "../../../common/enums/follow-up-status.enum";

import { toBooleanQueryValue } from "./follow-up-dto.shared";

export class ListFollowUpsQueryDto {
  @IsOptional()
  @IsEnum(FollowUpStatus)
  status?: FollowUpStatus;

  @IsOptional()
  @IsUUID()
  relationshipId?: string;

  @IsOptional()
  @Transform(({ value }) => toBooleanQueryValue(value))
  @IsBoolean()
  upcoming?: boolean | "true" | "false";
}