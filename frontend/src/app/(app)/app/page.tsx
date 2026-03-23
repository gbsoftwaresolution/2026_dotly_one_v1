import { redirect } from "next/navigation";

import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function AppHomePage() {
  await requireServerSession(routes.app.home);
  redirect(routes.app.qr);
}
