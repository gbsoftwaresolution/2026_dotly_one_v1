export const routes = {
  public: {
    home: "/",
    login: "/login",
    signup: "/signup",
    verifyEmail: "/verify-email",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    terms: "/terms",
    privacy: "/privacy",
    qrLanding: "/q",
  },
  app: {
    home: "/app",
    personas: "/app/personas",
    createPersona: "/app/personas/create",
    personaDetail: (personaId: string) => `/app/personas/${personaId}`,
    requests: "/app/requests",
    qr: "/app/qr",
    contacts: "/app/contacts",
    contactDetail: (relationshipId: string) =>
      `/app/contacts/${relationshipId}`,
    events: "/app/events",
    eventDetail: (eventId: string) => `/app/events/${eventId}`,
    notifications: "/app/notifications",
    analytics: "/app/analytics",
    settings: "/app/settings",
  },
} as const;
