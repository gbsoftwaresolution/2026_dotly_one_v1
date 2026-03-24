import {
  ContactRequestSourceType as PrismaContactRequestSourceType,
  ContactRequestStatus as PrismaContactRequestStatus,
  Prisma,
} from "../../generated/prisma/client";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { ContactRequestStatus } from "../../common/enums/contact-request-status.enum";

const REQUEST_RETRY_COOLDOWN_HOURS = 24;

export const REQUEST_RETRY_COOLDOWN_IN_MS =
  REQUEST_RETRY_COOLDOWN_HOURS * 60 * 60 * 1000;

export const incomingContactRequestSelect = {
  id: true,
  createdAt: true,
  reason: true,
  sourceType: true,
  fromPersona: {
    select: {
      id: true,
      username: true,
      fullName: true,
      jobTitle: true,
      companyName: true,
      profilePhotoUrl: true,
    },
  },
} satisfies Prisma.ContactRequestSelect;

export const outgoingContactRequestSelect = {
  id: true,
  createdAt: true,
  status: true,
  reason: true,
  toPersona: {
    select: {
      id: true,
      username: true,
      fullName: true,
      jobTitle: true,
      companyName: true,
      profilePhotoUrl: true,
    },
  },
} satisfies Prisma.ContactRequestSelect;

export const sendContactRequestSelect = {
  id: true,
  status: true,
  createdAt: true,
  toPersona: {
    select: {
      id: true,
      username: true,
      fullName: true,
    },
  },
} satisfies Prisma.ContactRequestSelect;

export function toPrismaContactRequestSourceType(
  sourceType: ContactRequestSourceType,
): PrismaContactRequestSourceType {
  switch (sourceType) {
    case ContactRequestSourceType.Profile:
      return PrismaContactRequestSourceType.PROFILE;
    case ContactRequestSourceType.Qr:
      return PrismaContactRequestSourceType.QR;
    case ContactRequestSourceType.Event:
      return PrismaContactRequestSourceType.EVENT;
  }

  throw new Error("Unsupported contact request source type");
}

export function toApiContactRequestSourceType(
  sourceType: PrismaContactRequestSourceType,
): ContactRequestSourceType {
  switch (sourceType) {
    case PrismaContactRequestSourceType.PROFILE:
      return ContactRequestSourceType.Profile;
    case PrismaContactRequestSourceType.QR:
      return ContactRequestSourceType.Qr;
    case PrismaContactRequestSourceType.EVENT:
      return ContactRequestSourceType.Event;
  }

  throw new Error("Unsupported contact request source type");
}

export function toApiContactRequestStatus(
  status: PrismaContactRequestStatus,
): ContactRequestStatus {
  switch (status) {
    case PrismaContactRequestStatus.PENDING:
      return ContactRequestStatus.Pending;
    case PrismaContactRequestStatus.APPROVED:
      return ContactRequestStatus.Approved;
    case PrismaContactRequestStatus.REJECTED:
      return ContactRequestStatus.Rejected;
    case PrismaContactRequestStatus.EXPIRED:
      return ContactRequestStatus.Expired;
    case PrismaContactRequestStatus.CANCELLED:
      return ContactRequestStatus.Cancelled;
  }

  throw new Error("Unsupported contact request status");
}

export function toSourceLabel(
  sourceType: PrismaContactRequestSourceType,
): string | null {
  switch (sourceType) {
    case PrismaContactRequestSourceType.PROFILE:
      return "Profile";
    case PrismaContactRequestSourceType.QR:
      return "QR";
    case PrismaContactRequestSourceType.EVENT:
      return "Event";
  }

  throw new Error("Unsupported contact request source type");
}

export function buildRequestReceivedBody(
  sourceType: ContactRequestSourceType,
  senderDisplayName: string,
): string {
  if (sourceType === ContactRequestSourceType.Event) {
    return `${senderDisplayName} sent an event request`;
  }

  return `${senderDisplayName} requested to connect`;
}