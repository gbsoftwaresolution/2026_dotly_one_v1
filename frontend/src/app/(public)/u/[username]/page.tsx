import { PublicUserPage } from "@/components/profile/public-user-page";

export default async function PublicUserPageRoute({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return <PublicUserPage publicIdentifier={username} />;
}
