import { ContactsScreen } from "@/components/contacts/contacts-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function ContactsPage() {
  await requireServerSession(routes.app.contacts);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Contacts"
        description="People you have connected with through Dotly."
      />
      <ContactsScreen />
    </section>
  );
}
