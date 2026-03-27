import { PublicUserPage } from "@/components/profile/public-user-page";

export default async function CanonicalPublicUserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return (
    <PublicUserPage
      publicIdentifier={username}
      forceCanonicalPath
    />
  );
}