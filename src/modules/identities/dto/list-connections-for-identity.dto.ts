import { IsEnum, IsOptional, IsUUID } from "class-validator";

import { ConnectionStatus } from "../../../common/enums/connection-status.enum";

export class ListConnectionsForIdentityDto {
  @IsUUID()
  identityId!: string;

  @IsOptional()
  @IsEnum(ConnectionStatus)
  status?: ConnectionStatus;
}
