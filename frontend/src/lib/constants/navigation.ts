import { routes } from "./routes";

export const appNavItems = [
  { href: routes.app.home, label: "Home" },
  { href: routes.app.personas, label: "Personas" },
  { href: routes.app.contacts, label: "Contacts" },
  { href: routes.app.requests, label: "Requests" },
  { href: routes.app.qr, label: "My QR" },
] as const;
