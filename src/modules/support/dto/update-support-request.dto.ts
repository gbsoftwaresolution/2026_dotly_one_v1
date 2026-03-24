import { Transform } from "class-transformer";
import { IsIn } from "class-validator";

export class UpdateSupportRequestDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsIn(["open", "resolved"])
  status!: "open" | "resolved";
}
