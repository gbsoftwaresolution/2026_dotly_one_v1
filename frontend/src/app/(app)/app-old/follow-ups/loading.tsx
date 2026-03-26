import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function LoadingFollowUpsPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="h-8 w-36 animate-pulse rounded-2xl bg-border/50" />
        <div className="h-4 w-64 animate-pulse rounded-xl bg-border/40" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-11 w-24 animate-pulse rounded-full bg-border/35"
          />
        ))}
      </div>
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
    </section>
  );
}