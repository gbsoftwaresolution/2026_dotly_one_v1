export default function LoadingQrPage() {
  return (
    <section className="mx-auto flex min-h-screen-dvh w-full max-w-2xl flex-col justify-center px-4 py-4 sm:px-6 sm:py-6">
      <div className="relative isolate overflow-hidden rounded-[2.5rem] border border-black/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,250,252,0.98)_100%)] p-4 shadow-[0_36px_120px_rgba(15,23,42,0.12)] dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,rgba(18,18,20,0.96)_0%,rgba(8,8,9,0.98)_100%)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.5rem]">
          <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-brandRose/12 blur-3xl dark:bg-brandCyan/10" />
          <div className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-brandViolet/12 blur-3xl dark:bg-brandCyan/8" />
        </div>

        <div className="relative z-10 flex min-h-[calc(100dvh-3rem)] flex-col gap-5 sm:min-h-[calc(100dvh-4rem)]">
          <div className="space-y-2">
            <p className="label-xs text-muted">Share</p>
            <h1 className="text-[2rem] font-semibold tracking-tight text-foreground">
              Show your QR
            </h1>
            <p className="max-w-[30rem] text-sm leading-6 text-muted">
              Loading your fastest share path.
            </p>
          </div>

          <div className="flex flex-1 flex-col justify-center gap-4">
            <div className="mx-auto flex w-full max-w-[26rem] flex-1 items-center justify-center">
              <div className="relative w-full rounded-[2.25rem] border border-black/[0.08] bg-white px-5 py-6 shadow-[0_28px_80px_rgba(15,23,42,0.10)] dark:border-white/[0.08] dark:bg-zinc-950 sm:px-7 sm:py-7">
                <div className="flex min-h-[22rem] flex-col items-center justify-center gap-4 sm:min-h-[24rem]">
                  <div className="skeleton h-[19rem] w-full max-w-[19rem] rounded-[1.8rem] sm:h-[20rem] sm:max-w-[20rem]" />
                  <div className="skeleton h-3 w-40 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}