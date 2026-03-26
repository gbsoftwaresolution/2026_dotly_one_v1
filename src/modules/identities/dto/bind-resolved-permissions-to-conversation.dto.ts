import { IsUUID } from "class-validator";

export class BindResolvedPermissionsToConversationDto {
  @IsUUID()
  conversationId!: string;
}
