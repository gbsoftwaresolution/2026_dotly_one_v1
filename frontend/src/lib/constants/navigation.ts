import { routes } from "./routes";

export const appNavItems = [
  { href: routes.app.personas, label: "Personas" },
  { href: routes.app.qr, label: "QR" },
  { href: routes.app.requests, label: "Requests" },
  { href: routes.app.contacts, label: "Connections" },
  { href: routes.app.events, label: "Events" },
  { href: routes.app.notifications, label: "Alerts" },
  { href: routes.app.analytics, label: "Analytics" },
] as const;
