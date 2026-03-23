import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function LoadingContactsPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-2xl bg-border/50" />
        <div className="h-4 w-64 animate-pulse rounded-xl bg-border/40" />
      </div>
      <div className="h-12 animate-pulse rounded-2xl bg-border/40" />
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
    </section>
  );
}