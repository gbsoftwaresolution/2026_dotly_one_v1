export const routes = {
  public: {
    home: "/",
    login: "/login",
    signup: "/signup",
    verifyEmail: "/verify-email",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    support: "/support",
    terms: "/terms",
    privacy: "/privacy",
    qrLanding: "/q",
  },
  legacyApp: {
    home: "/app-legacy",
  },
  app: {
    home: "/app",
    inbox: "/app/inbox",
    inboxAssignments: "/app/inbox/assignments",
    connections: "/app/connections",
    connectionDetail: (id: string) => `/app/connections/${id}`,
    conversationDetail: (conversationId: string) =>
      `/app/conversations/${conversationId}`,
    personas: "/app/personas",
    createPersona: "/app/personas/create",
    personaDetail: (personaId: string) => `/app/personas/${personaId}`,
    personaSettings: (personaId: string) =>
      `/app/personas/settings/${personaId}`,
    requests: "/app/requests",
    qr: "/app/qr",
    contacts: "/app/contacts",
    followUps: "/app/follow-ups",
    contactDetail: (relationshipId: string) =>
      `/app/contacts/${relationshipId}`,
    events: "/app/events",
    eventDetail: (eventId: string) => `/app/events/${eventId}`,
    notifications: "/app/notifications",
    analytics: "/app/analytics",
    settings: "/app/settings",
    supportInbox: "/app/support",
  },
} as const;
