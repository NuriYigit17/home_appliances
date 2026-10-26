import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDays,
  addMonthsClamped,
  installmentStatus,
  todayIstanbul,
} from "@/lib/finance";

export type Customer = {
  id: string;
  full_name: string;
  address: string | null;
  home_phone: string | null;
  work_phone: string | null;
  mobile_phone: string | null;
  tc_identity_no: string | null;
  birth_place: string | null;
  province: string | null;
  birth_date: string | null;
  neighborhood_village: string | null;
  district: string | null;
  volume_no: string | null;
  registration_no: string | null;
  row_no: string | null;
  serial_no: string | null;
  tax_office: string | null;
  tax_no: string | null;
};
export type Guarantor = {
  id: string;
  full_name: string;
  address: string | null;
  home_phone: string | null;
  work_phone: string | null;
  mobile_phone: string | null;
};
export type Sale = {
  id: string;
  customer_id: string;
  guarantor_id: string | null;
  invoice_date: string | null;
  invoice_no: string | null;
  account_no: string | null;
  installment_count: number;
  first_due_date: string;
  total_cents: number;
  down_payment_cents: number;
  created_at: string;
};
export type SaleItem = {
  id: string;
  sale_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  sale_date: string;
  delivery_date: string | null;
  delivered: boolean;
};
export type Installment = {
  id: string;
  sale_id: string;
  installment_no: number;
  due_date: string;
  amount_cents: number;
};
export type Payment = {
  id: string;
  sale_id: string;
  installment_id: string | null;
  kind: "down_payment" | "installment";
  amount_cents: number;
  paid_on: string;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
};

export type InstallmentRow = Installment & {
  paidCents: number;
  remainingCents: number;
  status: ReturnType<typeof installmentStatus>;
  payments: Payment[];
};

export function enrichInstallments(
  installments: Installment[],
  payments: Payment[],
  today = todayIstanbul(),
): InstallmentRow[] {
  const active = payments.filter((payment) => !payment.voided_at);
  return installments
    .sort((a, b) => a.installment_no - b.installment_no)
    .map((installment) => {
      const mine = active.filter(
        (payment) => payment.installment_id === installment.id,
      );
      const paidCents = mine.reduce(
        (sum, payment) => sum + payment.amount_cents,
        0,
      );
      return {
        ...installment,
        payments: mine,
        paidCents,
        remainingCents: Math.max(0, installment.amount_cents - paidCents),
        status: installmentStatus(
          installment.amount_cents,
          paidCents,
          installment.due_date,
          today,
        ),
      };
    });
}

async function allRows<T>(
  supabase: SupabaseClient,
  table: string,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function getDashboardData(supabase: SupabaseClient) {
  const [sales, customers, items, installments, payments] = await Promise.all([
    allRows<Sale>(supabase, "sales"),
    allRows<Customer>(supabase, "customers"),
    allRows<SaleItem>(supabase, "sale_items"),
    allRows<Installment>(supabase, "installments"),
    allRows<Payment>(supabase, "payments"),
  ]);
  const today = todayIstanbul();
  const customerMap = new Map(
    customers.map((customer) => [customer.id, customer]),
  );
  const rows = sales
    .map((sale) => {
      const saleItems = items.filter((item) => item.sale_id === sale.id);
      const salePayments = payments.filter(
        (payment) => payment.sale_id === sale.id && !payment.voided_at,
      );
      const saleInstallments = enrichInstallments(
        installments.filter((installment) => installment.sale_id === sale.id),
        salePayments,
        today,
      );
      const paidCents = salePayments.reduce(
        (sum, payment) => sum + payment.amount_cents,
        0,
      );
      return {
        ...sale,
        customer: customerMap.get(sale.customer_id),
        products: saleItems
          .map(
            (item) =>
              `${item.product_name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`,
          )
          .join(", "),
        paidCents,
        remainingCents: Math.max(0, sale.total_cents - paidCents),
        nextInstallment: saleInstallments.find(
          (item) => item.remainingCents > 0,
        ),
        upcomingInstallments: saleInstallments.filter(
          (item) =>
            item.remainingCents > 0 &&
            item.due_date >= today &&
            item.due_date <= addDays(today, 3),
        ),
        overdueCents: saleInstallments
          .filter((item) => item.due_date < today)
          .reduce((sum, item) => sum + item.remainingCents, 0),
        paidInstallmentCount: saleInstallments.filter(
          (item) => item.remainingCents === 0,
        ).length,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const activePayments = payments.filter((payment) => !payment.voided_at);
  const totalPaidCents = activePayments.reduce(
    (sum, payment) => sum + payment.amount_cents,
    0,
  );
  const totalOutstandingCents = rows.reduce(
    (sum, row) => sum + row.remainingCents,
    0,
  );
  const overdueCents = rows.reduce((sum, row) => sum + row.overdueCents, 0);
  const monthStart = `${today.slice(0, 7)}-01`;
  const months = Array.from({ length: 12 }, (_, index) => {
    const key = addMonthsClamped(monthStart, index - 5).slice(0, 7);
    const actualCents = activePayments
      .filter((payment) => payment.paid_on.startsWith(key))
      .reduce((sum, payment) => sum + payment.amount_cents, 0);
    const expectedCents = enrichInstallments(
      installments.filter((item) => item.due_date.startsWith(key)),
      activePayments,
      today,
    ).reduce((sum, item) => sum + item.remainingCents, 0);
    return { key, actualCents, expectedCents, future: index > 5 };
  });
  return {
    rows,
    totalPaidCents,
    totalOutstandingCents,
    overdueCents,
    months,
    today,
  };
}

export async function getSaleDetail(supabase: SupabaseClient, id: string) {
  const { data: sale, error } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sale) return null;
  const typedSale = sale as Sale;
  const [
    customerResult,
    guarantorResult,
    itemsResult,
    installmentResult,
    paymentResult,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("id", typedSale.customer_id)
      .single(),
    typedSale.guarantor_id
      ? supabase
          .from("guarantors")
          .select("*")
          .eq("id", typedSale.guarantor_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("sale_items").select("*").eq("sale_id", id),
    supabase
      .from("installments")
      .select("*")
      .eq("sale_id", id)
      .order("installment_no"),
    supabase
      .from("payments")
      .select("*")
      .eq("sale_id", id)
      .order("paid_on", { ascending: false }),
  ]);
  for (const result of [
    customerResult,
    guarantorResult,
    itemsResult,
    installmentResult,
    paymentResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }
  const customer = customerResult.data as Customer;
  const guarantor = guarantorResult.data as Guarantor | null;
  const items = (itemsResult.data ?? []) as SaleItem[];
  const payments = (paymentResult.data ?? []) as Payment[];
  const installments = enrichInstallments(
    (installmentResult.data ?? []) as Installment[],
    payments,
  );
  const paidCents = payments
    .filter((payment) => !payment.voided_at)
    .reduce((sum, payment) => sum + payment.amount_cents, 0);
  return {
    sale: typedSale,
    customer,
    guarantor,
    items,
    payments,
    installments,
    paidCents,
    remainingCents: Math.max(0, typedSale.total_cents - paidCents),
  };
}
