import { IsEnum, IsUUID } from "class-validator";

import { ConversationStatus } from "../identity.types";

export class UpdateConversationStatusDto {
  @IsUUID()
  conversationId!: string;

  @IsEnum(ConversationStatus)
  status!: ConversationStatus;
}
