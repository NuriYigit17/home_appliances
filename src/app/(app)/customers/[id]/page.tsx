import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getCustomerDetail } from "@/lib/data";
import CustomerEditor from "@/components/customer-editor";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const detail = await getCustomerDetail(supabase, id);
  if (!detail) notFound();
  return <CustomerEditor {...detail} />;
}
