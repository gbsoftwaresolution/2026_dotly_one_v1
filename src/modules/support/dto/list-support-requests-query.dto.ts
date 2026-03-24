import { Transform } from "class-transformer";
import { IsIn, IsOptional } from "class-validator";

export class ListSupportRequestsQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsIn(["open", "resolved"])
  status?: "open" | "resolved";
}
