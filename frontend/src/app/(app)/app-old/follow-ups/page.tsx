import { FollowUpsScreen } from "@/components/follow-ups/follow-ups-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { dotlyPositioning } from "@/lib/constants/positioning";

export default async function FollowUpsPage() {
  await requireServerSession("/app-old/follow-ups");

  return (
    <section className="flex flex-col mx-auto w-full max-w-2xl gap-6 animate-fade-up [animation-duration:700ms] pb-safe">
      <PageHeader
        title="Follow-ups"
        description="Keep the next conversation easy to pick back up."
      />
      <div className="flex flex-col gap-4">
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
