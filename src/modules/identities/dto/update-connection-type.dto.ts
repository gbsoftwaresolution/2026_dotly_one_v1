import { IsEnum, IsUUID } from "class-validator";

import { ConnectionType } from "../../../common/enums/connection-type.enum";

export class UpdateConnectionTypeDto {
  @IsUUID()
  connectionId!: string;

  @IsEnum(ConnectionType)
  connectionType!: ConnectionType;
}
