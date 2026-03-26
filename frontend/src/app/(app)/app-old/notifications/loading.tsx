import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function LoadingNotificationsPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="h-8 w-44 animate-pulse rounded-2xl bg-border/50" />
        <div className="h-4 w-64 animate-pulse rounded-xl bg-border/40" />
      </div>
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
    </section>
  );
}