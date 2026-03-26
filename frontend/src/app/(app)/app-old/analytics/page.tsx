import { AnalyticsScreen } from "@/components/analytics/analytics-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function AnalyticsPage() {
  await requireServerSession(routes.app.analytics);

  return (
    <section className="flex flex-col mx-auto w-full max-w-2xl gap-6 animate-fade-up [animation-duration:700ms] pb-safe">
      <PageHeader
        title="Analytics"
        description="Track persona performance alongside verification conversion, resend usage, and trust-policy friction."
      />
      <div className="flex flex-col gap-4">
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
