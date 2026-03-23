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
import { NotificationType } from "../../common/enums/notification-type.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { BlocksService } from "../blocks/blocks.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { CreateEventJoinedNotificationData } from "../notifications/notification-payloads";
import { PersonasService } from "../personas/personas.service";
import { VerificationPolicyService } from "../auth/verification-policy.service";

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

const noopNotificationsService: Pick<NotificationsService, "createSafe"> = {
  createSafe: async () => undefined,
};

const failClosedVerificationPolicyService: Pick<
  VerificationPolicyService,
  "assertUserIsVerified"
> = {
  assertUserIsVerified: async () => {
    throw new Error("Verification policy service is not configured");
  },
};

@Injectable()
export class EventsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly personasService: PersonasService,
    private readonly blocksService: BlocksService,
    private readonly notificationsService: NotificationsService = noopNotificationsService as NotificationsService,
    private readonly verificationPolicyService: VerificationPolicyService = failClosedVerificationPolicyService as VerificationPolicyService,
  ) {}

  async create(userId: string, createEventDto: CreateEventDto) {
    await this.verificationPolicyService.assertUserIsVerified(
      userId,
      "create_event",
    );

    const name = normalizeRequiredEventField(createEventDto.name, "name");
    const slug = normalizeRequiredEventField(
      createEventDto.slug,
      "slug",
    ).toLowerCase();
    const location = normalizeRequiredEventField(
      createEventDto.location,
      "location",
    );
    const startsAt = new Date(createEventDto.startsAt);
    const endsAt = new Date(createEventDto.endsAt);
    const status = createEventDto.status ?? EventStatus.Draft;

    this.assertValidEventWindow(startsAt, endsAt);
    this.assertStatusMatchesEventWindow(status, startsAt, endsAt);

    try {
      const event = await this.prismaService.event.create({
        data: {
          name,
          slug,
          description: createEventDto.description ?? null,
          startsAt,
          endsAt,
          location,
          status: toPrismaEventStatus(status),
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
    await this.verificationPolicyService.assertUserIsVerified(
      userId,
      "join_event",
    );

    const event = await this.getEventOrThrow(eventId);
    this.assertJoinWindowOpen(event);

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
            resolveJoinRole(joinEventDto.role),
          ),
        },
        select: eventParticipantSelect,
      });

      const notificationData: CreateEventJoinedNotificationData = {};

      await this.notificationsService.createSafe({
        userId,
        type: NotificationType.EventJoined,
        title: "Event joined",
        body: `You joined ${event.name}`,
        data: notificationData,
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
    await this.verificationPolicyService.assertUserIsVerified(
      userId,
      "enable_event_discovery",
    );

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
    await this.verificationPolicyService.assertUserIsVerified(
      userId,
      "view_event_participants",
    );

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

    if (participants.length === 0) {
      return [];
    }

    const blockedUsers = await this.prismaService.block.findMany({
      where: {
        OR: [
          {
            blockerUserId: userId,
            blockedUserId: {
              in: participants.map((participant) => participant.userId),
            },
          },
          {
            blockerUserId: {
              in: participants.map((participant) => participant.userId),
            },
            blockedUserId: userId,
          },
        ],
      },
      select: {
        blockerUserId: true,
        blockedUserId: true,
      },
    });

    const excludedUserIds = new Set<string>();

    for (const block of blockedUsers) {
      if (block.blockerUserId === userId) {
        excludedUserIds.add(block.blockedUserId);
        continue;
      }

      excludedUserIds.add(block.blockerUserId);
    }

    return participants
      .filter((participant) => !excludedUserIds.has(participant.userId))
      .map((participant) => this.toVisibleParticipantView(participant));
  }

  async validateEventRequestAccess(
    actorUserId: string,
    eventId: string,
    actorPersonaId: string,
    targetPersonaId: string,
  ) {
    const eventParticipant =
      await this.prismaService.eventParticipant.findFirst({
        where: {
          eventId,
          userId: actorUserId,
          personaId: actorPersonaId,
          discoveryEnabled: true,
        },
        select: {
          id: true,
          event: {
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
              status: true,
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

  private assertDiscoveryWindowOpen(event: {
    startsAt: Date;
    endsAt: Date;
    status?: PrismaEventStatus;
  }) {
    const now = new Date();

    if (event.status !== undefined && event.status !== PrismaEventStatus.LIVE) {
      throw new ForbiddenException("Event discovery is not active");
    }

    if (event.startsAt > now || event.endsAt <= now) {
      throw new ForbiddenException("Event discovery is not active");
    }
  }

  private assertJoinWindowOpen(event: {
    startsAt: Date;
    endsAt: Date;
    status?: PrismaEventStatus;
  }) {
    const now = new Date();

    if (
      event.status !== PrismaEventStatus.LIVE ||
      event.endsAt <= now ||
      event.startsAt > now
    ) {
      throw new ForbiddenException("Event join is not active");
    }
  }

  private assertStatusMatchesEventWindow(
    status: EventStatus,
    startsAt: Date,
    endsAt: Date,
  ) {
    const now = new Date();

    if (status === EventStatus.Draft) {
      return;
    }

    if (status === EventStatus.Published) {
      if (startsAt <= now) {
        throw new BadRequestException(
          "Published events must start in the future",
        );
      }

      return;
    }

    if (status === EventStatus.Live) {
      if (startsAt > now || endsAt <= now) {
        throw new BadRequestException("Live events must be active right now");
      }

      return;
    }

    if (endsAt > now) {
      throw new BadRequestException("Ended events must have already finished");
    }
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

function normalizeRequiredEventField(
  value: string,
  fieldName: "name" | "slug" | "location",
): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new BadRequestException(`Event ${fieldName} cannot be empty`);
  }

  if (
    fieldName === "slug" &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedValue)
  ) {
    throw new BadRequestException(
      "Event slug must contain only lowercase letters, numbers, and single hyphens",
    );
  }

  return normalizedValue;
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

function resolveJoinRole(role?: EventParticipantRole): EventParticipantRole {
  if (role === undefined || role === EventParticipantRole.Attendee) {
    return EventParticipantRole.Attendee;
  }

  throw new BadRequestException(
    "Only attendee role can be self-assigned when joining an event",
  );
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
