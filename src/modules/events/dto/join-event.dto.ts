import { IsEnum, IsIn, IsOptional, IsUUID } from "class-validator";

import { EventParticipantRole } from "../../../common/enums/event-participant-role.enum";

export class JoinEventDto {
  @IsUUID()
  personaId!: string;

  @IsOptional()
  @IsEnum(EventParticipantRole)
  @IsIn([EventParticipantRole.Attendee])
  role?: EventParticipantRole;
}
