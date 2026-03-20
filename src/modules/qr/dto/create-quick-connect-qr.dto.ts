import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class CreateQuickConnectQrDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  durationHours!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUses?: number;
}
