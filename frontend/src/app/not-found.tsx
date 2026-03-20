import Link from "next/link";

import { Card } from "@/components/shared/card";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { routes } from "@/lib/constants/routes";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-app items-center px-4 py-6">
      <Card className="w-full space-y-4 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Page not found
          </h1>
          <p className="text-sm text-muted">
            The page or public profile you requested does not exist, or it is
            not available for public access.
          </p>
        </div>
        <div className="flex justify-center">
          <Link href={routes.public.home}>
            <SecondaryButton>Back home</SecondaryButton>
          </Link>
        </div>
      </Card>
    </main>
  );
}
