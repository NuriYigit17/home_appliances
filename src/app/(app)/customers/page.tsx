import { requireStaff } from "@/lib/auth";
import { getCustomerList } from "@/lib/data";
import CustomerList from "@/components/customer-list";

export default async function CustomersPage() {
  const { supabase } = await requireStaff();
  const rows = await getCustomerList(supabase);
  return <CustomerList rows={rows} />;
}
