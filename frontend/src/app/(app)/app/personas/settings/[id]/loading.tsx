import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";

export default function LoadingPersonaSharingSettingsPage() {
  return (
    <section className="space-y-4 pb-24">
      <PageHeader
        title="How people can access you"
        description="Loading sharing settings for this persona."
      />

      <Card className="overflow-visible">
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-3xl bg-border/50" />
          <div className="h-16 animate-pulse rounded-3xl bg-border/50" />
        </div>
        <div className="mt-5 h-36 animate-pulse rounded-3xl bg-border/40" />
        <div className="mt-6 sticky bottom-0 -mx-5 border-t border-border/60 bg-background/95 px-5 pt-4 backdrop-blur">
          <div className="h-14 animate-pulse rounded-2xl bg-border/50" />
        </div>
      </Card>
    </section>
  );
}