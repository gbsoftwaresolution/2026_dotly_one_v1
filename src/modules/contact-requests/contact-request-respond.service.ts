import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContactRequestSourceType as PrismaContactRequestSourceType,
  ContactRequestStatus as PrismaContactRequestStatus,
} from "../../generated/prisma/client";

import { ContactRequestStatus } from "../../common/enums/contact-request-status.enum";
import { NotificationType } from "../../common/enums/notification-type.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { BlocksService } from "../blocks/blocks.service";
import { ContactMemoryService } from "../contact-memory/contact-memory.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { CreateRequestApprovedNotificationData } from "../notifications/notification-payloads";
import { RelationshipsService } from "../relationships/relationships.service";

import { toSourceLabel } from "./contact-request.shared";

type ApprovedRelationshipEventContext = {
  type: "event";
  eventId: string;
  label: string | null;
};

@Injectable()
export class ContactRequestRespondService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly blocksService: BlocksService,
    private readonly relationshipsService: RelationshipsService,
    private readonly contactMemoryService: ContactMemoryService,
    private readonly notificationsService: NotificationsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async approve(userId: string, requestId: string) {
    return this.prismaService.$transaction(async (tx) => {
      const contactRequestDelegate = tx.contactRequest as unknown as {
        findFirst?: (args: {
          where: { id: string; toUserId: string };
          select: {
            id: true;
            status: true;
            fromUserId: true;
            toUserId: true;
            fromPersonaId: true;
            toPersonaId: true;
            sourceType: true;
            sourceId: true;
            toPersona: {
              select: {
                fullName: true;
              };
            };
          };
        }) => Promise<{
          id: string;
          status: PrismaContactRequestStatus;
          fromUserId: string;
          toUserId: string;
          fromPersonaId: string;
          toPersonaId: string;
          sourceType: any;
          sourceId: string | null;
          toPersona: { fullName: string };
        } | null>;
        findUnique?: (args: {
          where: { id: string };
          select: {
            id: true;
            status: true;
            fromUserId: true;
            toUserId: true;
            fromPersonaId: true;
            toPersonaId: true;
            sourceType: true;
            sourceId: true;
            toPersona: {
              select: {
                fullName: true;
              };
            };
          };
        }) => Promise<{
          id: string;
          status: PrismaContactRequestStatus;
          fromUserId: string;
          toUserId: string;
          fromPersonaId: string;
          toPersonaId: string;
          sourceType: any;
          sourceId: string | null;
          toPersona: { fullName: string };
        } | null>;
      };

      const contactRequest =
        typeof contactRequestDelegate.findFirst === "function"
          ? await contactRequestDelegate.findFirst({
              where: {
                id: requestId,
                toUserId: userId,
              },
              select: {
                id: true,
                status: true,
                fromUserId: true,
                toUserId: true,
                fromPersonaId: true,
                toPersonaId: true,
                sourceType: true,
                sourceId: true,
                toPersona: {
                  select: {
                    fullName: true,
                  },
                },
              },
            })
          : await contactRequestDelegate.findUnique?.({
              where: {
                id: requestId,
              },
              select: {
                id: true,
                status: true,
                fromUserId: true,
                toUserId: true,
                fromPersonaId: true,
                toPersonaId: true,
                sourceType: true,
                sourceId: true,
                toPersona: {
                  select: {
                    fullName: true,
                  },
                },
              },
            });

      if (!contactRequest || contactRequest.toUserId !== userId) {
        throw new NotFoundException("Contact request not found");
      }

      if (contactRequest.status !== PrismaContactRequestStatus.PENDING) {
        throw new ConflictException(
          "Only pending contact requests can be approved",
        );
      }

      if (
        "assertNoInteractionBlockInTransaction" in this.blocksService &&
        typeof this.blocksService.assertNoInteractionBlockInTransaction ===
          "function"
      ) {
        await this.blocksService.assertNoInteractionBlockInTransaction(
          tx,
          userId,
          contactRequest.fromUserId,
        );
      } else {
        await this.blocksService.assertNoInteractionBlock(
          userId,
          contactRequest.fromUserId,
        );
      }

      const respondedAt = new Date();
      const eventContext = await this.getApprovedRequestEventContext(
        tx,
        contactRequest.sourceType,
        contactRequest.sourceId,
      );
      const updateResult = await tx.contactRequest.updateMany({
        where: {
          id: contactRequest.id,
          toUserId: userId,
          status: PrismaContactRequestStatus.PENDING,
        },
        data: {
          status: PrismaContactRequestStatus.APPROVED,
          respondedAt,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          "Only pending contact requests can be approved",
        );
      }

      const relationshipPayload: Parameters<
        RelationshipsService["createApprovedRelationship"]
      >[1] = {
        ownerUserId: contactRequest.toUserId,
        targetUserId: contactRequest.fromUserId,
        ownerPersonaId: contactRequest.toPersonaId,
        targetPersonaId: contactRequest.fromPersonaId,
        sourceType: contactRequest.sourceType,
        sourceId: contactRequest.sourceId,
        connectionContext: eventContext,
      };

      const relationship =
        await this.relationshipsService.createApprovedRelationship(
          tx,
          relationshipPayload,
        );

      await Promise.all([
        this.contactMemoryService.createInitialMemory(tx, {
          relationshipId: relationship.id,
          eventId: eventContext?.eventId ?? null,
          contextLabel: eventContext?.label ?? null,
          metAt: respondedAt,
          sourceLabel: toSourceLabel(contactRequest.sourceType),
        }),
        this.relationshipsService.updateInteractionMetadata(
          tx,
          relationship.id,
          respondedAt,
        ),
        relationship.reciprocalRelationshipId
          ? this.relationshipsService.updateInteractionMetadata(
              tx,
              relationship.reciprocalRelationshipId,
              respondedAt,
            )
          : Promise.resolve(null),
      ]);

      await Promise.all([
        this.analyticsService.trackRequestApproved(
          {
            actorUserId: userId,
            personaId: contactRequest.toPersonaId,
            requestId: contactRequest.id,
          },
          tx,
        ),
        this.analyticsService.trackContactCreated(
          {
            actorUserId: userId,
            personaId: contactRequest.toPersonaId,
            relationshipId: relationship.id,
            sourceType: contactRequest.sourceType.toLowerCase(),
            sourceId: contactRequest.sourceId,
          },
          tx,
        ),
      ]);

      const notificationData: CreateRequestApprovedNotificationData = {
        ...(relationship.reciprocalRelationshipId
          ? {
              relationshipId: relationship.reciprocalRelationshipId,
            }
          : {}),
      };

      await this.notificationsService.createSafe(
        {
          userId: contactRequest.fromUserId,
          type: NotificationType.RequestApproved,
          title: "Request approved",
          body: `${contactRequest.toPersona.fullName} approved your request`,
          data: notificationData,
        },
        tx,
      );

      return {
        requestId: contactRequest.id,
        status: ContactRequestStatus.Approved,
        relationshipId: relationship.id,
      };
    });
  }

  private async getApprovedRequestEventContext(
    tx: {
      event?: {
        findUnique?: (args: {
          where: { id: string };
          select: { name: true };
        }) => Promise<{ name: string } | null>;
      };
    },
    sourceType: PrismaContactRequestSourceType,
    sourceId: string | null,
  ): Promise<ApprovedRelationshipEventContext | null> {
    if (
      sourceType !== PrismaContactRequestSourceType.EVENT ||
      sourceId === null ||
      typeof tx.event?.findUnique !== "function"
    ) {
      return null;
    }

    const event = await tx.event.findUnique({
      where: {
        id: sourceId,
      },
      select: {
        name: true,
      },
    });

    return {
      type: "event",
      eventId: sourceId,
      label:
        typeof event?.name === "string" && event.name.trim().length > 0
          ? event.name.trim()
          : null,
    };
  }

  async reject(userId: string, requestId: string) {
    const contactRequestDelegate = this.prismaService
      .contactRequest as unknown as {
      findFirst?: (args: {
        where: { id: string; toUserId: string };
        select: {
          id: true;
          status: true;
        };
      }) => Promise<{
        id: string;
        status: PrismaContactRequestStatus;
      } | null>;
      findUnique?: (args: {
        where: { id: string };
        select: {
          id: true;
          toUserId: true;
          status: true;
        };
      }) => Promise<{
        id: string;
        toUserId: string;
        status: PrismaContactRequestStatus;
      } | null>;
    };

    const contactRequest =
      typeof contactRequestDelegate.findFirst === "function"
        ? await contactRequestDelegate.findFirst({
            where: {
              id: requestId,
              toUserId: userId,
            },
            select: {
              id: true,
              status: true,
            },
          })
        : await contactRequestDelegate.findUnique?.({
            where: {
              id: requestId,
            },
            select: {
              id: true,
              toUserId: true,
              status: true,
            },
          });

    if (
      !contactRequest ||
      ("toUserId" in contactRequest && contactRequest.toUserId !== userId)
    ) {
      throw new NotFoundException("Contact request not found");
    }

    if (contactRequest.status !== PrismaContactRequestStatus.PENDING) {
      throw new ConflictException(
        "Only pending contact requests can be rejected",
      );
    }

    const respondedAt = new Date();
    const updateResult = await this.prismaService.contactRequest.updateMany({
      where: {
        id: contactRequest.id,
        toUserId: userId,
        status: PrismaContactRequestStatus.PENDING,
      },
      data: {
        status: PrismaContactRequestStatus.REJECTED,
        respondedAt,
      },
    });

    if (updateResult.count !== 1) {
      throw new ConflictException(
        "Only pending contact requests can be rejected",
      );
    }

    return {
      requestId: contactRequest.id,
      status: ContactRequestStatus.Rejected,
    };
  }
}
