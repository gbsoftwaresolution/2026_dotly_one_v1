import { FollowUpsScreen } from "@/components/follow-ups/follow-ups-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";

export default async function FollowUpsPage() {
  await requireServerSession(routes.app.followUps);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Follow-ups"
        description="Keep the next conversation easy to pick back up."
      />
      <FollowUpsScreen />
    </section>
  );
}
