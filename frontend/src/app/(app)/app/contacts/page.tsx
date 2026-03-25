import { ContactsScreen } from "@/components/contacts/contacts-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";

export default async function ContactsPage() {
  await requireServerSession(routes.app.contacts);

  return (
    <section className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Connections"
        description={dotlyPositioning.app.noContacts}
      />
      <div className="premium-card rounded-[2rem] p-4 sm:rounded-3xl sm:p-6">
        <div className="mb-5 space-y-1 sm:mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Relationship system
          </p>
          <p className="text-sm leading-6 text-muted">
            Stay close to the people who matter, surface the next follow-up, and
            keep context ready before the next conversation.
          </p>
        </div>
        <ContactsScreen />
      </div>
    </section>
  );
}
