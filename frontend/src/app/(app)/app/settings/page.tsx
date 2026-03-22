import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { AccountSecuritySettings } from "@/components/settings/account-security-settings";
import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function SettingsPage() {
  const { user } = await requireServerSession(routes.app.settings);

  const shortcuts = [
    { href: routes.app.qr, label: "QR sharing", description: "Generate a code when you are ready to share." },
    { href: routes.app.contacts, label: "Connections", description: "Review active relationships and notes." },
    { href: routes.app.notifications, label: "Notifications", description: "Catch up on unread account activity." },
    { href: routes.app.analytics, label: "Analytics", description: "Check reach and persona-level signals." },
    { href: routes.app.events, label: "Events", description: "Join event discovery and networking flows." },
    { href: routes.app.followUps, label: "Follow-ups", description: "Stay on top of the next conversation." },
  ] as const;

  return (
    <section className="space-y-4">
      <PageHeader
        title="Settings"
        description="Manage account trust, appearance, and the controls behind how you share your identity."
      />

      <div className="glass rounded-3xl border border-border bg-surface p-5">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            More tools
          </h2>
          <p className="text-sm leading-6 text-muted">
            Keep your main identity controls close. Reach the rest from here.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="rounded-[1.4rem] border border-border bg-background/70 px-4 py-4 transition-colors hover:border-brandRose/30 hover:bg-brandRose/5 dark:hover:border-brandCyan/30 dark:hover:bg-brandCyan/5"
            >
              <p className="text-sm font-semibold text-foreground">{shortcut.label}</p>
              <p className="mt-1 text-sm leading-6 text-muted">{shortcut.description}</p>
            </Link>
          ))}
        </div>
      </div>

      <AccountSecuritySettings user={user} />

      <div className="glass rounded-3xl border border-border bg-surface p-5">
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Appearance</h2>
          <p className="text-sm leading-6 text-muted">Choose the mode that feels clearest for everyday use.</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Theme</p>
            <p className="text-sm text-muted">
              Onyx (dark) or Luminous (light)
            </p>
          </div>
          <ThemeSwitcher />
        </div>
      </div>
    </section>
  );
}
