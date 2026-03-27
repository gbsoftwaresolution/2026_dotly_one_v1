import { PublicAllLinksPage } from "@/components/profile/public-all-links-page";

export default async function PublicAllLinksRoute({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return <PublicAllLinksPage publicIdentifier={username} />;
}
