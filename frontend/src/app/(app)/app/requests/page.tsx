import { RequestsScreen } from "@/components/requests/requests-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";

export default async function RequestsPage() {
  await requireServerSession(routes.app.requests);

  return (
    <section className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Requests"
        description={dotlyPositioning.app.noRequests}
      />
      <div className="premium-card rounded-[2rem] p-4 sm:rounded-3xl sm:p-6">
        <div className="mb-5 space-y-1 sm:mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Request flow
          </p>
          <p className="text-sm leading-6 text-muted">
            Review incoming intent, respond quickly, and keep outbound requests
            visible until each introduction resolves.
          </p>
        </div>
        <RequestsScreen />
      </div>
    </section>
  );
}
