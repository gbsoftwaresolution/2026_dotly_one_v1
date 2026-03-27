import { redirect } from "next/navigation";

interface CatchallPageProps {
  params: Promise<{ catchall: string[] }>;
}

export default async function CatchallPage({ params }: CatchallPageProps) {
  const { catchall } = await params;
  const path = catchall.join("/");
  redirect(`/app-old/${path}`);
}
