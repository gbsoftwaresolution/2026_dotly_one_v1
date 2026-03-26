import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function LoadingRequestsPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="h-8 w-32 animate-pulse rounded-2xl bg-border/50" />
        <div className="h-4 w-56 animate-pulse rounded-xl bg-border/40" />
      </div>
      <div className="h-14 animate-pulse rounded-[1.75rem] bg-border/35" />
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
    </section>
  );
}