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
  app: {
    home: "/app-old",
    connections: "/app-old/connections",
    connectionDetail: (id: string) => `/app-old/connections/${id}`,
    conversationDetail: (conversationId: string) =>
      `/app-old/conversations/${conversationId}`,
    personas: "/app-old/personas",
    createPersona: "/app-old/personas/create",
    personaDetail: (personaId: string) => `/app-old/personas/${personaId}`,
    personaSettings: (personaId: string) =>
      `/app-old/personas/settings/${personaId}`,
    requests: "/app-old/requests",
    qr: "/app-old/qr",
    contacts: "/app-old/contacts",
    followUps: "/app-old/follow-ups",
    contactDetail: (relationshipId: string) =>
      `/app-old/contacts/${relationshipId}`,
    events: "/app-old/events",
    eventDetail: (eventId: string) => `/app-old/events/${eventId}`,
    notifications: "/app-old/notifications",
    analytics: "/app-old/analytics",
    settings: "/app-old/settings",
    supportInbox: "/app-old/support",
  },
} as const;
