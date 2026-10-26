import { NextRequest, NextResponse } from "next/server";
import { apiStaff, isSameOrigin } from "@/lib/api-auth";
import { paymentSchema } from "@/lib/validation";

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
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin." },
      { status: 400 },
    );
  const { data, error } = await auth.supabase.rpc("record_payment", {
    p_installment_id: parsed.data.installmentId,
    p_amount_cents: parsed.data.amountCents,
    p_paid_on: parsed.data.paidOn,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data }, { status: 201 });
}
