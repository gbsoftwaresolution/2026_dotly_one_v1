import { PageHeader } from "@/components/shared/page-header";
import { AccountSecuritySettings } from "@/components/settings/account-security-settings";
import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function SettingsPage() {
  const { user } = await requireServerSession(routes.app.settings);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Settings"
        description="Trust, verification, and appearance controls for your Dotly account."
      />

      <AccountSecuritySettings user={user} />

      <div className="glass rounded-3xl border border-border bg-surface p-5">
        <p className="label-xs mb-4 text-muted">Appearance</p>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Theme</p>
            <p className="font-mono text-xs text-muted">
              Onyx (dark) or Luminous (light)
            </p>
          </div>
          <ThemeSwitcher />
        </div>
      </div>
    </section>
  );
}
