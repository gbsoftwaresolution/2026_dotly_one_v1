export interface AnalyticsSummary {
  totalProfileViews: number;
  totalQrScans: number;
  totalRequests: number;
  totalApproved: number;
  totalContacts: number;
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
