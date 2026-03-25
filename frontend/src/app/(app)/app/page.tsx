import { requireServerSession } from "@/lib/auth/protected-route";
import { userApi } from "@/lib/api/user-api";
import { routes } from "@/lib/constants/routes";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

export default async function AppHomePage() {
  const { accessToken, user } = await requireServerSession(routes.app.home);
  
  const [initialAnalytics] = await Promise.all([
    userApi.meAnalytics(accessToken).catch(() => null),
  ]);

  return (
    <DashboardHome 
      user={user} 
      initialAnalytics={initialAnalytics} 
    />
  );
}
