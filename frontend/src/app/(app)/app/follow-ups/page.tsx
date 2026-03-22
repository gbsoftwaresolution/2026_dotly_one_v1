import { FollowUpsScreen } from "@/components/follow-ups/follow-ups-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function FollowUpsPage() {
  await requireServerSession(routes.app.followUps);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Follow-ups"
        description="Simple reminders for the people you want to reconnect with at the right moment."
      />
      <FollowUpsScreen />
    </section>
  );
}