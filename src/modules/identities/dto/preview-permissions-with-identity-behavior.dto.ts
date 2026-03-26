import { IsEnum, IsOptional } from "class-validator";

import { ConnectionType } from "../../../common/enums/connection-type.enum";
import { IdentityType } from "../../../common/enums/identity-type.enum";
import { TrustState } from "../../../common/enums/trust-state.enum";

export class PreviewPermissionsWithIdentityBehaviorDto {
  @IsEnum(IdentityType)
  sourceIdentityType!: IdentityType;

  @IsOptional()
  @IsEnum(IdentityType)
  targetIdentityType?: IdentityType | null;

  @IsEnum(ConnectionType)
  connectionType!: ConnectionType;

  @IsEnum(TrustState)
  trustState!: TrustState;
}
