import { apiJson } from "./api";

export type CardModePublic = {
  modeId: string;
  cardPublicId: string;
  slug: string;
  name: string;
  headline?: string | null;
  bio?: string | null;
  contactGate: "OPEN" | "REQUEST_REQUIRED" | "HIDDEN";
};

export async function apiCreateCardMode(
  accessToken: string,
  dto: {
    name: string;
    slug: string;
    headline?: string | null;
    bio?: string | null;
    contactGate?: "OPEN" | "REQUEST_REQUIRED" | "HIDDEN";
    indexingEnabled?: boolean;
  },
): Promise<CardModePublic> {
  const res = await apiJson<{ mode: CardModePublic }>("/v1/card/modes", {
    method: "POST",
    accessToken,
    body: {
      name: dto.name,
      slug: dto.slug,
      headline: dto.headline ?? null,
      bio: dto.bio ?? null,
      contactGate: dto.contactGate ?? "REQUEST_REQUIRED",
      indexingEnabled: dto.indexingEnabled ?? true,
    },
  });

  return res.mode;
}
