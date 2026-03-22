import { IsEnum, IsOptional, IsUUID } from "class-validator";

import { ContactRequestSourceType } from "../../../common/enums/contact-request-source-type.enum";

export class CreatePublicInstantConnectDto {
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsEnum(ContactRequestSourceType)
  source?: ContactRequestSourceType;
}