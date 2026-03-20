export const routes = {
  public: {
    home: "/",
    login: "/login",
    signup: "/signup",
  },
  app: {
    home: "/app",
    personas: "/app/personas",
    createPersona: "/app/personas/create",
  },
} as const;
