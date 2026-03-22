import { PublicSmartCardSkeleton } from "@/components/profile/public-smart-card";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-start px-4 py-4 sm:items-center sm:px-6 sm:py-8">
      <div className="w-full">
        <PublicSmartCardSkeleton />
      </div>
    </main>
  );
}