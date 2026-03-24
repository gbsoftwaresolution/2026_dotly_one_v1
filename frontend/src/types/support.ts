export interface CreateSupportRequestInput {
  name?: string;
  email: string;
  topic: string;
  details: string;
  challengeToken?: string;
  website?: string;
}

export interface CreateSupportRequestResult {
  accepted: true;
  delivery: "sent" | "logged";
  referenceId: string;
}

export interface SupportInboxItem {
  id: string;
  referenceId: string;
  requesterName: string | null;
  requesterEmailMasked: string;
  topic: string;
  details: string;
  status: "open" | "resolved";
  delivery: "sent" | "logged" | "failed";
  createdAt: string;
  resolvedAt: string | null;
}

export interface SupportInboxResult {
  requests: SupportInboxItem[];
}
