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
  ): Promise<{
    sourceType: ContactRequestSourceType;
    sourceId: string | null;
  }> {
    if (createContactRequestDto.sourceType === ContactRequestSourceType.Qr) {
      throw new BadRequestException(
        "QR provenance requires scanning a QR code",
      );
    }

    if (createContactRequestDto.sourceType === ContactRequestSourceType.Profile) {
      if (createContactRequestDto.sourceId) {
        throw new BadRequestException(
          "Profile requests cannot carry a custom source id",
        );
      }

      return {
        sourceType: ContactRequestSourceType.Profile,
        sourceId: null,
      };
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

    return {
      sourceType: ContactRequestSourceType.Event,
      sourceId: createContactRequestDto.sourceId,
    };
  }
}
