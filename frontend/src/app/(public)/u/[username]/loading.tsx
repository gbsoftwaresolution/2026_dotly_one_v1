import { Card } from "@/components/shared/card";

export default function LoadingPublicSmartCard() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8 sm:px-6">
      <Card className="w-full overflow-hidden p-0 border-border/60">
        <div className="space-y-6 bg-[linear-gradient(160deg,#111827_0%,#0f172a_48%,#020617_100%)] px-6 py-7">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 animate-pulse rounded-[26px] bg-white/10" />
            <div className="flex-1 space-y-3">
              <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
              <div className="h-9 w-48 animate-pulse rounded-full bg-white/12" />
              <div className="h-4 w-40 animate-pulse rounded-full bg-white/10" />
              <div className="h-4 w-52 animate-pulse rounded-full bg-white/10" />
            </div>
          </div>
          <div className="h-[148px] animate-pulse rounded-[28px] bg-white/[0.08]" />
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 animate-pulse rounded-[24px] bg-surface/70" />
            <div className="h-24 animate-pulse rounded-[24px] bg-surface/70" />
          </div>
          <div className="h-24 animate-pulse rounded-[24px] bg-surface/60" />
        </div>
      </Card>
    </main>
  );
}