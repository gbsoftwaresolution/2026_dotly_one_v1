import { PageHeader } from "@/components/shared/page-header";
import { SupportInboxScreen } from "@/components/support/support-inbox-screen";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function SupportInboxPage() {
  await requireServerSession(routes.app.supportInbox);

  return (
    <section className="flex flex-col mx-auto w-full max-w-2xl gap-6 animate-fade-up [animation-duration:700ms] pb-safe">
      <PageHeader
        title="Support Inbox"
        description="Review inbound support requests, track delivery status, and resolve launch-stage customer issues."
      />
      <div className="flex flex-col gap-4">
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
