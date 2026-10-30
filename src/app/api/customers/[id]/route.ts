import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff, isSameOrigin } from "@/lib/api-auth";
import { customerSchema } from "@/lib/validation";

async function contextFor(
  request: NextRequest,
  params: Promise<{ id: string }>,
) {
  if (!isSameOrigin(request))
    return {
      error: NextResponse.json({ error: "Geçersiz istek." }, { status: 403 }),
    };
  const auth = await apiStaff();
  if (!auth)
    return {
      error: NextResponse.json({ error: "Giriş gerekli." }, { status: 401 }),
    };
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return {
      error: NextResponse.json({ error: "Geçersiz müşteri." }, { status: 400 }),
    };
  return { auth, id };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await contextFor(request, params);
  if (context.error) return context.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz veri." }, { status: 400 });
  }
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  const { data, error } = await context
    .auth!.supabase.from("customers")
    .update({ ...parsed.data, birth_date: parsed.data.birth_date || null })
    .eq("id", context.id!)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data)
    return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await contextFor(request, params);
  if (context.error) return context.error;
  const { data, error } = await context
    .auth!.supabase.from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", context.id!)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data)
    return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
