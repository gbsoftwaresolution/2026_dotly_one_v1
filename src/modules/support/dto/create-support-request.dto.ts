import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateSupportRequestDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  name?: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  topic!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(4000)
  details!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(2048)
  challengeToken?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  website?: string;
}
