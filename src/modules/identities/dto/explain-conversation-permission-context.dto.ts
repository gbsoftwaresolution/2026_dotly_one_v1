import { IsUUID } from "class-validator";

export class ExplainConversationPermissionContextDto {
  @IsUUID()
  conversationId!: string;

  currentUserId?: string;
}
