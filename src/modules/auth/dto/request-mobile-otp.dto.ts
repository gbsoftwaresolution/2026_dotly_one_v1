import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class RequestMobileOtpDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;
}
