import { AnalyticsScreen } from "@/components/analytics/analytics-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function AnalyticsPage() {
  await requireServerSession(routes.app.analytics);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Analytics"
        description="Track how your personas are performing across views, scans, and connections."
      />
      <AnalyticsScreen />
    </section>
  );
}
