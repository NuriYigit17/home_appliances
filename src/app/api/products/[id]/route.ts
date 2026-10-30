import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff, isSameOrigin } from "@/lib/api-auth";
import { productSchema } from "@/lib/validation";

export async function PATCH(
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
  const parsed = productSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  const { error } = await auth.supabase.rpc("update_product", {
    p_id: id,
    p: parsed.data,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
