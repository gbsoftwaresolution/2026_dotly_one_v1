import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { ConversationStatus, ConversationType } from "../identity.types";
import { TrimNullableString } from "./identity-dto.shared";

export class CreateConversationDto {
  @IsUUID()
  sourceIdentityId!: string;

  @IsUUID()
  targetIdentityId!: string;

  @IsUUID()
  connectionId!: string;

  @IsEnum(ConversationType)
  conversationType!: ConversationType;

  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(160)
  title?: string | null;

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown> | null;

  @IsUUID()
  createdByIdentityId!: string;
}
