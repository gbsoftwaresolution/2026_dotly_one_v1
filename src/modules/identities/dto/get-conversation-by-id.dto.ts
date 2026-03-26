import { IsUUID } from "class-validator";

export class GetConversationByIdDto {
  @IsUUID()
  conversationId!: string;
}
