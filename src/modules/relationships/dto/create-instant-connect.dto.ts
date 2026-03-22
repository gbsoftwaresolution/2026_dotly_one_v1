import { IsEnum, IsOptional, IsUUID } from "class-validator";

import { ContactRequestSourceType } from "../../../common/enums/contact-request-source-type.enum";

export class CreateInstantConnectDto {
  @IsUUID()
  targetPersonaId!: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsEnum(ContactRequestSourceType)
  source?: ContactRequestSourceType;
}