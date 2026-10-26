"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import {
  addMonthsClamped,
  buildPlan,
  formatDate,
  formatMoney,
  parseMoney,
  todayIstanbul,
} from "@/lib/finance";

const today = todayIstanbul();
const emptyCustomer = {
  full_name: "",
  address: "",
  home_phone: "",
  work_phone: "",
  mobile_phone: "",
  tc_identity_no: "",
  birth_place: "",
  province: "",
  birth_date: "",
  neighborhood_village: "",
  district: "",
  volume_no: "",
  registration_no: "",
  row_no: "",
  serial_no: "",
  tax_office: "",
  tax_no: "",
};
const emptyGuarantor = {
  full_name: "",
  address: "",
  home_phone: "",
  work_phone: "",
  mobile_phone: "",
};
type CustomerKey = keyof typeof emptyCustomer;
type GuarantorKey = keyof typeof emptyGuarantor;
type ItemForm = {
  product_name: string;
  quantity: string;
  price: string;
  sale_date: string;
  delivery_date: string;
  delivered: boolean;
};
const newItem = (): ItemForm => ({
  product_name: "",
  quantity: "1",
  price: "",
  sale_date: today,
  delivery_date: "",
  delivered: false,
});

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "tel";
  maxLength?: number;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
      />
    </label>
  );
}

export default function SaleForm() {
  const router = useRouter();
  const [customer, setCustomer] = useState(emptyCustomer);
  const [guarantor, setGuarantor] = useState(emptyGuarantor);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [items, setItems] = useState<ItemForm[]>([newItem()]);
  const [downPayment, setDownPayment] = useState("0");
  const [downPaymentDate, setDownPaymentDate] = useState(today);
  const [installmentCount, setInstallmentCount] = useState("12");
  const [firstDueDate, setFirstDueDate] = useState(addMonthsClamped(today, 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setCustomerField = (key: CustomerKey, value: string) =>
    setCustomer((old) => ({ ...old, [key]: value }));
  const setGuarantorField = (key: GuarantorKey, value: string) =>
    setGuarantor((old) => ({ ...old, [key]: value }));
  const setItemField = <K extends keyof ItemForm>(
    index: number,
    key: K,
    value: ItemForm[K],
  ) =>
    setItems((old) =>
      old.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );

  const totalCents = useMemo(
    () =>
      items.reduce((sum, item) => {
        const price = parseMoney(item.price) ?? 0;
        return sum + price * (Number(item.quantity) || 0);
      }, 0),
    [items],
  );
  const downCents = parseMoney(downPayment) ?? 0;
  const financedCents = totalCents - downCents;
  const count = Number(installmentCount);
  let plan: ReturnType<typeof buildPlan> = [];
  try {
    if (firstDueDate && financedCents > 0)
      plan = buildPlan(financedCents, count, firstDueDate);
  } catch {
    /* Show validation near submit. */
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsedItems = items.map((item) => ({
      product_name: item.product_name.trim(),
      quantity: Number(item.quantity),
      unit_price_cents: parseMoney(item.price),
      sale_date: item.sale_date,
      delivery_date: item.delivery_date,
      delivered: item.delivered,
    }));
    if (
      parsedItems.some((item) => item.unit_price_cents === null) ||
      parseMoney(downPayment) === null ||
      plan.length !== count
    ) {
      setError(
        "Ürün fiyatlarını, peşinatı ve taksit bilgilerini kontrol edin.",
      );
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          guarantor,
          invoice_date: invoiceDate,
          invoice_no: invoiceNo,
          account_no: accountNo,
          items: parsedItems,
          installment_count: count,
          first_due_date: firstDueDate,
          down_payment_cents: parseMoney(downPayment),
          down_payment_date: downPaymentDate,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Satış kaydedilemedi.");
      router.push(`/sales/${result.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Beklenmeyen hata.");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <Link href="/" className="back-link">
            <ArrowLeft size={17} /> Dashboard
          </Link>
          <h1>Yeni satış</h1>
          <p>Müşteri hesap kartındaki bilgileri doldurun.</p>
        </div>
      </div>
      <form onSubmit={submit} className="sale-layout">
        <div className="form-main">
          <section className="panel form-section">
            <div className="section-heading">
              <div>
                <span className="step-label">01</span>
                <h2>Müşteri ve fatura</h2>
                <p>Hesap kartının üst bölümündeki bilgiler</p>
              </div>
            </div>
            <div className="form-grid three">
              <TextInput
                label="Fatura tarihi"
                type="date"
                value={invoiceDate}
                onChange={setInvoiceDate}
              />
              <TextInput
                label="Fatura no"
                value={invoiceNo}
                onChange={setInvoiceNo}
              />
              <TextInput
                label="Hesap no"
                value={accountNo}
                onChange={setAccountNo}
              />
            </div>
            <div className="form-grid three">
              <TextInput
                label="Adı soyadı"
                value={customer.full_name}
                onChange={(value) => setCustomerField("full_name", value)}
                required
              />
              <TextInput
                label="Ev tel"
                value={customer.home_phone}
                onChange={(value) => setCustomerField("home_phone", value)}
                inputMode="tel"
              />
              <TextInput
                label="İş tel"
                value={customer.work_phone}
                onChange={(value) => setCustomerField("work_phone", value)}
                inputMode="tel"
              />
              <TextInput
                label="Adresi"
                value={customer.address}
                onChange={(value) => setCustomerField("address", value)}
              />
              <TextInput
                label="Cep tel"
                value={customer.mobile_phone}
                onChange={(value) => setCustomerField("mobile_phone", value)}
                inputMode="tel"
              />
            </div>
          </section>

          <section className="panel form-section">
            <div className="section-heading">
              <div>
                <span className="step-label">02</span>
                <h2>Müşteri bilgileri</h2>
                <p>Kartın alt bölümündeki kimlik ve vergi alanları</p>
              </div>
            </div>
            <div className="form-grid three">
              {(
                [
                  ["tc_identity_no", "TC kimlik no", "text"],
                  ["birth_place", "Doğum yeri", "text"],
                  ["birth_date", "Doğum tarihi", "date"],
                  ["province", "İl", "text"],
                  ["district", "İlçesi", "text"],
                  ["neighborhood_village", "Mahalle / köy", "text"],
                  ["volume_no", "Cilt no", "text"],
                  ["registration_no", "Kayıt no", "text"],
                  ["row_no", "Sıra no", "text"],
                  ["serial_no", "Seri no", "text"],
                  ["tax_office", "Vergi dairesi", "text"],
                  ["tax_no", "Vergi no", "text"],
                ] as [CustomerKey, string, string][]
              ).map(([key, label, type]) => (
                <TextInput
                  key={key}
                  label={label}
                  type={type}
                  value={customer[key]}
                  onChange={(value) => setCustomerField(key, value)}
                  maxLength={key === "tc_identity_no" ? 11 : undefined}
                />
              ))}
            </div>
          </section>

          <section className="panel form-section">
            <div className="section-heading">
              <div>
                <span className="step-label">03</span>
                <h2>Kefil bilgileri</h2>
                <p>Kefil yoksa boş bırakabilirsiniz</p>
              </div>
            </div>
            <div className="form-grid three">
              <TextInput
                label="Kefili"
                value={guarantor.full_name}
                onChange={(value) => setGuarantorField("full_name", value)}
              />
              <TextInput
                label="Ev tel"
                value={guarantor.home_phone}
                onChange={(value) => setGuarantorField("home_phone", value)}
                inputMode="tel"
              />
              <TextInput
                label="İş tel"
                value={guarantor.work_phone}
                onChange={(value) => setGuarantorField("work_phone", value)}
                inputMode="tel"
              />
              <TextInput
                label="Adresi"
                value={guarantor.address}
                onChange={(value) => setGuarantorField("address", value)}
              />
              <TextInput
                label="Cep tel"
                value={guarantor.mobile_phone}
                onChange={(value) => setGuarantorField("mobile_phone", value)}
                inputMode="tel"
              />
            </div>
          </section>

          <section className="panel form-section">
            <div className="section-heading">
              <div>
                <span className="step-label">04</span>
                <h2>Satılan ürünler</h2>
                <p>
                  Ürünler şimdilik elle girilir. Her ürünün teslim durumu ayrı
                  tutulur.
                </p>
              </div>
            </div>
            <div className="item-list">
              {items.map((item, index) => (
                <div className="item-editor" key={index}>
                  <div className="item-editor-head">
                    <strong>Ürün {index + 1}</strong>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="text-button danger"
                        onClick={() =>
                          setItems((old) => old.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 size={16} /> Kaldır
                      </button>
                    )}
                  </div>
                  <div className="form-grid three">
                    <TextInput
                      label="Satılan ürün"
                      value={item.product_name}
                      onChange={(value) =>
                        setItemField(index, "product_name", value)
                      }
                      required
                      placeholder="Örn. Çamaşır makinesi"
                    />
                    <TextInput
                      label="Adet (AD)"
                      value={item.quantity}
                      onChange={(value) =>
                        setItemField(index, "quantity", value)
                      }
                      type="number"
                      required
                    />
                    <TextInput
                      label="Birim fiyatı (TL)"
                      value={item.price}
                      onChange={(value) => setItemField(index, "price", value)}
                      required
                      placeholder="0,00"
                      inputMode="decimal"
                    />
                    <TextInput
                      label="Satış tarihi"
                      type="date"
                      value={item.sale_date}
                      onChange={(value) =>
                        setItemField(index, "sale_date", value)
                      }
                      required
                    />
                    <TextInput
                      label="Teslim tarihi"
                      type="date"
                      value={item.delivery_date}
                      onChange={(value) =>
                        setItemField(index, "delivery_date", value)
                      }
                    />
                    <label className="field">
                      <span>Teslim durumu</span>
                      <select
                        value={item.delivered ? "yes" : "no"}
                        onChange={(event) =>
                          setItemField(
                            index,
                            "delivered",
                            event.target.value === "yes",
                          )
                        }
                      >
                        <option value="no">Teslim edilmedi</option>
                        <option value="yes">Teslim edildi</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={() => setItems((old) => [...old, newItem()])}
            >
              <Plus size={18} /> Ürün ekle
            </button>
          </section>

          <section className="panel form-section">
            <div className="section-heading">
              <div>
                <span className="step-label">05</span>
                <h2>Peşinat ve taksitler</h2>
                <p>Kalan satış bedeli aylık taksitlere bölünür</p>
              </div>
            </div>
            <div className="form-grid three">
              <TextInput
                label="Peşinat (TL)"
                value={downPayment}
                onChange={setDownPayment}
                inputMode="decimal"
                required
              />
              <TextInput
                label="Peşinatın alındığı tarih"
                type="date"
                value={downPaymentDate}
                onChange={setDownPaymentDate}
              />
              <TextInput
                label="Taksit sayısı"
                type="number"
                value={installmentCount}
                onChange={setInstallmentCount}
                required
              />
              <TextInput
                label="İlk taksit tarihi"
                type="date"
                value={firstDueDate}
                onChange={setFirstDueDate}
                required
              />
            </div>
            <p className="hint">
              Sonraki taksitler her ay aynı güne atanır. O gün bulunmayan
              aylarda ayın son günü kullanılır.
            </p>
          </section>
        </div>
        <aside className="sale-aside">
          <div className="panel summary-card">
            <h2>Satış özeti</h2>
            <div className="summary-line">
              <span>Toplam satış</span>
              <strong>{formatMoney(totalCents)}</strong>
            </div>
            <div className="summary-line">
              <span>Peşinat</span>
              <strong>− {formatMoney(downCents)}</strong>
            </div>
            <div className="summary-line total">
              <span>Taksitlendirilecek</span>
              <strong>{formatMoney(Math.max(0, financedCents))}</strong>
            </div>
            <div className="summary-plan">
              <h3>Ödeme planı</h3>
              {plan.length ? (
                plan.map((part) => (
                  <div key={part.number}>
                    <span>
                      {part.number}. taksit{" "}
                      <small>{formatDate(part.dueDate)}</small>
                    </span>
                    <strong>{formatMoney(part.amountCents)}</strong>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Tutarları ve taksit sayısını girince plan burada görünür.
                </p>
              )}
            </div>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary full"
              disabled={saving}
              type="submit"
            >
              {saving ? "Kaydediliyor…" : "Satışı kaydet"}
              <ArrowRight size={18} />
            </button>
            <p className="hint center">
              Kaydettikten sonra ödeme planını yazdırabilirsiniz.
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}
