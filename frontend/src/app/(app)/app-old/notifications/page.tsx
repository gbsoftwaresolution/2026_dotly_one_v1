import { NotificationsScreen } from "@/components/notifications/notifications-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function NotificationsPage() {
  await requireServerSession(routes.app.notifications);

  return (
    <section className="flex flex-col mx-auto w-full max-w-2xl gap-6 animate-fade-up [animation-duration:700ms] pb-safe">
      <PageHeader
        title="Notifications"
        description="Stay up to date with requests, connections, and events."
      />
      <div className="flex flex-col gap-4">
        <div className="mb-5 space-y-1 sm:mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Notification stream
          </p>
          <p className="text-sm leading-6 text-muted">
            Keep account activity readable, prioritize unread alerts, and clear
            noise without losing important changes.
          </p>
        </div>
        <NotificationsScreen />
      </div>
    </section>
  );
}
