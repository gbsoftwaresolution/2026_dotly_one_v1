import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";

export default function SettingsPage() {
  return (
    <section className="space-y-4">
      <PageHeader
        title="Settings"
        description="Account-level settings will expand after Phase 1."
      />
      <Card>
        <p className="text-sm text-muted">
          For now, session access and persona management happen from the main
          workspace screens.
        </p>
      </Card>
    </section>
  );
}
