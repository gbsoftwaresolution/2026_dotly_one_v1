import { BadRequestException, Injectable } from "@nestjs/common";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { EventsService } from "../events/events.service";

import { CreateContactRequestDto } from "./dto/create-contact-request.dto";

@Injectable()
export class ContactRequestSourcePolicyService {
  constructor(
    private readonly eventsService: EventsService,
  ) {}

  async assertSourceAccess(
    userId: string,
    fromPersonaId: string,
    targetPersonaId: string,
    createContactRequestDto: CreateContactRequestDto,
  ): Promise<void> {
    if (createContactRequestDto.sourceType !== ContactRequestSourceType.Event) {
      return;
    }

    if (!createContactRequestDto.sourceId) {
      throw new BadRequestException("Event source requires an event id");
    }

    await this.eventsService.validateEventRequestAccess(
      userId,
      createContactRequestDto.sourceId,
      fromPersonaId,
      targetPersonaId,
    );
  }
}
