import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

import {
  PRIVATE_NOTE_MAX_LENGTH,
  normalizePrivateNote,
} from "../../../common/utils/private-note.util";

export const RELATIONSHIP_NOTES_MAX_LENGTH = PRIVATE_NOTE_MAX_LENGTH;

export class UpdateRelationshipDto {
  @IsOptional()
  @Transform(({ value }) => normalizePrivateNote(value))
  @IsString()
  @MaxLength(RELATIONSHIP_NOTES_MAX_LENGTH)
  notes?: string | null;
}