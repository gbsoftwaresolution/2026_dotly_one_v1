export type ContactRequestSourceType = "profile" | "qr";

export type ContactRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export interface SendContactRequestInput {
  toPersonaId: string;
  fromPersonaId: string;
  reason?: string;
  sourceType: ContactRequestSourceType;
  sourceId?: string | null;
}

export interface SendContactRequestResult {
  id: string;
  status: ContactRequestStatus;
  createdAt: string;
  toPersona: {
    id: string;
    username: string;
    fullName: string;
  };
}

export interface IncomingRequest {
  id: string;
  createdAt: string;
  reason?: string | null;
  sourceType: ContactRequestSourceType;
  fromPersona: {
    id: string;
    username: string;
    fullName: string;
    jobTitle: string;
    companyName: string;
    profilePhotoUrl?: string | null;
  };
}

export interface OutgoingRequest {
  id: string;
  createdAt: string;
  status: ContactRequestStatus;
  reason?: string | null;
  toPersona: {
    id: string;
    username: string;
    fullName: string;
    jobTitle: string;
    companyName: string;
    profilePhotoUrl?: string | null;
  };
}

export interface ApproveRequestResult {
  requestId: string;
  status: "approved";
  relationshipId: string;
}

export interface RejectRequestResult {
  requestId: string;
  status: "rejected";
}
