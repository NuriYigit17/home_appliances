import { requireStaff } from "@/lib/auth";
import { getStockData } from "@/lib/data";
import StockClient from "@/components/stock-client";

export default async function StockPage() {
  const { supabase } = await requireStaff();
  const data = await getStockData(supabase);
  return <StockClient data={data} />;
}
