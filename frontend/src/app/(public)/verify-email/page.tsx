import { VerifyEmailFlow } from "@/components/auth/verify-email-flow";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    email?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center overflow-x-hidden">
      <div className="fixed inset-0 z-[-1] pointer-events-none bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl" />
      <div className="relative z-10 w-full max-w-[480px] mx-auto p-4 sm:p-6 lg:p-8">
        <div className="rounded-[32px] bg-white/60 backdrop-blur-3xl p-8 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10">
          <VerifyEmailFlow
            initialToken={resolvedSearchParams.token}
            initialEmail={resolvedSearchParams.email}
          />
        </div>
      </div>
    </div>
  );
}
