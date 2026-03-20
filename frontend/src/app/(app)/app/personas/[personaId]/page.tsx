import { ProfileSummaryCard } from "@/components/profile/profile-summary-card";
import { PageHeader } from "@/components/shared/page-header";

export default async function PersonaDetailPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = await params;

  return (
    <section className="space-y-4">
      <PageHeader
        title={`Persona ${personaId}`}
        description="Detailed persona management will land after the Phase 1 core flow."
      />
      <ProfileSummaryCard />
    </section>
  );
}
