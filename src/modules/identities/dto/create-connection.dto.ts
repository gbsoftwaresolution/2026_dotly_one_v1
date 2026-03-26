import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { ConnectionStatus } from "../../../common/enums/connection-status.enum";
import { ConnectionType } from "../../../common/enums/connection-type.enum";
import { RelationshipType } from "../../../common/enums/relationship-type.enum";
import { TrustState } from "../../../common/enums/trust-state.enum";
import type {
  ConnectionMetadata,
  RelationshipMetadata,
} from "../identity.types";
import {
  IDENTITY_NOTE_MAX_LENGTH,
  TrimNullableString,
} from "./identity-dto.shared";

export class CreateConnectionDto {
  @IsUUID()
  sourceIdentityId!: string;

  @IsUUID()
  targetIdentityId!: string;

  @IsEnum(ConnectionType)
  connectionType!: ConnectionType;

  @IsEnum(TrustState)
  trustState!: TrustState;

  @IsOptional()
  @IsEnum(RelationshipType)
  relationshipType?: RelationshipType | null;

  @IsEnum(ConnectionStatus)
  status!: ConnectionStatus;

  @IsUUID()
  createdByIdentityId!: string;

  @IsOptional()
  @TrimNullableString()
  @IsString()
  @MaxLength(IDENTITY_NOTE_MAX_LENGTH)
  note?: string | null;

  @IsOptional()
  @IsObject()
  metadataJson?: ConnectionMetadata | null;

  @IsOptional()
  @IsObject()
  relationshipMetadataJson?: RelationshipMetadata | null;
}
