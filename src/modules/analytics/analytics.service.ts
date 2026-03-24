import { Injectable, NotFoundException } from "@nestjs/common";
import {
  AnalyticsEventType as PrismaAnalyticsEventType,
  ContactRelationshipState,
  Prisma,
} from "../../generated/prisma/client";
import { createHash } from "crypto";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AppLoggerService } from "../../infrastructure/logging/logging.service";

type AnalyticsClient = PrismaService | Prisma.TransactionClient;

type AnalyticsCounterKey =
  | "profileViews"
  | "qrScans"
  | "requestsReceived"
  | "requestsApproved"
  | "contactsCreated";

interface TrackAnalyticsEventInput {
  userId?: string | null;
  personaId?: string | null;
  eventType: PrismaAnalyticsEventType;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  increments?: Partial<Record<AnalyticsCounterKey, number>>;
}

export type AnalyticsTracker = Pick<
  AnalyticsService,
  | "trackProfileView"
  | "trackQrScan"
  | "trackRequestSent"
  | "trackRequestApproved"
  | "trackContactCreated"
  | "trackVerificationEmailIssued"
  | "trackVerificationResend"
  | "trackEmailVerified"
  | "trackVerificationBlockedAction"
>;

export const noopAnalyticsService: AnalyticsTracker = {
  trackProfileView: async () => true,
  trackQrScan: async () => true,
  trackRequestSent: async () => true,
  trackRequestApproved: async () => true,
  trackContactCreated: async () => true,
  trackVerificationEmailIssued: async () => true,
  trackVerificationResend: async () => true,
  trackEmailVerified: async () => true,
  trackVerificationBlockedAction: async () => true,
};

const personaAnalyticsSelect = {
  personaId: true,
  profileViews: true,
  qrScans: true,
  requestsReceived: true,
  requestsApproved: true,
  contactsCreated: true,
} satisfies Prisma.PersonaAnalyticsSelect;

const emptyPersonaAnalytics = {
  profileViews: 0,
  qrScans: 0,
  requestsReceived: 0,
  requestsApproved: 0,
  contactsCreated: 0,
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  async trackProfileView(input: {
    personaId: string;
    viewerUserId?: string | null;
    idempotencyKey?: string | null;
  }) {
    return this.trackSafe({
      userId: input.viewerUserId ?? null,
      personaId: input.personaId,
      eventType: PrismaAnalyticsEventType.PROFILE_VIEW,
      entityId: this.buildIdempotentEntityId(
        PrismaAnalyticsEventType.PROFILE_VIEW,
        input.personaId,
        input.idempotencyKey,
      ),
      increments: {
        profileViews: 1,
      },
    });
  }

  async trackQrScan(
    input: {
      personaId: string;
      scannerUserId?: string | null;
      qrTokenId?: string | null;
      idempotencyKey?: string | null;
    },
    client?: AnalyticsClient,
  ) {
    return this.trackSafe(
      {
        userId: input.scannerUserId ?? null,
        personaId: input.personaId,
        eventType: PrismaAnalyticsEventType.QR_SCAN,
        entityId: this.buildIdempotentEntityId(
          PrismaAnalyticsEventType.QR_SCAN,
          input.personaId,
          input.idempotencyKey,
        ),
        metadata: input.qrTokenId
          ? {
              qrTokenId: input.qrTokenId,
            }
          : null,
        increments: {
          qrScans: 1,
        },
      },
      client,
    );
  }

  async trackRequestSent(
    input: {
      actorUserId: string;
      personaId: string;
      requestId: string;
      sourceType: string;
      sourceId?: string | null;
    },
    client?: AnalyticsClient,
  ) {
    return this.trackSafe(
      {
        userId: input.actorUserId,
        personaId: input.personaId,
        eventType: PrismaAnalyticsEventType.REQUEST_SENT,
        entityId: input.requestId,
        metadata: {
          sourceType: input.sourceType,
          ...(input.sourceId ? { sourceId: input.sourceId } : {}),
        },
        increments: {
          requestsReceived: 1,
        },
      },
      client,
    );
  }

  async trackRequestApproved(
    input: {
      actorUserId: string;
      personaId: string;
      requestId: string;
    },
    client?: AnalyticsClient,
  ) {
    return this.trackSafe(
      {
        userId: input.actorUserId,
        personaId: input.personaId,
        eventType: PrismaAnalyticsEventType.REQUEST_APPROVED,
        entityId: input.requestId,
        increments: {
          requestsApproved: 1,
        },
      },
      client,
    );
  }

  async trackContactCreated(
    input: {
      actorUserId: string;
      personaId: string;
      relationshipId: string;
      sourceType: string;
      sourceId?: string | null;
    },
    client?: AnalyticsClient,
  ) {
    return this.trackSafe(
      {
        userId: input.actorUserId,
        personaId: input.personaId,
        eventType: PrismaAnalyticsEventType.CONTACT_CREATED,
        entityId: input.relationshipId,
        metadata: {
          sourceType: input.sourceType,
          ...(input.sourceId ? { sourceId: input.sourceId } : {}),
        },
        increments: {
          contactsCreated: 1,
        },
      },
      client,
    );
  }

  async trackVerificationEmailIssued(input: {
    actorUserId: string;
    context: "signup" | "resend";
    emailSent: boolean;
  }) {
    return this.trackSafe({
      userId: input.actorUserId,
      eventType: PrismaAnalyticsEventType.EMAIL_VERIFICATION_ISSUED,
      metadata: {
        context: input.context,
        emailSent: input.emailSent,
      },
    });
  }

  async trackVerificationResend(input: {
    actorUserId: string;
    emailSent: boolean;
  }) {
    return this.trackSafe({
      userId: input.actorUserId,
      eventType: PrismaAnalyticsEventType.EMAIL_VERIFICATION_RESENT,
      metadata: {
        emailSent: input.emailSent,
      },
    });
  }

  async trackEmailVerified(input: { actorUserId: string }) {
    return this.trackSafe({
      userId: input.actorUserId,
      eventType: PrismaAnalyticsEventType.EMAIL_VERIFICATION_VERIFIED,
    });
  }

  async trackVerificationBlockedAction(input: {
    actorUserId: string;
    requirement: string;
    allowedFactors: string[];
    missingFactors: string[];
  }) {
    return this.trackSafe({
      userId: input.actorUserId,
      eventType: PrismaAnalyticsEventType.VERIFICATION_REQUIREMENT_BLOCKED,
      metadata: {
        requirement: input.requirement,
        allowedFactors: input.allowedFactors,
        missingFactors: input.missingFactors,
      },
    });
  }

  async getPersonaAnalytics(userId: string, personaId: string) {
    const ownedPersona = await this.prismaService.persona.findFirst({
      where: {
        id: personaId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!ownedPersona) {
      throw new NotFoundException("Persona not found");
    }

    const analytics = await this.prismaService.personaAnalytics.findUnique({
      where: {
        personaId,
      },
      select: personaAnalyticsSelect,
    });

    const normalizedAnalytics = analytics ?? {
      personaId,
      ...emptyPersonaAnalytics,
    };

    return {
      personaId: normalizedAnalytics.personaId,
      profileViews: normalizedAnalytics.profileViews,
      qrScans: normalizedAnalytics.qrScans,
      requestsReceived: normalizedAnalytics.requestsReceived,
      requestsApproved: normalizedAnalytics.requestsApproved,
      contactsCreated: normalizedAnalytics.contactsCreated,
      conversionRate: this.toConversionRatePercentage(
        normalizedAnalytics.requestsApproved,
        normalizedAnalytics.requestsReceived,
      ),
    };
  }

  async getSummary(userId: string) {
    const [personas, issuedCount, resentCount, verifiedCount, blockedCount] =
      await Promise.all([
        this.prismaService.persona.findMany({
          where: {
            userId,
          },
          select: {
            id: true,
          },
        }),
        this.prismaService.analyticsEvent.count({
          where: {
            userId,
            eventType: PrismaAnalyticsEventType.EMAIL_VERIFICATION_ISSUED,
          },
        }),
        this.prismaService.analyticsEvent.count({
          where: {
            userId,
            eventType: PrismaAnalyticsEventType.EMAIL_VERIFICATION_RESENT,
          },
        }),
        this.prismaService.analyticsEvent.count({
          where: {
            userId,
            eventType: PrismaAnalyticsEventType.EMAIL_VERIFICATION_VERIFIED,
          },
        }),
        this.prismaService.analyticsEvent.count({
          where: {
            userId,
            eventType:
              PrismaAnalyticsEventType.VERIFICATION_REQUIREMENT_BLOCKED,
          },
        }),
      ]);

    const personaIds = personas.map((persona) => persona.id);
    const totals =
      personaIds.length > 0
        ? await this.prismaService.personaAnalytics.aggregate({
            where: {
              personaId: {
                in: personaIds,
              },
            },
            _sum: {
              profileViews: true,
              qrScans: true,
              requestsReceived: true,
              requestsApproved: true,
              contactsCreated: true,
            },
          })
        : {
            _sum: {
              profileViews: 0,
              qrScans: 0,
              requestsReceived: 0,
              requestsApproved: 0,
              contactsCreated: 0,
            },
          };

    const sums = totals._sum;

    return {
      totalProfileViews: sums.profileViews ?? 0,
      totalQrScans: sums.qrScans ?? 0,
      totalRequests: sums.requestsReceived ?? 0,
      totalApproved: sums.requestsApproved ?? 0,
      totalContacts: sums.contactsCreated ?? 0,
      totalVerificationEmailsIssued: issuedCount,
      totalVerificationResends: resentCount,
      totalVerificationCompleted: verifiedCount,
      totalVerificationBlocks: blockedCount,
      verificationConversionRate: this.toConversionRatePercentage(
        verifiedCount,
        issuedCount,
      ),
    };
  }

  async getMyAnalytics(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const startOfNextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const where = {
      ownerUserId: userId,
      state: ContactRelationshipState.APPROVED,
    } satisfies Prisma.ContactRelationshipWhereInput;

    const [totalConnections, connectionsThisMonth] = await Promise.all([
      this.prismaService.contactRelationship.count({
        where,
      }),
      this.prismaService.contactRelationship.count({
        where: {
          ...where,
          connectedAt: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
      }),
    ]);

    return {
      totalConnections,
      connectionsThisMonth,
    };
  }

  async trackSafe(
    input: TrackAnalyticsEventInput,
    client?: AnalyticsClient,
  ): Promise<boolean> {
    try {
      return await this.track(input, client);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Analytics tracking skipped for ${input.eventType}: ${message}`,
        "AnalyticsService",
      );

      return false;
    }
  }

  async track(
    input: TrackAnalyticsEventInput,
    client?: AnalyticsClient,
  ): Promise<boolean> {
    if (!client) {
      return this.prismaService.$transaction((tx) => this.track(input, tx));
    }

    try {
      await client.analyticsEvent.create({
        data: {
          userId: input.userId ?? null,
          personaId: input.personaId ?? null,
          eventType: input.eventType,
          entityId: input.entityId ?? null,
          metadata: input.metadata ?? undefined,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return false;
      }

      throw error;
    }

    if (!input.personaId || !input.increments) {
      return true;
    }

    await client.personaAnalytics.upsert({
      where: {
        personaId: input.personaId,
      },
      create: {
        personaId: input.personaId,
        ...this.toCreateCounterPayload(input.increments),
      },
      update: this.toUpdateCounterPayload(input.increments),
    });

    return true;
  }

  private buildIdempotentEntityId(
    eventType: PrismaAnalyticsEventType,
    personaId: string,
    idempotencyKey?: string | null,
  ): string | null {
    const normalizedKey = idempotencyKey?.trim();

    if (!normalizedKey) {
      return null;
    }

    const digest = createHash("sha256")
      .update(`${eventType}:${personaId}:${normalizedKey}`)
      .digest("hex");

    return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
  }

  private toCreateCounterPayload(
    increments: Partial<Record<AnalyticsCounterKey, number>>,
  ) {
    return {
      profileViews: increments.profileViews ?? 0,
      qrScans: increments.qrScans ?? 0,
      requestsReceived: increments.requestsReceived ?? 0,
      requestsApproved: increments.requestsApproved ?? 0,
      contactsCreated: increments.contactsCreated ?? 0,
    };
  }

  private toUpdateCounterPayload(
    increments: Partial<Record<AnalyticsCounterKey, number>>,
  ): Prisma.PersonaAnalyticsUpdateInput {
    const payload: Prisma.PersonaAnalyticsUpdateInput = {};

    if (increments.profileViews) {
      payload.profileViews = {
        increment: increments.profileViews,
      };
    }

    if (increments.qrScans) {
      payload.qrScans = {
        increment: increments.qrScans,
      };
    }

    if (increments.requestsReceived) {
      payload.requestsReceived = {
        increment: increments.requestsReceived,
      };
    }

    if (increments.requestsApproved) {
      payload.requestsApproved = {
        increment: increments.requestsApproved,
      };
    }

    if (increments.contactsCreated) {
      payload.contactsCreated = {
        increment: increments.contactsCreated,
      };
    }

    return payload;
  }

  private toConversionRatePercentage(approved: number, received: number) {
    if (received <= 0 || approved <= 0) {
      return 0;
    }

    return Number(((approved / received) * 100).toFixed(2));
  }
}
