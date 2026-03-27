import { Card } from "@/components/shared/card";

export default function LoadingPublicSmartCard() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8 sm:px-6">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl" />
      <Card className="w-full rounded-[32px] bg-white/60 backdrop-blur-3xl p-0 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 overflow-hidden dark:bg-zinc-900/60 dark:ring-white/10">
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
            <div className="h-24 animate-pulse rounded-[24px] bg-white/50 backdrop-blur-md ring-1 ring-inset ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10" />
            <div className="h-24 animate-pulse rounded-[24px] bg-white/50 backdrop-blur-md ring-1 ring-inset ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10" />
          </div>
          <div className="h-24 animate-pulse rounded-[24px] bg-white/50 backdrop-blur-md ring-1 ring-inset ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10" />
        </div>
      </Card>
    </main>
  );
}
