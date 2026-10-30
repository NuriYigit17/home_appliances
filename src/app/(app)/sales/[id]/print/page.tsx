import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getSaleDetail } from "@/lib/data";
import { formatDate, formatMoney } from "@/lib/finance";
import PrintButton from "@/components/print-button";

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const detail = await getSaleDetail(supabase, id);
  if (!detail) notFound();
  const { sale, customer, items, installments } = detail;
  return (
    <>
      <div className="page-heading print-controls">
        <div>
          <Link href={`/sales/${id}`} className="back-link">
            <ArrowLeft size={17} /> Müşteri detayına dön
          </Link>
          <h1>Ödeme planı</h1>
          <p>Yazdırmadan önce planı kontrol edin.</p>
        </div>
        <PrintButton />
      </div>
      <article className="print-sheet">
        <div className="print-sheet-header">
          <div>
            <span className="eyebrow">MÜŞTERİ NÜSHASI</span>
            <h1>Ödeme Planı</h1>
          </div>
          <span className="print-date">
            Düzenlenme: {formatDate(items[0]?.sale_date)}
          </span>
        </div>
        <div className="print-info-grid">
          <div>
            <small>Müşteri</small>
            <strong>{customer.full_name}</strong>
          </div>
          <div>
            <small>Telefon</small>
            <strong>
              {customer.mobile_phone || customer.home_phone || "—"}
            </strong>
          </div>
          <div>
            <small>Fatura no</small>
            <strong>{sale.invoice_no || "—"}</strong>
          </div>
          <div>
            <small>Hesap no</small>
            <strong>{sale.account_no || "—"}</strong>
          </div>
        </div>
        <h2>Satılan ürünler</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Adet</th>
              <th>Birim fiyat</th>
              <th>Toplam</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.product_name}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unit_price_cents)}</td>
                <td>{formatMoney(item.unit_price_cents * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="print-totals">
          <div>
            <span>Toplam satış</span>
            <strong>{formatMoney(sale.total_cents)}</strong>
          </div>
          <div>
            <span>Alınan peşinat</span>
            <strong>{formatMoney(sale.down_payment_cents)}</strong>
          </div>
          <div className="emphasis">
            <span>Taksitlendirilen tutar</span>
            <strong>
              {formatMoney(sale.total_cents - sale.down_payment_cents)}
            </strong>
          </div>
        </div>
        <h2>Taksitler</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Ödeme tarihi</th>
              <th>Taksit tutarı</th>
              <th>Ödeme işareti</th>
            </tr>
          </thead>
          <tbody>
            {installments.map((part) => (
              <tr key={part.id}>
                <td>{part.installment_no}</td>
                <td>{formatDate(part.due_date)}</td>
                <td>{formatMoney(part.amount_cents)}</td>
                <td className="print-checkbox">□</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="print-note">
          Bu belge satışa ait ödeme planını gösterir. Ödeme alındıkça mağaza
          kayıtlarına işlenir.
        </p>
        <div className="signature-row">
          <span>Satıcı imzası</span>
          <span>Müşteri imzası</span>
        </div>
      </article>
    </>
  );
}
