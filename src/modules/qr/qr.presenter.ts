export const qrResolutionSelect = {
  code: true,
  type: true,
  persona: {
    select: {
      id: true,
      userId: true,
      username: true,
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
  persona: {
    id: string;
    userId: string;
    username: string;
    fullName: string;
    jobTitle: string;
    companyName: string | null;
    tagline: string | null;
    profilePhotoUrl: string | null;
  };
}

export function toQrLink(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${code}`;
}

function toResolvedPersonaView(record: QrResolutionRecord) {
  return {
    username: record.persona.username,
    fullName: record.persona.fullName,
    jobTitle: record.persona.jobTitle,
    companyName: record.persona.companyName,
    tagline: record.persona.tagline,
    profilePhotoUrl: record.persona.profilePhotoUrl,
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

  return basePayload;
}
