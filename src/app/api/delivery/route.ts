import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff, isSameOrigin } from "@/lib/api-auth";

const schema = z.object({
  itemId: z.uuid(),
  delivered: z.boolean(),
  deliveryDate: z.union([z.iso.date(), z.literal("")]),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  const auth = await apiStaff();
  if (!auth)
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz veri." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Teslim bilgileri geçersiz." },
      { status: 400 },
    );
  const { error } = await auth.supabase.rpc("set_delivery", {
    p_item_id: parsed.data.itemId,
    p_delivered: parsed.data.delivered,
    p_delivery_date: parsed.data.deliveryDate || null,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
