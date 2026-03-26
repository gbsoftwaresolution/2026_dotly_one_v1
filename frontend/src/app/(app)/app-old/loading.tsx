export default function LoadingAppDashboard() {
  return (
    <section className="flex flex-col mx-auto w-full max-w-2xl gap-6 animate-fade-up [animation-duration:700ms] pb-safe">
      <header className="animate-fade-up [animation-duration:700ms] flex flex-col pt-2 sm:pt-4">
        {/* Skeleton for Persona Switcher Pill */}
        <div className="flex items-center mb-6">
          <div className="h-[38px] w-32 rounded-full skeleton opacity-70" />
        </div>

        {/* Skeleton for Greeting */}
        <div className="flex justify-between items-end pb-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="skeleton h-6 w-6 rounded-full opacity-50" />
              <div className="skeleton h-3 w-32 rounded-full opacity-50" />
            </div>
            <div className="skeleton h-10 w-64 rounded-2xl" />
          </div>
        </div>
      </header>

      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <section
          key={sectionIndex}
          className={`flex flex-col gap-3 animate-fade-up [animation-duration:700ms] [animation-fill-mode:both] ${
            sectionIndex === 0
              ? "[animation-delay:150ms]"
              : sectionIndex === 1
                ? "[animation-delay:300ms]"
                : "[animation-delay:450ms]"
          }`}
        >
          <div className="ml-4 skeleton h-4 w-28 rounded-full opacity-50" />
          <div className="overflow-hidden rounded-[20px] bg-white/60 shadow-sm ring-1 ring-black/5 backdrop-blur-xl dark:bg-[#1C1C1E]/80 dark:ring-white/10">
            <div className="flex flex-col">
              {Array.from({ length: sectionIndex === 2 ? 1 : 3 }).map(
                (__, itemIndex, arr) => {
                  const isLast = itemIndex === arr.length - 1;

                  return (
                    <div key={itemIndex} className="relative px-5 py-4">
                      <div className="flex flex-col gap-2">
                        <div className="skeleton h-5 w-40 rounded-full" />
                        {sectionIndex !== 2 ? (
                          <div className="skeleton h-4 w-24 rounded-full opacity-70" />
                        ) : (
                          <div className="skeleton h-4 w-32 rounded-full opacity-70" />
                        )}
                      </div>
                      {!isLast && (
                        <div className="absolute bottom-0 left-5 right-0 h-px bg-black/5 dark:bg-white/10" />
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </section>
      ))}
    </section>
  );
}
