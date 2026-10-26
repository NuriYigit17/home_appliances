export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
    cents / 100,
  );

export function parseMoney(value: string): number | null {
  let normalized = value.trim().replace(/[₺\s]/g, "");
  if (normalized.includes(","))
    normalized = normalized.replaceAll(".", "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(normalized))
    normalized = normalized.replaceAll(".", "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fractional = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function addMonthsClamped(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayIstanbul(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function buildPlan(
  financedCents: number,
  count: number,
  firstDueDate: string,
) {
  if (
    !Number.isSafeInteger(financedCents) ||
    !Number.isInteger(count) ||
    count < 1 ||
    financedCents < count
  ) {
    throw new Error("Geçersiz taksit planı");
  }
  const base = Math.floor(financedCents / count);
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    dueDate: addMonthsClamped(firstDueDate, index),
    amountCents:
      base + (index === count - 1 ? financedCents - base * count : 0),
  }));
}

export function installmentStatus(
  amountCents: number,
  paidCents: number,
  dueDate: string,
  today: string,
) {
  if (paidCents >= amountCents) return "paid" as const;
  if (dueDate < today) return "overdue" as const;
  if (paidCents > 0) return "partial" as const;
  if (dueDate <= addDays(today, 3)) return "upcoming" as const;
  return "pending" as const;
}

export function formatDate(isoDate?: string | null) {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}
