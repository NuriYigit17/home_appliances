import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff, isSameOrigin } from "@/lib/api-auth";
import { stockAdjustmentSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  const auth = await apiStaff();
  if (!auth)
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ error: "Geçersiz ürün." }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz veri." }, { status: 400 });
  }
  const parsed = stockAdjustmentSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  const { error } = await auth.supabase.rpc("adjust_stock", {
    p_id: id,
    p_delta: parsed.data.delta,
    p_note: parsed.data.note,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
