import { VerificationSettingsCard } from "@/components/settings/verification-settings-card";
import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";

export default function SettingsPage() {
  return (
    <section className="flex flex-col gap-4">
      {/* Page header */}
      <div className="space-y-1 px-1">
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted">
          Appearance and account preferences.
        </p>
      </div>

      {/* Appearance */}
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

      <VerificationSettingsCard />

      {/* Coming soon */}
      <div className="rounded-3xl border border-dashed border-border p-5">
        <p className="text-center font-mono text-xs text-muted">
          More settings — persona management and session control — will expand
          after Phase 1.
        </p>
      </div>
    </section>
  );
}
