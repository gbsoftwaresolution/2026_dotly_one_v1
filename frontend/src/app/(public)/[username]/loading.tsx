import { PublicSmartCardSkeleton } from "@/components/profile/public-smart-card";

export default function Loading() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md items-start px-4 py-4 sm:items-center sm:px-6 sm:py-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl" />
      <div className="w-full">
        <PublicSmartCardSkeleton />
      </div>
    </main>
  );
}
