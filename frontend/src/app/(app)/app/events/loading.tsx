import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function LoadingEventsPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="h-8 w-28 animate-pulse rounded-2xl bg-border/50" />
        <div className="h-4 w-56 animate-pulse rounded-xl bg-border/40" />
      </div>
      <div className="h-24 animate-pulse rounded-3xl bg-border/35" />
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
    </section>
  );
}