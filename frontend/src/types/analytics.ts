export interface AnalyticsSummary {
  totalProfileViews: number;
  totalQrScans: number;
  totalRequests: number;
  totalApproved: number;
  totalContacts: number;
  totalVerificationEmailsIssued: number;
  totalVerificationResends: number;
  totalVerificationCompleted: number;
  totalVerificationBlocks: number;
  verificationConversionRate: number;
}

export interface CurrentUserAnalytics {
  totalConnections: number;
  connectionsThisMonth: number;
}

export interface PersonaAnalytics {
  personaId: string;
  profileViews: number;
  qrScans: number;
  requestsReceived: number;
  requestsApproved: number;
  contactsCreated: number;
  conversionRate: number;
}
