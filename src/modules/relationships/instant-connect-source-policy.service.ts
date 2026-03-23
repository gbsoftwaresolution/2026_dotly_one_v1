import { BadRequestException, Injectable } from "@nestjs/common";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { EventsService } from "../events/events.service";

@Injectable()
export class InstantConnectSourcePolicyService {
  constructor(private readonly eventsService: EventsService) {}

  async assertSourceAccess(
    userId: string,
    actorPersonaId: string,
    targetPersonaId: string,
    source: ContactRequestSourceType | undefined,
    eventId?: string,
  ): Promise<void> {
    if (source === ContactRequestSourceType.Qr) {
      throw new BadRequestException(
        "QR provenance requires scanning a QR code",
      );
    }

    if (source !== ContactRequestSourceType.Event) {
      if (eventId) {
        throw new BadRequestException(
          "eventId is only allowed for event instant connect",
        );
      }

      return;
    }

    if (!eventId) {
      throw new BadRequestException("Event source requires an event id");
    }

    await this.eventsService.validateEventRequestAccess(
      userId,
      eventId,
      actorPersonaId,
      targetPersonaId,
    );
  }
}