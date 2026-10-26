import { requireStaff } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";
import DashboardClient from "@/components/dashboard-client";

export default async function DashboardPage() {
  const { supabase } = await requireStaff();
  const data = await getDashboardData(supabase);
  return <DashboardClient data={data} />;
}
