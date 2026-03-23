export default function LoadingAnalyticsPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-32 animate-pulse rounded-2xl bg-border/50" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-xl bg-border/40" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-3xl border border-border bg-surface"
          />
        ))}
      </div>
    </section>
  );
}