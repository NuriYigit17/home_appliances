import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff, isSameOrigin } from "@/lib/api-auth";

const schema = z.object({
  paymentId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
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
      { error: parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin." },
      { status: 400 },
    );
  const { error } = await auth.supabase.rpc("void_payment", {
    p_payment_id: parsed.data.paymentId,
    p_reason: parsed.data.reason,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
