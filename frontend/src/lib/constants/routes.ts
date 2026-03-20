export const routes = {
  public: {
    home: "/",
    login: "/login",
    signup: "/signup",
    qrLanding: "/q",
  },
  app: {
    home: "/app",
    personas: "/app/personas",
    createPersona: "/app/personas/create",
    qr: "/app/qr",
  },
} as const;
