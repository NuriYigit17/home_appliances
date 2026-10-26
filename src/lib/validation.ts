import { z } from "zod";

const date = z.iso.date();
const optionalDate = z.union([date, z.literal("")]).default("");
const optionalText = z.string().trim().max(500).default("");
const cents = z.number().int().min(0).max(100_000_000_000);

const customer = z.object({
  full_name: z.string().trim().min(2).max(160),
  address: optionalText,
  home_phone: optionalText,
  work_phone: optionalText,
  mobile_phone: optionalText,
  tc_identity_no: optionalText,
  birth_place: optionalText,
  province: optionalText,
  birth_date: optionalDate,
  neighborhood_village: optionalText,
  district: optionalText,
  volume_no: optionalText,
  registration_no: optionalText,
  row_no: optionalText,
  serial_no: optionalText,
  tax_office: optionalText,
  tax_no: optionalText,
});

const guarantor = z.object({
  full_name: optionalText,
  address: optionalText,
  home_phone: optionalText,
  work_phone: optionalText,
  mobile_phone: optionalText,
});

const item = z.object({
  product_name: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(10000),
  unit_price_cents: cents.min(1),
  sale_date: date,
  delivery_date: optionalDate,
  delivered: z.boolean(),
});

export const saleSchema = z
  .object({
    customer,
    guarantor,
    invoice_date: optionalDate,
    invoice_no: optionalText,
    account_no: optionalText,
    items: z.array(item).min(1).max(30),
    installment_count: z.number().int().min(1).max(60),
    first_due_date: date,
    down_payment_cents: cents,
    down_payment_date: optionalDate,
  })
  .superRefine((value, context) => {
    const total = value.items.reduce(
      (sum, entry) => sum + entry.quantity * entry.unit_price_cents,
      0,
    );
    if (!Number.isSafeInteger(total) || total > 100_000_000_000) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Toplam satış tutarı çok büyük.",
      });
    }
    if (
      value.down_payment_cents >= total ||
      total - value.down_payment_cents < value.installment_count
    ) {
      context.addIssue({
        code: "custom",
        path: ["down_payment_cents"],
        message: "Peşinat sonrası tutar taksitler için yeterli olmalı.",
      });
    }
    if (value.down_payment_cents > 0 && !value.down_payment_date) {
      context.addIssue({
        code: "custom",
        path: ["down_payment_date"],
        message: "Peşinat tarihi gerekli.",
      });
    }
  });

export type SaleInput = z.infer<typeof saleSchema>;

export const paymentSchema = z.object({
  installmentId: z.uuid(),
  amountCents: cents.min(1),
  paidOn: date,
});
