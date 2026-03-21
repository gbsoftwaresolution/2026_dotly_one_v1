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
    <VerifyEmailFlow
      initialToken={resolvedSearchParams.token}
      initialEmail={resolvedSearchParams.email}
    />
  );
}