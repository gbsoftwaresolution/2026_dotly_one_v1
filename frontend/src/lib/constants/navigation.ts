import { routes } from "./routes";

export type AppNavIconKey =
  | "qr"
  | "requests"
  | "contacts"
  | "followUps"
  | "settings";

export const appNavItems = [
  { href: routes.app.qr, label: "Share", icon: "qr" },
  { href: routes.app.requests, label: "Requests", icon: "requests" },
  { href: routes.app.contacts, label: "Connections", icon: "contacts" },
  { href: routes.app.followUps, label: "Follow-ups", icon: "followUps" },
  { href: routes.app.settings, label: "Settings", icon: "settings" },
] as const;

const appSectionItems = [
  { href: routes.app.home, label: "Share" },
  { href: routes.app.qr, label: "Share" },
  { href: routes.app.personas, label: "Dotlys" },
  { href: routes.app.requests, label: "Requests" },
  { href: routes.app.contacts, label: "Connections" },
  { href: routes.app.followUps, label: "Follow-ups" },
  { href: routes.app.events, label: "Events" },
  { href: routes.app.notifications, label: "Alerts" },
  { href: routes.app.analytics, label: "Insights" },
  { href: routes.app.settings, label: "Settings" },
  { href: routes.app.supportInbox, label: "Support" },
] as const;

export function getAppSectionDescription(pathname: string): string {
  if (pathname === routes.app.qr || pathname === routes.app.home) {
    return "Open one screen and share with confidence.";
  }

  if (pathname.startsWith(routes.app.requests)) {
    return "Keep incoming connections simple and clear.";
  }

  if (pathname.startsWith(routes.app.contacts)) {
    return "Keep real relationships easy to pick back up.";
  }

  if (pathname.startsWith(routes.app.followUps)) {
    return "Stay in touch without turning it into busywork.";
  }

  if (pathname.startsWith(routes.app.settings)) {
    return "Manage trust, security, and how Dotly works for you.";
  }

  return "Share fast and manage real connections.";
}

export function getAppSectionLabel(pathname: string): string {
  const matchedItem = [...appSectionItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find(
      (item) =>
        pathname === item.href ||
        (item.href !== routes.app.home && pathname.startsWith(`${item.href}/`)),
    );

  return matchedItem?.label ?? "Workspace";
}
