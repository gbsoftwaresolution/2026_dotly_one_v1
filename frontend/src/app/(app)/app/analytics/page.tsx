import { AnalyticsScreen } from "@/components/analytics/analytics-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function AnalyticsPage() {
  await requireServerSession(routes.app.analytics);

  return (
    <section className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Analytics"
        description="Track persona performance alongside verification conversion, resend usage, and trust-policy friction."
      />
      <div className="premium-card rounded-[2rem] p-4 sm:rounded-3xl sm:p-6">
        <div className="mb-5 space-y-1 sm:mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Insight engine
          </p>
          <p className="text-sm leading-6 text-muted">
            Read the global signal first, then drill into persona-level
            conversion, scans, and requests without leaving the control surface.
          </p>
        </div>
        <AnalyticsScreen />
      </div>
    </section>
  );
}
