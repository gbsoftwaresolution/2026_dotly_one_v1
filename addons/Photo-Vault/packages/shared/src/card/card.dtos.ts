import type {
  CardAttachmentResponse,
  CardContactRequestStatus,
  CardModePublicResponse,
  IsoDateString,
} from "./card.types";
import { Transform, Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class CreateCardModeDto {
  @IsString()
  @Length(2, 80)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name!: string;

  @IsString()
  @Length(2, 40)
  @Matches(/^[a-z0-9-]+$/)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  })
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  })
  bio?: string;

  @IsOptional()
  @IsIn(["OPEN", "REQUEST_REQUIRED", "HIDDEN"])
  contactGate?: "OPEN" | "REQUEST_REQUIRED" | "HIDDEN";

  @IsOptional()
  @IsBoolean()
  indexingEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  })
  themeKey?: string;
}

export interface CreateCardModeResponse {
  mode: CardModePublicResponse;
}

export interface ListCardModesResponse {
  items: CardModePublicResponse[];
}

export class UpdateCardUsernameDto {
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-z0-9_]{3,24}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  username!: string;
}

export interface UpdateCardUsernameResponse {
  username: string;
}

export interface ResolveUsernameResponse {
  publicId: string;
}

export interface GetPublicCardModeResponse {
  mode: CardModePublicResponse;
  attachments: CardAttachmentResponse[];
}

export interface CardModeAnalyticsResponse {
  modeId: string;
  viewsTotal: number;
  lastViewedAt?: IsoDateString;
  contactRequestsTotal: number;
  approvalsTotal: number;
  denialsTotal: number;
  activeGrantsTotal: number;
}

export interface ListCardModeAnalyticsResponse {
  items: CardModeAnalyticsResponse[];
}

export class CreateCardAttachmentDto {
  @IsIn(["ALBUM"])
  kind!: "ALBUM";

  @IsUUID()
  refId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  })
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export interface CreateCardAttachmentResponse {
  attachment: CardAttachmentResponse;
}

export interface ListCardAttachmentsResponse {
  attachments: CardAttachmentResponse[];
}

export class ReorderCardAttachmentItemDto {
  @IsUUID()
  attachmentId!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderCardAttachmentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReorderCardAttachmentItemDto)
  items!: ReorderCardAttachmentItemDto[];
}

export class UpdateCardAttachmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  })
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  // ISO string or null to clear
  @IsOptional()
  expiresAt?: IsoDateString | null;
}

export interface UpdateCardAttachmentResponse {
  attachment: CardAttachmentResponse;
}

export interface RevokeCardAttachmentResponse {
  success: true;
}

export interface DeleteCardAttachmentResponse {
  success: true;
}

// 3.2: ordered list reorder (0..n-1). Kept separate from 3.1's sortOrder-based DTO.
export class ReorderCardAttachmentsOrderedDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  attachmentIds!: string[];
}

export interface ReorderCardAttachmentsResponse {
  attachments: CardAttachmentResponse[];
}

export class CreateCardContactRequestDto {
  @IsString()
  @Length(2, 80)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  requesterName!: string;

  @IsEmail()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  requesterEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  })
  requesterPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  })
  message?: string;

  // Abuse resistance: required when CAPTCHA is enabled on the backend.
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  captchaToken?: string;
}

export interface CreateCardContactRequestResponse {
  requestId: string;
  status: CardContactRequestStatus;
  createdAt: IsoDateString;
}

export interface ListCardContactRequestsResponse {
  items: Array<{
    id: string;
    status: CardContactRequestStatus;
    requesterName: string;
    requesterEmail: string;
    requesterPhone?: string;
    message?: string;
    createdAt: IsoDateString;
  }>;
  nextCursor?: string;
}

export interface ApproveCardContactRequestDto {
  expiresInDays?: number;
  expiresAt?: IsoDateString;
}

export interface ApproveCardContactRequestResponse {
  grantId: string;
  token: string;
  expiresAt: IsoDateString;
}

export interface CardVCardResponse {
  filename: string;
  contentType: "text/vcard" | "text/x-vcard";
  vcf: string;
}

export interface CardContactRevealResponse {
  displayName?: string;
  email?: string;
}
