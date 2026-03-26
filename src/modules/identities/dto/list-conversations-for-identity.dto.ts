import { IsEnum, IsOptional, IsUUID } from "class-validator";

import { ConversationStatus } from "../identity.types";

export class ListConversationsForIdentityDto {
  @IsUUID()
  identityId!: string;

  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;
}
