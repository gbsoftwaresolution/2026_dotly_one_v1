import { PageHeader } from "@/components/shared/page-header";
import { SupportInboxScreen } from "@/components/support/support-inbox-screen";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function SupportInboxPage() {
  await requireServerSession(routes.app.supportInbox);

  return (
    <section className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Support Inbox"
        description="Review inbound support requests, track delivery status, and resolve launch-stage customer issues."
      />
      <div className="premium-card rounded-[2rem] p-4 sm:rounded-3xl sm:p-6">
        <div className="mb-5 space-y-1 sm:mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Support queue
          </p>
          <p className="text-sm leading-6 text-muted">
            Triage inbound requests, monitor delivery outcomes, and move issues
            through resolution with a cleaner operational view.
          </p>
        </div>
        <SupportInboxScreen />
      </div>
    </section>
  );
}
