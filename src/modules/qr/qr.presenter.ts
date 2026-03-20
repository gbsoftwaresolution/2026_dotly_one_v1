import { PersonaAccessMode } from "../../common/enums/persona-access-mode.enum";

export const qrResolutionSelect = {
  code: true,
  type: true,
  startsAt: true,
  endsAt: true,
  maxUses: true,
  usedCount: true,
  persona: {
    select: {
      username: true,
      publicUrl: true,
      fullName: true,
      jobTitle: true,
      companyName: true,
      tagline: true,
      profilePhotoUrl: true,
    },
  },
} as const;

export interface QrResolutionRecord {
  code: string;
  type: "profile" | "quick_connect";
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  persona: {
    username: string;
    publicUrl: string;
    fullName: string;
    jobTitle: string;
    companyName: string;
    tagline: string;
    profilePhotoUrl: string | null;
  };
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
    accessMode: PersonaAccessMode.Request,
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
