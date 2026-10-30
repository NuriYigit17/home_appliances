import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Pencil,
  Printer,
  UserRound,
} from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getSaleDetail } from "@/lib/data";
import { formatDate, formatMoney } from "@/lib/finance";
import PaymentForm from "@/components/payment-form";
import VoidPaymentButton from "@/components/void-payment-button";
import DeliveryControl from "@/components/delivery-control";

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

const statusLabel = {
  paid: "Ödendi",
  partial: "Kısmi ödeme",
  overdue: "Gecikmiş",
  upcoming: "Yaklaşıyor",
  pending: "Bekliyor",
};

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const detail = await getSaleDetail(supabase, id);
  if (!detail) notFound();
  const {
    sale,
    customer,
    guarantor,
    items,
    installments,
    payments,
    paidCents,
    remainingCents,
  } = detail;
  return (
    <>
      <div className="page-heading detail-heading">
        <div>
          <Link href="/" className="back-link">
            <ArrowLeft size={17} /> Dashboard
          </Link>
          <span className="eyebrow">MÜŞTERİ HESAP KARTI</span>
          <h1>{customer.full_name}</h1>
          <p>
            Hesap no: {sale.account_no || "—"} · Fatura no:{" "}
            {sale.invoice_no || "—"}
          </p>
        </div>
        <div className="section-actions">
          <Link href={`/customers/${customer.id}`} className="button secondary">
            <Pencil size={18} /> Müşteriyi düzenle
          </Link>
          <Link href={`/sales/${id}/print`} className="button secondary">
            <Printer size={18} /> Ödeme planını yazdır
          </Link>
        </div>
      </div>

      <section className="stat-grid three-cards">
        <div className="stat-card">
          <span>Toplam borcu</span>
          <strong>{formatMoney(sale.total_cents)}</strong>
          <small>{items.length} ürün</small>
        </div>
        <div className="stat-card">
          <span>Toplam ödenen</span>
          <strong>{formatMoney(paidCents)}</strong>
          <small>Peşinat dahil</small>
        </div>
        <div className="stat-card">
          <span>Kalan borcu</span>
          <strong>{formatMoney(remainingCents)}</strong>
          <small>
            {installments.filter((part) => part.remainingCents > 0).length}{" "}
            taksit açık
          </small>
        </div>
      </section>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Taksit planı</h2>
                <p>
                  {sale.installment_count} aylık taksit · İlk vade{" "}
                  {formatDate(sale.first_due_date)}
                </p>
              </div>
              <CalendarDays size={21} />
            </div>
            <div className="installment-list">
              {installments.map((part) => (
                <article className="installment" key={part.id}>
                  <div className="installment-top">
                    <div className="installment-number">
                      {part.installment_no}
                    </div>
                    <div className="installment-main">
                      <strong>{part.installment_no}. taksit</strong>
                      <span>{formatDate(part.due_date)}</span>
                    </div>
                    <div className="installment-amount">
                      <strong>{formatMoney(part.amount_cents)}</strong>
                      <small>Kalan {formatMoney(part.remainingCents)}</small>
                    </div>
                    <span className={`badge ${part.status}`}>
                      {statusLabel[part.status]}
                    </span>
                  </div>
                  {part.paidCents > 0 && (
                    <div className="installment-progress">
                      <span
                        style={{
                          width: `${Math.min(100, (part.paidCents / part.amount_cents) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  {part.remainingCents > 0 && (
                    <PaymentForm
                      key={`${part.id}-${part.remainingCents}`}
                      installmentId={part.id}
                      remainingCents={part.remainingCents}
                    />
                  )}
                  {part.payments.length > 0 && (
                    <div className="payment-mini-list">
                      {part.payments.map((payment) => (
                        <div key={payment.id}>
                          <span>
                            {formatDate(payment.paid_on)} tarihinde{" "}
                            {formatMoney(payment.amount_cents)} alındı
                          </span>
                          <VoidPaymentButton paymentId={payment.id} />
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Satılan ürünler</h2>
                <p>Satış anındaki ürün ve fiyat bilgileri</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Adet</th>
                    <th>Birim fiyatı</th>
                    <th>Satış tarihi</th>
                    <th>Teslim tarihi</th>
                    <th>Teslim durumu</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="weight-semibold">{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatMoney(item.unit_price_cents)}</td>
                      <td>{formatDate(item.sale_date)}</td>
                      <td>{formatDate(item.delivery_date)}</td>
                      <td>
                        <span
                          className={`badge ${item.delivered ? "paid" : "pending"}`}
                        >
                          {item.delivered ? "Teslim edildi" : "Teslim edilmedi"}
                        </span>
                      </td>
                      <td>
                        <DeliveryControl
                          itemId={item.id}
                          delivered={item.delivered}
                          deliveryDate={item.delivery_date}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Ödeme geçmişi</h2>
                <p>Peşinat ve taksit tahsilatları</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>İşlem</th>
                    <th>Tutar</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.paid_on)}</td>
                      <td>
                        {payment.kind === "down_payment"
                          ? "Peşinat"
                          : `${installments.find((item) => item.id === payment.installment_id)?.installment_no ?? "—"}. taksit`}
                      </td>
                      <td className="weight-semibold">
                        {formatMoney(payment.amount_cents)}
                      </td>
                      <td>
                        {payment.voided_at ? (
                          <span className="badge overdue">Geri alındı</span>
                        ) : (
                          <span className="badge paid">Alındı</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {payments.length === 0 && (
              <p className="empty-small">Henüz ödeme kaydı yok.</p>
            )}
          </section>
        </div>
        <aside className="detail-side">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Müşteri bilgileri</h2>
              </div>
              <UserRound size={20} />
            </div>
            <div className="detail-fields">
              <Detail label="Adı soyadı" value={customer.full_name} />
              <Detail label="Adresi" value={customer.address} />
              <Detail label="Ev tel" value={customer.home_phone} />
              <Detail label="İş tel" value={customer.work_phone} />
              <Detail label="Cep tel" value={customer.mobile_phone} />
              <Detail label="TC kimlik no" value={customer.tc_identity_no} />
              <Detail label="Doğum yeri" value={customer.birth_place} />
              <Detail
                label="Doğum tarihi"
                value={formatDate(customer.birth_date)}
              />
              <Detail label="İl" value={customer.province} />
              <Detail label="İlçesi" value={customer.district} />
              <Detail
                label="Mahalle / köy"
                value={customer.neighborhood_village}
              />
              <Detail label="Cilt no" value={customer.volume_no} />
              <Detail label="Kayıt no" value={customer.registration_no} />
              <Detail label="Sıra no" value={customer.row_no} />
              <Detail label="Seri no" value={customer.serial_no} />
              <Detail label="Vergi dairesi" value={customer.tax_office} />
              <Detail label="Vergi no" value={customer.tax_no} />
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Kefil bilgileri</h2>
              </div>
            </div>
            {guarantor ? (
              <div className="detail-fields">
                <Detail label="Kefili" value={guarantor.full_name} />
                <Detail label="Adresi" value={guarantor.address} />
                <Detail label="Ev tel" value={guarantor.home_phone} />
                <Detail label="İş tel" value={guarantor.work_phone} />
                <Detail label="Cep tel" value={guarantor.mobile_phone} />
              </div>
            ) : (
              <p className="muted">Kefil girilmemiş.</p>
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Satış bilgileri</h2>
              </div>
            </div>
            <div className="detail-fields">
              <Detail
                label="Fatura tarihi"
                value={formatDate(sale.invoice_date)}
              />
              <Detail label="Fatura no" value={sale.invoice_no} />
              <Detail label="Hesap no" value={sale.account_no} />
              <Detail
                label="Taksit seçeneği"
                value={`${sale.installment_count} ay`}
              />
              <Detail
                label="Peşinat"
                value={formatMoney(sale.down_payment_cents)}
              />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
