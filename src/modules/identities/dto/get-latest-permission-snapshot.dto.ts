import { IsUUID } from "class-validator";

export class GetLatestPermissionSnapshotDto {
  @IsUUID()
  connectionId!: string;
}
