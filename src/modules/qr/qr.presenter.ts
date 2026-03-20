import { PersonaAccessMode } from "../../common/enums/persona-access-mode.enum";

export const qrResolutionSelect = {
  code: true,
  type: true,
  status: true,
  startsAt: true,
  endsAt: true,
  maxUses: true,
  usedCount: true,
  persona: {
    select: {
      id: true,
      username: true,
      publicUrl: true,
      fullName: true,
      jobTitle: true,
      companyName: true,
      tagline: true,
      profilePhotoUrl: true,
      accessMode: true,
    },
  },
} as const;

export interface QrResolutionRecord {
  code: string;
  type: "profile" | "quick_connect";
  status: "active" | "expired" | "disabled";
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  persona: {
    id: string;
    username: string;
    publicUrl: string;
    fullName: string;
    jobTitle: string;
    companyName: string;
    tagline: string;
    profilePhotoUrl: string | null;
    accessMode: "OPEN" | "REQUEST" | "PRIVATE";
  };
}

function toPersonaAccessMode(accessMode: "OPEN" | "REQUEST" | "PRIVATE") {
  switch (accessMode) {
    case "OPEN":
      return PersonaAccessMode.Open;
    case "PRIVATE":
      return PersonaAccessMode.Private;
    case "REQUEST":
    default:
      return PersonaAccessMode.Request;
  }
}

export function toQrLink(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${code}`;
}

function toResolvedPersonaView(record: QrResolutionRecord) {
  return {
    username: record.persona.username,
    publicUrl: record.persona.publicUrl,
    fullName: record.persona.fullName,
    jobTitle: record.persona.jobTitle,
    companyName: record.persona.companyName,
    tagline: record.persona.tagline,
    profilePhotoUrl: record.persona.profilePhotoUrl,
    accessMode: toPersonaAccessMode(record.persona.accessMode),
  };
}

export function toQrResolutionView(record: QrResolutionRecord) {
  const basePayload = {
    type: record.type,
    code: record.code,
    persona: toResolvedPersonaView(record),
  };

  if (record.type === "profile") {
    return basePayload;
  }

  return {
    ...basePayload,
    quickConnect: {
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      maxUses: record.maxUses,
      usedCount: record.usedCount,
    },
  };
}
