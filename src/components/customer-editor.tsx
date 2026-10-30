"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import type { Customer } from "@/lib/data";
import { formatMoney } from "@/lib/finance";

const fields: {
  key: keyof Omit<Customer, "id">;
  label: string;
  type?: string;
}[] = [
  { key: "full_name", label: "Adı soyadı" },
  { key: "address", label: "Adres" },
  { key: "home_phone", label: "Ev telefonu" },
  { key: "work_phone", label: "İş telefonu" },
  { key: "mobile_phone", label: "Cep telefonu" },
  { key: "tc_identity_no", label: "TC kimlik no" },
  { key: "birth_place", label: "Doğum yeri" },
  { key: "birth_date", label: "Doğum tarihi", type: "date" },
  { key: "province", label: "İl" },
  { key: "district", label: "İlçe" },
  { key: "neighborhood_village", label: "Mahalle / köy" },
  { key: "volume_no", label: "Cilt no" },
  { key: "registration_no", label: "Kayıt no" },
  { key: "row_no", label: "Sıra no" },
  { key: "serial_no", label: "Seri no" },
  { key: "tax_office", label: "Vergi dairesi" },
  { key: "tax_no", label: "Vergi no" },
];
type Values = Record<(typeof fields)[number]["key"], string>;

export default function CustomerEditor({
  customer,
  sales,
}: {
  customer: Customer & { deleted_at: string | null };
  sales: {
    id: string;
    total_cents: number;
    created_at: string;
    invoice_no: string | null;
  }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(
    () =>
      Object.fromEntries(
        fields.map(({ key }) => [key, customer[key] ?? ""]),
      ) as Values,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const archived = Boolean(customer.deleted_at);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    setSaved(false);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Kaydedilemedi.");
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Hata oluştu.");
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (
      !window.confirm(
        `${customer.full_name} müşteri listesinden kaldırılacak. Geçmiş satış ve ödeme kayıtları korunacak. Devam edilsin mi?`,
      )
    )
      return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Müşteri kaldırılamadı.");
      router.push("/customers");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Hata oluştu.");
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <Link href="/customers" className="back-link">
            <ArrowLeft size={17} /> Müşteriler
          </Link>
          <h1>{customer.full_name}</h1>
          <p>
            {archived
              ? "Bu müşteri listeden kaldırılmıştır."
              : "İletişim ve kimlik bilgilerini güncelleyin."}
          </p>
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-main">
          <form onSubmit={save} className="panel form-section">
            <div className="section-heading">
              <h2>Müşteri bilgileri</h2>
            </div>
            <div className="form-grid three">
              {fields.map(({ key, label, type }) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <input
                    type={type ?? "text"}
                    value={values[key]}
                    disabled={archived || busy}
                    required={key === "full_name"}
                    onChange={(event) =>
                      setValues((old) => ({
                        ...old,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="success-text" role="status">
                Bilgiler kaydedildi.
              </p>
            )}
            {!archived && (
              <button className="button primary" disabled={busy} type="submit">
                <Save size={17} /> Kaydet
              </button>
            )}
          </form>
          {!archived && (
            <section className="panel danger-panel">
              <h2>Müşteriyi sil</h2>
              <p>Listeden kaldırılır. Geçmiş satışlar ve ödemeler korunur.</p>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={archive}
              >
                <Trash2 size={17} /> Müşteriyi kaldır
              </button>
            </section>
          )}
        </div>
        <aside className="detail-side">
          <section className="panel">
            <h2>Satış geçmişi</h2>
            {sales.length ? (
              sales.map((sale) => (
                <div key={sale.id} className="summary-line">
                  <Link href={`/sales/${sale.id}`}>
                    {sale.invoice_no || "Satış detayı"}
                  </Link>
                  <strong>{formatMoney(sale.total_cents)}</strong>
                </div>
              ))
            ) : (
              <p className="muted">Satış bulunmuyor.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
