import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsUUID,
} from "class-validator";

import { CallInitiationMode, CallType } from "../call-permission";

export class EnforceCallDto {
  @IsUUID()
  conversationId!: string;

  @IsOptional()
  @IsUUID()
  currentUserId?: string;

  @IsUUID()
  actorIdentityId!: string;

  @IsEnum(CallType)
  callType!: CallType;

  @IsEnum(CallInitiationMode)
  initiationMode!: CallInitiationMode;

  @IsOptional()
  @IsBoolean()
  screenCaptureDetected?: boolean;

  @IsOptional()
  @IsBoolean()
  castingDetected?: boolean;

  @IsOptional()
  @IsBoolean()
  deviceIntegrityCompromised?: boolean;

  @IsOptional()
  @IsBoolean()
  currentProtectedModeExpectation?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
