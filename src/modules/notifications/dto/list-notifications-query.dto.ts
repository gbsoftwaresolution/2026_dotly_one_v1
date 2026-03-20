import { IsInt, IsOptional, Max, Min } from "class-validator";

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
