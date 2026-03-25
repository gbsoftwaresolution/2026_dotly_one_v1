import { IsEnum, IsUUID } from "class-validator";

import { TrustState } from "../../../common/enums/trust-state.enum";

export class UpdateTrustStateDto {
  @IsUUID()
  connectionId!: string;

  @IsEnum(TrustState)
  trustState!: TrustState;
}
