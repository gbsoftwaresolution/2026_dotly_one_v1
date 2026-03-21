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
  verifiedOnly: boolean;
}

export interface ContactRequestSenderUser {
  id: string;
  isVerified: boolean;
}
