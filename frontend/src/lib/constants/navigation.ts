import { routes } from "./routes";

export const appNavItems = [
  { href: routes.app.home, label: "Home" },
  { href: routes.app.personas, label: "Personas" },
] as const;
