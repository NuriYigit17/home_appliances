import SaleForm from "@/components/sale-form";
import { requireStaff } from "@/lib/auth";
import type { StockProduct } from "@/lib/data";

export default async function NewSalePage() {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return <SaleForm products={(data ?? []) as StockProduct[]} />;
}
