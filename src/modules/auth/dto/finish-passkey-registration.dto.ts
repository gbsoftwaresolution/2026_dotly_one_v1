import { Transform } from "class-transformer";
import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class FinishPasskeyRegistrationDto {
  @Transform(({ value }) => value)
  @IsObject()
  response!: Record<string, unknown>;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
