import { PageHeader } from "@/components/shared/page-header";
import { SupportInboxScreen } from "@/components/support/support-inbox-screen";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function SupportInboxPage() {
  await requireServerSession(routes.app.supportInbox);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Support Inbox"
        description="Review inbound support requests, track delivery status, and resolve launch-stage customer issues."
      />
      <SupportInboxScreen />
    </section>
  );
}
