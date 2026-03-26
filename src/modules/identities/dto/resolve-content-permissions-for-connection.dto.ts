import { IsBoolean, IsOptional, IsUUID, Min } from "class-validator";

export class ResolveContentPermissionsForConnectionDto {
  @IsUUID()
  connectionId!: string;

  @IsUUID()
  contentId!: string;

  @IsUUID()
  targetIdentityId!: string;

  @IsOptional()
  @Min(0)
  currentViewCount?: number;

  @IsOptional()
  @IsBoolean()
  persistSnapshot?: boolean;
}
