import { IsUUID } from "class-validator";

export class ResolveConversationContextDto {
  @IsUUID()
  conversationId!: string;
}
