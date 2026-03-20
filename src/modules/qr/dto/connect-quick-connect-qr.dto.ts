import { IsUUID } from "class-validator";

export class ConnectQuickConnectQrDto {
  @IsUUID()
  fromPersonaId!: string;
}
