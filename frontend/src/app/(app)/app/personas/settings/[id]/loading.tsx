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
        <div className="sticky bottom-0 -mx-5 mt-6 bg-background/95 px-5 pt-4 backdrop-blur before:absolute before:left-5 before:right-5 before:top-0 before:h-px before:bg-black/[0.06] dark:before:bg-white/[0.08]">
          <div className="h-14 animate-pulse rounded-2xl bg-border/50" />
        </div>
      </Card>
    </section>
  );
}
