import { IsEnum, IsOptional, IsUUID } from "class-validator";

import { ConversationStatus } from "../identity.types";

export class UpdateConversationStatusDto {
  @IsUUID()
  conversationId!: string;

  @IsOptional()
  @IsUUID()
  currentUserId?: string;

  @IsEnum(ConversationStatus)
  status!: ConversationStatus;
}
