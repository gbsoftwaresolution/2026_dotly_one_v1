import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, IsUUID, Length, MaxLength } from "class-validator";

export class VerifyMobileOtpDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @IsUUID()
  challengeId!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;
}
