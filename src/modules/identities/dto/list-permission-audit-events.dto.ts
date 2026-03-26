import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

import { PermissionAuditEventType } from "../permission-audit";

export class ListPermissionAuditEventsDto {
  @IsOptional()
  @IsEnum(PermissionAuditEventType)
  eventType?: PermissionAuditEventType;

  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsUUID()
  actorIdentityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
