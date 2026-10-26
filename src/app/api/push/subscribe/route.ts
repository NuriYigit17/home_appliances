import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff, isSameOrigin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  p256dh: z.string().min(20).max(500),
  auth_secret: z.string().min(8).max(500),
});
const deleteSchema = z.object({ endpoint: z.url() });

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
  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Bildirim kaydı geçersiz." },
      { status: 400 },
    );
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      ...parsed.data,
    },
    { onConflict: "endpoint" },
  );
  if (error)
    return NextResponse.json(
      { error: "Bildirim kaydı oluşturulamadı." },
      { status: 500 },
    );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
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
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Geçersiz adres." }, { status: 400 });
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("endpoint", parsed.data.endpoint);
  if (error)
    return NextResponse.json(
      { error: "Bildirim kaydı kaldırılamadı." },
      { status: 500 },
    );
  return NextResponse.json({ ok: true });
}
