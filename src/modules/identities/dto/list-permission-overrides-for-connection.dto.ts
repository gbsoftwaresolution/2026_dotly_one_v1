import { IsUUID } from "class-validator";

export class ListPermissionOverridesForConnectionDto {
  @IsUUID()
  connectionId!: string;
}
