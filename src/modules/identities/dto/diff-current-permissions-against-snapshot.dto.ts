import { IsBoolean, IsOptional, IsUUID } from "class-validator";

export class DiffCurrentPermissionsAgainstSnapshotDto {
  @IsUUID()
  connectionId!: string;

  @IsOptional()
  @IsBoolean()
  applyRiskOverlay?: boolean;

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}
