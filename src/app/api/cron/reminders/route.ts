import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { addDays, formatMoney, todayIstanbul } from "@/lib/finance";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Installment, Payment } from "@/lib/data";

function equalSecret(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};
type Delivery = {
  id: string;
  user_id: string;
  installment_id: string;
  reminder_kind: string;
};

async function fetchPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await fetchPage(offset, offset + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const received =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !equalSecret(received, secret))
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.VAPID_SUBJECT
  ) {
    return NextResponse.json(
      { error: "VAPID ayarları eksik" },
      { status: 503 },
    );
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  const admin = createAdminClient();
  const today = todayIstanbul();
  const threeDays = addDays(today, 3);
  let installments: Installment[];
  let payments: Pick<
    Payment,
    "id" | "installment_id" | "amount_cents" | "voided_at"
  >[];
  let subscriptions: Subscription[];
  let staff: { user_id: string }[];
  let deliveries: Delivery[];
  try {
    [installments, payments, subscriptions, staff, deliveries] =
      await Promise.all([
        fetchPages<Installment>((from, to) =>
          admin
            .from("installments")
            .select("*")
            .lte("due_date", threeDays)
            .order("id")
            .range(from, to),
        ),
        fetchPages<
          Pick<Payment, "id" | "installment_id" | "amount_cents" | "voided_at">
        >((from, to) =>
          admin
            .from("payments")
            .select("id,installment_id,amount_cents,voided_at")
            .is("voided_at", null)
            .order("id")
            .range(from, to),
        ),
        fetchPages<Subscription>((from, to) =>
          admin
            .from("push_subscriptions")
            .select("*")
            .order("id")
            .range(from, to),
        ),
        fetchPages<{ user_id: string }>((from, to) =>
          admin
            .from("staff")
            .select("user_id")
            .eq("active", true)
            .order("user_id")
            .range(from, to),
        ),
        fetchPages<Delivery>((from, to) =>
          admin
            .from("notification_deliveries")
            .select("id,user_id,installment_id,reminder_kind")
            .order("id")
            .range(from, to),
        ),
      ]);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Veriler alınamadı" },
      { status: 500 },
    );
  }
  const activeStaff = new Set(staff.map((person) => person.user_id));
  const delivered = new Set(
    deliveries.map(
      (entry) =>
        `${entry.user_id}:${entry.installment_id}:${entry.reminder_kind}`,
    ),
  );
  let sent = 0;
  for (const installment of installments) {
    const paid = payments
      .filter((payment) => payment.installment_id === installment.id)
      .reduce((sum, payment) => sum + payment.amount_cents, 0);
    const remaining = installment.amount_cents - paid;
    if (remaining <= 0) continue;
    const kind =
      installment.due_date === threeDays
        ? "three_days"
        : installment.due_date < today
          ? "overdue"
          : null;
    if (!kind) continue;
    for (const userId of activeStaff) {
      const key = `${userId}:${installment.id}:${kind}`;
      if (delivered.has(key)) continue;
      const targets = subscriptions.filter(
        (subscription) => subscription.user_id === userId,
      );
      let success = false;
      for (const target of targets) {
        try {
          await webpush.sendNotification(
            {
              endpoint: target.endpoint,
              keys: { p256dh: target.p256dh, auth: target.auth_secret },
            },
            JSON.stringify({
              title:
                kind === "three_days"
                  ? "3 gün sonra taksit vadesi"
                  : "Gecikmiş taksit",
              body: `Kalan ödeme: ${formatMoney(remaining)}`,
              url: `/sales/${installment.sale_id}`,
            }),
          );
          success = true;
          sent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410)
            await admin.from("push_subscriptions").delete().eq("id", target.id);
        }
      }
      if (success) {
        const { error } = await admin
          .from("notification_deliveries")
          .insert({
            user_id: userId,
            installment_id: installment.id,
            reminder_kind: kind,
            sent_on: today,
          });
        if (error && error.code !== "23505")
          return NextResponse.json({ error: error.message }, { status: 500 });
        delivered.add(key);
      }
    }
  }
  return NextResponse.json({ sent, checked: installments.length });
}
