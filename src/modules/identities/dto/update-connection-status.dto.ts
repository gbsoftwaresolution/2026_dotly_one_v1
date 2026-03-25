import { IsEnum, IsUUID } from "class-validator";

import { ConnectionStatus } from "../../../common/enums/connection-status.enum";

export class UpdateConnectionStatusDto {
  @IsUUID()
  connectionId!: string;

  @IsEnum(ConnectionStatus)
  status!: ConnectionStatus;
}
