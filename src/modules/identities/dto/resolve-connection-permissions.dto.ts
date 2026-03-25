import { IsBoolean, IsOptional, IsUUID } from "class-validator";

export class ResolveConnectionPermissionsDto {
  @IsUUID()
  connectionId!: string;

  @IsOptional()
  @IsBoolean()
  persistSnapshot?: boolean;
}
