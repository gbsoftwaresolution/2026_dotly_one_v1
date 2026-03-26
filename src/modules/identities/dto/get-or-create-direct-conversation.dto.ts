import { IsEnum, IsUUID } from "class-validator";

import { ConversationType } from "../identity.types";

export class GetOrCreateDirectConversationDto {
  @IsUUID()
  sourceIdentityId!: string;

  @IsUUID()
  targetIdentityId!: string;

  @IsUUID()
  connectionId!: string;

  @IsUUID()
  createdByIdentityId!: string;

  @IsEnum(ConversationType)
  conversationType!: ConversationType;
}
