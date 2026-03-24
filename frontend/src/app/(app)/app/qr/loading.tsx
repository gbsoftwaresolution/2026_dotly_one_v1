export default function LoadingQrPage() {
  return (
    <section className="mx-auto flex min-h-screen-dvh w-full max-w-none flex-col justify-center px-2 py-2 sm:px-4 sm:py-4">
      <div className="relative isolate overflow-hidden rounded-[2.9rem] border border-black/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(247,249,252,0.99)_100%)] p-3 shadow-[0_36px_120px_rgba(15,23,42,0.12)] dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,rgba(18,18,20,0.96)_0%,rgba(8,8,9,0.98)_100%)] sm:p-4">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.9rem]">
          <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-brandRose/12 blur-3xl dark:bg-brandCyan/10" />
          <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-brandViolet/12 blur-3xl dark:bg-brandCyan/8" />
        </div>

        <div className="relative z-10 flex min-h-[calc(100dvh-0.75rem)] flex-col gap-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:min-h-[calc(100dvh-1rem)] sm:gap-4">
          <div className="flex items-center gap-3 rounded-[1.8rem] border border-black/[0.06] bg-white/82 px-3.5 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:border-white/[0.08] dark:bg-white/[0.045] sm:px-4 sm:py-3.5">
            <div className="skeleton h-12 w-12 rounded-[1rem]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton h-4 w-36 rounded-full" />
              <div className="skeleton h-3 w-28 rounded-full" />
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center gap-4">
            <div className="mx-auto flex w-full flex-1 items-center justify-center">
              <div className="relative w-full rounded-[2.85rem] border border-black/[0.08] bg-white px-3 py-4 shadow-[0_38px_100px_rgba(15,23,42,0.13)] dark:border-white/[0.08] dark:bg-zinc-950 sm:px-4 sm:py-5">
                <div className="flex min-h-[26rem] flex-col items-center justify-center gap-4 sm:min-h-[28rem]">
                  <div className="skeleton h-[22.5rem] w-full max-w-[22.5rem] rounded-[2.1rem] sm:h-[23.5rem] sm:max-w-[23.5rem]" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-center">
              <p className="text-base font-semibold text-foreground">
                Scan to view my contact
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
