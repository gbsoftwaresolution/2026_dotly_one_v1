import { IsUUID } from "class-validator";

export class PreviewResolvedPermissionsForConnectionDto {
  @IsUUID()
  connectionId!: string;
}
