import { Transform } from "class-transformer";
import { IsString, MaxLength, ValidateIf } from "class-validator";

export class UpdateContactNoteDto {
  @Transform(({ value }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  note!: string | null;
}
