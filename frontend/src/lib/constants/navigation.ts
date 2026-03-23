import { routes } from "./routes";

export type AppNavIconKey =
  | "home"
  | "personas"
  | "qr"
  | "requests"
  | "contacts"
  | "followUps"
  | "events"
  | "notifications"
  | "analytics"
  | "settings";

export const appNavItems = [
  { href: routes.app.home, label: "Home", icon: "home" },
  { href: routes.app.personas, label: "Personas", icon: "personas" },
  { href: routes.app.qr, label: "QR", icon: "qr" },
  { href: routes.app.requests, label: "Requests", icon: "requests" },
  { href: routes.app.contacts, label: "Connections", icon: "contacts" },
  { href: routes.app.followUps, label: "Follow-ups", icon: "followUps" },
  { href: routes.app.events, label: "Events", icon: "events" },
  {
    href: routes.app.notifications,
    label: "Alerts",
    icon: "notifications",
  },
  { href: routes.app.analytics, label: "Analytics", icon: "analytics" },
  { href: routes.app.settings, label: "Settings", icon: "settings" },
] as const;

export function getAppSectionLabel(pathname: string): string {
  const matchedItem = [...appNavItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find(
      (item) =>
        pathname === item.href ||
        (item.href !== routes.app.home && pathname.startsWith(`${item.href}/`)),
    );

  return matchedItem?.label ?? "Workspace";
}
