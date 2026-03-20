import { RequestsScreen } from "@/components/requests/requests-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function RequestsPage() {
  await requireServerSession(routes.app.requests);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Requests"
        description="Review incoming requests and track the ones you have already sent."
      />
      <RequestsScreen />
    </section>
  );
}
