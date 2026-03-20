import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EventParticipantRole as PrismaEventParticipantRole,
  EventStatus as PrismaEventStatus,
  Prisma,
} from "@prisma/client";

import { EventParticipantRole } from "../../common/enums/event-participant-role.enum";
import { EventStatus } from "../../common/enums/event-status.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { BlocksService } from "../blocks/blocks.service";
import { PersonasService } from "../personas/personas.service";

import { CreateEventDto } from "./dto/create-event.dto";
import { JoinEventDto } from "./dto/join-event.dto";
import { ListEventsQueryDto } from "./dto/list-events-query.dto";

const eventSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  startsAt: true,
  endsAt: true,
  location: true,
  status: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EventSelect;

const participantPersonaPreviewSelect = {
  id: true,
  fullName: true,
  jobTitle: true,
  companyName: true,
  profilePhotoUrl: true,
} satisfies Prisma.PersonaSelect;

const eventParticipantSelect = {
  id: true,
  eventId: true,
  userId: true,
  personaId: true,
  role: true,
  discoveryEnabled: true,
  joinedAt: true,
  persona: {
    select: participantPersonaPreviewSelect,
  },
} satisfies Prisma.EventParticipantSelect;

@Injectable()
export class EventsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly personasService: PersonasService,
    private readonly blocksService: BlocksService,
  ) {}

  async create(userId: string, createEventDto: CreateEventDto) {
    const startsAt = new Date(createEventDto.startsAt);
    const endsAt = new Date(createEventDto.endsAt);

    this.assertValidEventWindow(startsAt, endsAt);

    try {
      const event = await this.prismaService.event.create({
        data: {
          name: createEventDto.name.trim(),
          slug: createEventDto.slug.trim().toLowerCase(),
          description: createEventDto.description ?? null,
          startsAt,
          endsAt,
          location: createEventDto.location.trim(),
          status: toPrismaEventStatus(
            createEventDto.status ?? EventStatus.Draft,
          ),
          createdByUserId: userId,
        },
        select: eventSelect,
      });

      return toEventView(event);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Event slug already in use");
      }

      throw error;
    }
  }

  async findAll(userId: string, query: ListEventsQueryDto) {
    const events = await this.prismaService.event.findMany({
      where: query.status
        ? {
            participants: {
              some: {
                userId,
              },
            },
            status: toPrismaEventStatus(query.status),
          }
        : {
            participants: {
              some: {
                userId,
              },
            },
          },
      orderBy: {
        startsAt: "asc",
      },
      select: {
        ...eventSelect,
        participants: {
          where: {
            userId,
          },
          take: 1,
          select: {
            personaId: true,
            role: true,
            discoveryEnabled: true,
          },
        },
      },
    });

    return events.map((event) => toEventView(event));
  }

  async findOne(userId: string, eventId: string) {
    const event = await this.prismaService.event.findFirst({
      where: {
        id: eventId,
        participants: {
          some: {
            userId,
          },
        },
      },
      select: {
        ...eventSelect,
        participants: {
          where: {
            userId,
          },
          take: 1,
          select: {
            personaId: true,
            role: true,
            discoveryEnabled: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    return toEventView(event);
  }

  async join(userId: string, eventId: string, joinEventDto: JoinEventDto) {
    const event = await this.getEventOrThrow(eventId);

    const persona = await this.personasService.findOwnedPersonaIdentity(
      userId,
      joinEventDto.personaId,
    );

    try {
      await this.prismaService.eventParticipant.create({
        data: {
          eventId: event.id,
          userId,
          personaId: persona.id,
          role: toPrismaEventParticipantRole(
            joinEventDto.role ?? EventParticipantRole.Attendee,
          ),
        },
        select: eventParticipantSelect,
      });

      return this.findOne(userId, event.id);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("You have already joined this event");
      }

      throw error;
    }
  }

  async enableDiscovery(userId: string, eventId: string) {
    const event = await this.getEventOrThrow(eventId);
    this.assertDiscoveryWindowOpen(event);

    const participant = await this.getOwnedParticipant(userId, eventId);

    const updatedParticipant = await this.prismaService.eventParticipant.update(
      {
        where: {
          id: participant.id,
        },
        data: {
          discoveryEnabled: true,
        },
        select: eventParticipantSelect,
      },
    );

    return this.toParticipantView(updatedParticipant);
  }

  async disableDiscovery(userId: string, eventId: string) {
    const event = await this.getEventOrThrow(eventId);
    this.assertDiscoveryWindowOpen(event);

    const participant = await this.getOwnedParticipant(userId, eventId);

    const updatedParticipant = await this.prismaService.eventParticipant.update(
      {
        where: {
          id: participant.id,
        },
        data: {
          discoveryEnabled: false,
        },
        select: eventParticipantSelect,
      },
    );

    return this.toParticipantView(updatedParticipant);
  }

  async findVisibleParticipants(userId: string, eventId: string) {
    const event = await this.getEventOrThrow(eventId);
    this.assertDiscoveryWindowOpen(event);

    const viewerParticipant =
      await this.prismaService.eventParticipant.findFirst({
        where: {
          eventId,
          userId,
          discoveryEnabled: true,
        },
        select: {
          id: true,
        },
      });

    if (!viewerParticipant) {
      throw new ForbiddenException(
        "Enable discovery to view participants in this event",
      );
    }

    const participants = await this.prismaService.eventParticipant.findMany({
      where: {
        eventId,
        discoveryEnabled: true,
        userId: {
          not: userId,
        },
      },
      orderBy: {
        joinedAt: "asc",
      },
      select: eventParticipantSelect,
    });

    const visibleParticipants = [] as Array<
      ReturnType<EventsService["toVisibleParticipantView"]>
    >;

    for (const participant of participants) {
      const blocked = await this.isBlockedEitherWay(userId, participant.userId);

      if (blocked) {
        continue;
      }

      visibleParticipants.push(this.toVisibleParticipantView(participant));
    }

    return visibleParticipants;
  }

  async validateEventRequestAccess(
    actorUserId: string,
    eventId: string,
    targetPersonaId: string,
  ) {
    const eventParticipant =
      await this.prismaService.eventParticipant.findFirst({
        where: {
          eventId,
          userId: actorUserId,
          discoveryEnabled: true,
        },
        select: {
          id: true,
          event: {
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
            },
          },
        },
      });

    if (!eventParticipant) {
      throw new ForbiddenException(
        "Enable discovery before sending event-based requests",
      );
    }

    this.assertDiscoveryWindowOpen(eventParticipant.event);

    const targetParticipant =
      await this.prismaService.eventParticipant.findFirst({
        where: {
          eventId,
          personaId: targetPersonaId,
          discoveryEnabled: true,
        },
        select: {
          userId: true,
        },
      });

    if (!targetParticipant) {
      throw new ForbiddenException(
        "Target persona is not discoverable in this event",
      );
    }

    await this.blocksService.assertNoInteractionBlock(
      actorUserId,
      targetParticipant.userId,
    );
  }

  private async getEventOrThrow(eventId: string) {
    const event = await this.prismaService.event.findUnique({
      where: {
        id: eventId,
      },
      select: eventSelect,
    });

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    return event;
  }

  private async getOwnedParticipant(userId: string, eventId: string) {
    const participant = await this.prismaService.eventParticipant.findFirst({
      where: {
        eventId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!participant) {
      throw new ForbiddenException("You must join this event first");
    }

    return participant;
  }

  private assertValidEventWindow(startsAt: Date, endsAt: Date) {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException("Invalid event time window");
    }

    if (endsAt <= startsAt) {
      throw new BadRequestException("Event end time must be after start time");
    }
  }

  private assertDiscoveryWindowOpen(event: { startsAt: Date; endsAt: Date }) {
    const now = new Date();

    if (event.startsAt > now || event.endsAt < now) {
      throw new ForbiddenException("Event discovery is not active");
    }
  }

  private async isBlockedEitherWay(userId: string, otherUserId: string) {
    const [blockedByOtherUser, blockedByCurrentUser] = await Promise.all([
      this.blocksService.isBlockedByUser(otherUserId, userId),
      this.blocksService.isBlockedByUser(userId, otherUserId),
    ]);

    return blockedByOtherUser || blockedByCurrentUser;
  }

  private toParticipantView(
    participant: Prisma.EventParticipantGetPayload<{
      select: typeof eventParticipantSelect;
    }>,
  ) {
    return {
      id: participant.id,
      eventId: participant.eventId,
      personaId: participant.personaId,
      role: toApiEventParticipantRole(participant.role),
      discoveryEnabled: participant.discoveryEnabled,
      joinedAt: participant.joinedAt,
      persona: participant.persona,
    };
  }

  private toVisibleParticipantView(
    participant: Prisma.EventParticipantGetPayload<{
      select: typeof eventParticipantSelect;
    }>,
  ) {
    return {
      id: participant.id,
      eventId: participant.eventId,
      personaId: participant.personaId,
      role: toApiEventParticipantRole(participant.role),
      joinedAt: participant.joinedAt,
      persona: participant.persona,
    };
  }
}

function toPrismaEventStatus(status: EventStatus): PrismaEventStatus {
  switch (status) {
    case EventStatus.Draft:
      return PrismaEventStatus.DRAFT;
    case EventStatus.Published:
      return PrismaEventStatus.PUBLISHED;
    case EventStatus.Live:
      return PrismaEventStatus.LIVE;
    case EventStatus.Ended:
      return PrismaEventStatus.ENDED;
  }

  throw new Error("Unsupported event status");
}

function toApiEventStatus(status: PrismaEventStatus): EventStatus {
  switch (status) {
    case PrismaEventStatus.DRAFT:
      return EventStatus.Draft;
    case PrismaEventStatus.PUBLISHED:
      return EventStatus.Published;
    case PrismaEventStatus.LIVE:
      return EventStatus.Live;
    case PrismaEventStatus.ENDED:
      return EventStatus.Ended;
  }

  throw new Error("Unsupported event status");
}

function toPrismaEventParticipantRole(
  role: EventParticipantRole,
): PrismaEventParticipantRole {
  switch (role) {
    case EventParticipantRole.Attendee:
      return PrismaEventParticipantRole.ATTENDEE;
    case EventParticipantRole.Speaker:
      return PrismaEventParticipantRole.SPEAKER;
    case EventParticipantRole.Organizer:
      return PrismaEventParticipantRole.ORGANIZER;
  }

  throw new Error("Unsupported event participant role");
}

function toApiEventParticipantRole(
  role: PrismaEventParticipantRole,
): EventParticipantRole {
  switch (role) {
    case PrismaEventParticipantRole.ATTENDEE:
      return EventParticipantRole.Attendee;
    case PrismaEventParticipantRole.SPEAKER:
      return EventParticipantRole.Speaker;
    case PrismaEventParticipantRole.ORGANIZER:
      return EventParticipantRole.Organizer;
  }

  throw new Error("Unsupported event participant role");
}

function toEventView(
  event: Prisma.EventGetPayload<{
    select: typeof eventSelect;
  }> & {
    participants?: Array<{
      personaId: string;
      role: PrismaEventParticipantRole;
      discoveryEnabled: boolean;
    }>;
  },
) {
  const myParticipation = event.participants?.[0];

  return {
    id: event.id,
    name: event.name,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: event.location,
    status: toFrontendEventStatus(event.status),
    createdAt: event.createdAt,
    myParticipation: myParticipation
      ? {
          personaId: myParticipation.personaId,
          role: toApiEventParticipantRole(myParticipation.role),
          discoverable: myParticipation.discoveryEnabled,
        }
      : null,
  };
}

function toFrontendEventStatus(
  status: PrismaEventStatus,
): "upcoming" | "live" | "ended" {
  switch (status) {
    case PrismaEventStatus.DRAFT:
    case PrismaEventStatus.PUBLISHED:
      return "upcoming";
    case PrismaEventStatus.LIVE:
      return "live";
    case PrismaEventStatus.ENDED:
      return "ended";
  }

  throw new Error("Unsupported event status");
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002")
  );
}
