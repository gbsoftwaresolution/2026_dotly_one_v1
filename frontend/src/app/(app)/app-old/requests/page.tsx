import { RequestsScreen } from "@/components/requests/requests-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { dotlyPositioning } from "@/lib/constants/positioning";

export default async function RequestsPage() {
  await requireServerSession("/app-old/requests");

  return (
    <section className="flex flex-col mx-auto w-full max-w-2xl gap-6 animate-fade-up [animation-duration:700ms] pb-safe">
      <PageHeader
        title="Requests"
        description={dotlyPositioning.app.noRequests}
      />
      <div className="flex flex-col gap-4">
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
