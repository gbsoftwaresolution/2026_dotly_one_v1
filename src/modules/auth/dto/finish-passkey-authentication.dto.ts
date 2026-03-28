import { Transform } from "class-transformer";
import { IsObject } from "class-validator";

export class FinishPasskeyAuthenticationDto {
  @Transform(({ value }) => value)
  @IsObject()
  response!: Record<string, unknown>;
}
