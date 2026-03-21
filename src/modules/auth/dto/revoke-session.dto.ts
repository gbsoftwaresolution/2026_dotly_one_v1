import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class RevokeSessionDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  sessionId!: string;
}
