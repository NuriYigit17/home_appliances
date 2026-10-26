import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function requireStaff() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: staff } = await supabase
    .from("staff")
    .select("user_id, display_name, active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!staff?.active) redirect("/access-denied");
  return { supabase, user, staff };
}
