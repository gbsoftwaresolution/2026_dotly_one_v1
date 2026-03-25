import { FollowUpsScreen } from "@/components/follow-ups/follow-ups-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";

export default async function FollowUpsPage() {
  await requireServerSession(routes.app.followUps);

  return (
    <section className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Follow-ups"
        description="Keep the next conversation easy to pick back up."
      />
      <div className="premium-card rounded-[2rem] p-4 sm:rounded-3xl sm:p-6">
        <div className="mb-5 space-y-1 sm:mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Follow-up system
          </p>
          <p className="text-sm leading-6 text-muted">
            Keep overdue conversations visible, reduce drift, and close loops
            without losing the thread.
          </p>
        </div>
        <FollowUpsScreen />
      </div>
    </section>
  );
}
