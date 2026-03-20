import { publicApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { formatAccessMode } from "@/lib/persona/labels";
import { notFound } from "next/navigation";

export default async function PublicUserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  try {
    const profile = await publicApi.getProfile(username);

    return (
      <main className="flex min-h-screen items-center justify-center bg-bgLuminous p-4 dark:bg-bgOnyx">
        <div className="w-full max-w-md space-y-6">
          {/* Identity Card */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/50 p-8 backdrop-blur-xl dark:border-zinc-900 dark:bg-bgOnyx/80">
            <div className="flex flex-col items-center text-center">
              {profile.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profilePhotoUrl}
                  alt={profile.fullName}
                  className="mb-6 h-24 w-24 rounded-3xl object-cover ring-1 ring-slate-200 dark:ring-zinc-800"
                />
              ) : (
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-900 text-3xl font-bold text-white dark:bg-zinc-800">
                  {profile.fullName.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Technical Status Pill */}
              <span className="mb-4 inline-flex rounded-full bg-slate-100 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-brandRose dark:bg-zinc-900 dark:text-brandCyan">
                STATUS: {formatAccessMode(profile.accessMode)}
              </span>

              <h1 className="mb-1 font-sans text-2xl font-bold text-slate-900 dark:text-white">
                {profile.fullName}
              </h1>
              <p className="font-mono text-sm text-slate-500 dark:text-zinc-400">
                dotly.id/{profile.username}
              </p>

              {/* Metadata Panel */}
              <div className="mt-6 w-full space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-left dark:border-zinc-800/50 dark:bg-zinc-900/30">
                <div>
                  <p className="font-sans text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                    Role
                  </p>
                  <p className="font-sans font-medium text-slate-800 dark:text-zinc-200">
                    {profile.jobTitle}
                  </p>
                </div>
                <div>
                  <p className="font-sans text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                    Company
                  </p>
                  <p className="font-sans font-medium text-slate-800 dark:text-zinc-200">
                    {profile.companyName}
                  </p>
                </div>
                <div>
                  <p className="font-sans text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                    About
                  </p>
                  <p className="font-sans font-medium text-slate-800 dark:text-zinc-200">
                    {profile.tagline}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button className="w-full rounded-2xl bg-brandRose py-5 font-sans font-bold text-white transition-all active:scale-95 hover:opacity-90 dark:bg-brandCyan dark:text-bgOnyx">
            Connect on Dotly
          </button>
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    const message =
      error instanceof ApiError
        ? error.message
        : "We could not load this public profile right now.";

    return (
      <main className="flex min-h-screen items-center justify-center bg-bgLuminous p-4 dark:bg-bgOnyx">
        {/* Error State using Themed Alerts */}
        <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-rose-50/50 p-8 text-center backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/50">
          <h1 className="mb-2 font-mono text-xl font-bold text-brandRose dark:text-brandCyan">
            PROFILE TEMPORARILY UNAVAILABLE
          </h1>
          <p className="font-sans text-sm text-slate-600 dark:text-zinc-400">
            {message}
          </p>
        </div>
      </main>
    );
  }
}
