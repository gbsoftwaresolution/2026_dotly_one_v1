export type IsoDateString = string;

export type CardContactGate = "OPEN" | "REQUEST_REQUIRED" | "HIDDEN";

export type CardContactRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "DENIED"
  | "EXPIRED"
  | "REVOKED";

export type CardAttachmentKind = "ALBUM" | "MEDIA" | "LIFE_DOC";

export interface CardAttachmentResolvedLink {
  kind: "SHARED_ALBUM";
  shareId: string;
  shareLink: string;
  expiresAt: IsoDateString;
}

export interface PersonalCardResponse {
  id: string;
  userId: string;
  publicId: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CardModePublicResponse {
  modeId: string;
  cardPublicId: string;
  slug: string;

  name: string;
  headline?: string;
  bio?: string;

  contactGate: CardContactGate;
  indexingEnabled: boolean;
  themeKey?: string;

  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CardAttachmentResponse {
  id: string;
  kind: CardAttachmentKind;
  refId: string;
  label?: string;
  sortOrder: number;
  expiresAt?: IsoDateString;
  revokedAt?: IsoDateString;

  resolvedLink?: CardAttachmentResolvedLink;
}
