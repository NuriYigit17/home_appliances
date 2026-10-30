import postgres from "postgres";
import { buildPushPayload } from "@block65/webcrypto-web-push";

const VAPID_PUBLIC_KEY = "BBkFQo_KXv_im_szB22-a5lEzmTTDjcTffiMZtnAcyhn-10bCOYepQhTjxsKHU4IISqMw4ZJH_fMw7eO61kjzi8";

type Reminder = {
  installment_id: string;
  sale_id: string;
  user_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
  due_date: string;
  remaining_cents: string;
  reminder_kind: "three_days" | "overdue";
};

const connectionString = Deno.env.get("SUPABASE_DB_URL");
if (!connectionString) throw new Error("SUPABASE_DB_URL eksik");
const db = postgres(connectionString, { max: 1, prepare: false });

function equalSecret(received: string, expected: string): boolean {
  const a = new TextEncoder().encode(received);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

function todayIstanbul(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(cents / 100);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const received = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (received.length !== 64) return Response.json({ error: "Yetkisiz" }, { status: 401 });

  try {
    const secrets = await db<{ name: string; decrypted_secret: string }[]>`
      select name, decrypted_secret
      from vault.decrypted_secrets
      where name in ('home_appliances_cron_secret', 'home_appliances_vapid_private')
    `;
    const cronSecret = secrets.find((row) => row.name === "home_appliances_cron_secret")?.decrypted_secret;
    if (!cronSecret || !equalSecret(received, cronSecret))
      return Response.json({ error: "Yetkisiz" }, { status: 401 });
    const privateKey = secrets.find((row) => row.name === "home_appliances_vapid_private")?.decrypted_secret;
    if (!privateKey) throw new Error("VAPID anahtarı eksik");

    const today = todayIstanbul();
    const reminders = await db<Reminder[]>`
      select i.id as installment_id, i.sale_id, s.user_id,
        ps.id as subscription_id, ps.endpoint, ps.p256dh, ps.auth_secret,
        i.due_date::text as due_date,
        greatest(0, i.amount_cents - paid.amount_cents)::text as remaining_cents,
        case when i.due_date = ${today}::date + 3 then 'three_days'
             else 'overdue' end as reminder_kind
      from public.installments i
      cross join public.staff s
      join public.push_subscriptions ps on ps.user_id = s.user_id
      cross join lateral (
        select coalesce(sum(p.amount_cents), 0)::bigint as amount_cents
        from public.payments p
        where p.installment_id = i.id and p.voided_at is null
      ) paid
      where s.active
        and (i.due_date = ${today}::date + 3 or i.due_date < ${today}::date)
        and i.amount_cents > paid.amount_cents
        and not exists (
          select 1 from public.notification_deliveries d
          where d.user_id = s.user_id and d.installment_id = i.id
            and d.reminder_kind = case
              when i.due_date = ${today}::date + 3 then 'three_days'
              else 'overdue' end
        )
      order by i.due_date, i.id, s.user_id, ps.id
    `;

    const groups = new Map<string, Reminder[]>();
    for (const reminder of reminders) {
      const key = `${reminder.user_id}:${reminder.installment_id}:${reminder.reminder_kind}`;
      groups.set(key, [...(groups.get(key) ?? []), reminder]);
    }

    let sent = 0;
    let failed = 0;
    for (const targets of groups.values()) {
      const reminder = targets[0];
      let delivered = false;
      for (const target of targets) {
        try {
          const payload = await buildPushPayload(
            {
              data: JSON.stringify({
                title: reminder.reminder_kind === "three_days"
                  ? "3 gün sonra taksit vadesi"
                  : "Gecikmiş taksit",
                body: `Kalan ödeme: ${formatMoney(Number(reminder.remaining_cents))}`,
                url: `/sales/${reminder.sale_id}`,
              }),
              options: { ttl: 86400 },
            },
            {
              endpoint: target.endpoint,
              expirationTime: null,
              keys: { p256dh: target.p256dh, auth: target.auth_secret },
            },
            {
              subject: "https://home-appliances.ihsanaman.workers.dev",
              publicKey: VAPID_PUBLIC_KEY,
              privateKey,
            },
          );
          const response = await fetch(target.endpoint, {
            ...payload,
            signal: AbortSignal.timeout(10000),
          });
          if (response.ok) {
            delivered = true;
            sent++;
          } else if (response.status === 404 || response.status === 410) {
            await db`delete from public.push_subscriptions where id = ${target.subscription_id}`;
          } else failed++;
        } catch (error) {
          console.error("Push gönderimi başarısız", error);
          failed++;
        }
      }
      if (delivered) {
        await db`
          insert into public.notification_deliveries
            (user_id, installment_id, reminder_kind, sent_on)
          values (${reminder.user_id}, ${reminder.installment_id},
            ${reminder.reminder_kind}, ${today}::date)
          on conflict (user_id, installment_id, reminder_kind) do nothing
        `;
      }
    }
    return Response.json({ sent, failed, checked: reminders.length });
  } catch (error) {
    console.error("Günlük bildirim işi başarısız", error);
    return Response.json({ error: "Bildirim işi başarısız" }, { status: 500 });
  }
});
