import { IsEnum, IsObject, IsOptional, IsUUID, Min } from "class-validator";

import { ActionType } from "../action-permission";

export class EnforceActionDto {
  @IsUUID()
  conversationId!: string;

  @IsUUID()
  actorIdentityId!: string;

  @IsEnum(ActionType)
  actionType!: ActionType;

  @IsOptional()
  @IsUUID()
  contentId?: string;

  @IsOptional()
  @Min(0)
  currentViewCount?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
