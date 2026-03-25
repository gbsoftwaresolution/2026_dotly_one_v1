import { IsEnum, IsOptional } from "class-validator";

import { ConnectionType } from "../../../common/enums/connection-type.enum";
import { IdentityType } from "../../../common/enums/identity-type.enum";

export class GetConnectionPolicyTemplateDto {
  @IsOptional()
  @IsEnum(IdentityType)
  sourceIdentityType?: IdentityType | null;

  @IsEnum(ConnectionType)
  connectionType!: ConnectionType;
}
