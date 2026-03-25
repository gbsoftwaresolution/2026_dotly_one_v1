import { ConnectionProgressNote } from "@/components/analytics/connection-progress-note";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { AccountSecuritySettings } from "@/components/settings/account-security-settings";
import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";
import { userApi } from "@/lib/api/user-api";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function SettingsPage() {
  const { accessToken, user } = await requireServerSession(routes.app.settings);
  const analytics = await userApi.meAnalytics(accessToken).catch(() => null);

  const shortcuts = [
    {
      href: routes.app.qr,
      label: "QR sharing",
      description: "Generate a code when you are ready to share.",
    },
    {
      href: routes.app.contacts,
      label: "Connections",
      description: "Review active relationships and notes.",
    },
    {
      href: routes.app.notifications,
      label: "Notifications",
      description: "Catch up on unread account activity.",
    },
    {
      href: routes.app.analytics,
      label: "Analytics",
      description: "Check reach and persona-level signals.",
    },
    {
      href: routes.app.events,
      label: "Events",
      description: "Join event discovery and networking flows.",
    },
    {
      href: routes.app.followUps,
      label: "Follow-ups",
      description: "Stay on top of the next conversation.",
    },
    {
      href: routes.app.supportInbox,
      label: "Support inbox",
      description:
        "Review inbound requests from support@dotly.one and update their status.",
    },
  ] as const;

  return (
    <section className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Settings"
        description="Manage account trust, appearance, and the controls behind how you share your identity."
      />

      <ConnectionProgressNote analytics={analytics} />

      <div className="premium-card rounded-[2rem] p-4 sm:rounded-3xl sm:p-6">
        <div className="space-y-5 sm:space-y-6">
          <section className="space-y-4 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Step 1
              </p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                More tools
              </h2>
              <p className="text-sm leading-6 text-muted">
                Keep your main identity controls close. Reach the rest from
                here.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {shortcuts.map((shortcut) => (
                <Link
                  key={shortcut.href}
                  href={shortcut.href}
                  className="rounded-[1.4rem] bg-white px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 transition-all hover:scale-[0.995] hover:bg-foreground/[0.02] dark:bg-zinc-950 dark:ring-white/[0.06] dark:hover:bg-white/[0.04]"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {shortcut.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {shortcut.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Step 2
              </p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Account security
              </h2>
            </div>

            <AccountSecuritySettings user={user} />
          </section>

          <section className="space-y-4 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Step 3
              </p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Appearance
              </h2>
              <p className="text-sm leading-6 text-muted">
                Choose the mode that feels clearest for everyday use.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 dark:bg-zinc-950 dark:ring-white/[0.06]">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Theme</p>
                <p className="text-sm text-muted">
                  Onyx (dark) or Luminous (light)
                </p>
              </div>
              <ThemeSwitcher />
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
