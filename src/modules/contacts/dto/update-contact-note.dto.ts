import { Transform } from "class-transformer";
import { IsString, MaxLength, ValidateIf } from "class-validator";

import {
  PRIVATE_NOTE_MAX_LENGTH,
  normalizePrivateNote,
} from "../../../common/utils/private-note.util";

export class UpdateContactNoteDto {
  @Transform(({ value }) => normalizePrivateNote(value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(PRIVATE_NOTE_MAX_LENGTH)
  note!: string | null;
}
