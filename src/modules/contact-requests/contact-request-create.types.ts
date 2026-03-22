export interface ContactRequestActorPersona {
  id: string;
  fullName: string | null;
}

export interface ContactRequestTargetPersona {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  accessMode: string;
  sharingMode?: string;
  smartCardConfig?: unknown;
  verifiedOnly: boolean;
}

export interface ContactRequestSenderUser {
  id: string;
  isVerified: boolean;
  phoneVerifiedAt?: Date | null;
}
