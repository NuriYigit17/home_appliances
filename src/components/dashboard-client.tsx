"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  CircleCheck,
  Coins,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import type { getDashboardData } from "@/lib/data";
import { addDays, formatDate, formatMoney } from "@/lib/finance";
import PushSettings from "@/components/push-settings";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export default function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "overdue" | "upcoming" | "closed"
  >("all");
  const rows = useMemo(
    () =>
      data.rows.filter((row) => {
        const text =
          `${row.customer?.full_name ?? ""} ${row.products} ${row.invoice_no ?? ""} ${row.account_no ?? ""}`.toLocaleLowerCase(
            "tr-TR",
          );
        if (!text.includes(search.toLocaleLowerCase("tr-TR"))) return false;
        if (filter === "overdue") return row.overdueCents > 0;
        if (filter === "closed") return row.remainingCents === 0;
        if (filter === "upcoming") return row.upcomingInstallments.length > 0;
        return true;
      }),
    [data, filter, search],
  );
  const thisMonth = data.months[5];
  const nextMonth = data.months[6];
  const maxChart = Math.max(
    1,
    ...data.months.map((month) =>
      month.future ? month.expectedCents : month.actualCents,
    ),
  );
  const upcomingEntries = data.rows
    .flatMap((row) =>
      row.upcomingInstallments.map((installment) => ({ row, installment })),
    )
    .sort((a, b) =>
      a.installment.due_date.localeCompare(b.installment.due_date),
    );

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">GENEL BAKIŞ</span>
          <h1>Dashboard</h1>
          <p>Satışlar ve tahsilatlar tek ekranda.</p>
        </div>
        <Link href="/sales/new" className="button primary">
          <Plus size={20} /> Satış yap
        </Link>
      </div>

      <section className="stat-grid" aria-label="Özet">
        <div className="stat-card">
          <div className="stat-icon green">
            <Coins size={22} />
          </div>
          <span>Bu ay alınan</span>
          <strong>{formatMoney(thisMonth.actualCents)}</strong>
          <small>Peşinat ve taksit ödemeleri</small>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">
            <TrendingUp size={22} />
          </div>
          <span>Toplam tahsilat</span>
          <strong>{formatMoney(data.totalPaidCents)}</strong>
          <small>Tüm zamanlar</small>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <CalendarDays size={22} />
          </div>
          <span>Kalan alacak</span>
          <strong>{formatMoney(data.totalOutstandingCents)}</strong>
          <small>
            Gelecek ay beklenen: {formatMoney(nextMonth.expectedCents)}
          </small>
        </div>
        <div className="stat-card">
          <div className="stat-icon rose">
            <AlertTriangle size={22} />
          </div>
          <span>Geciken ödeme</span>
          <strong>{formatMoney(data.overdueCents)}</strong>
          <small>Vadesi geçmiş kalan tutar</small>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="section-heading">
            <div>
              <h2>Tahsilat görünümü</h2>
              <p>Geçmiş tahsilatlar ve gelecek vadeler</p>
            </div>
            <span className="chart-legend">
              <i /> Alınan <i className="future" /> Beklenen
            </span>
          </div>
          <div className="chart" role="img" aria-label="Aylık tahsilat grafiği">
            {data.months.map((month) => {
              const amount = month.future
                ? month.expectedCents
                : month.actualCents;
              const height =
                amount === 0 ? 0 : Math.max(4, (amount / maxChart) * 100);
              const label = new Date(
                `${month.key}-01T00:00:00Z`,
              ).toLocaleDateString("tr-TR", {
                month: "short",
                year: "2-digit",
                timeZone: "UTC",
              });
              return (
                <div
                  className="chart-column"
                  key={month.key}
                  title={`${label}: ${formatMoney(amount)} ${month.future ? "beklenen" : "alınan"}`}
                >
                  <div className="chart-track">
                    <div
                      className={`chart-bar ${month.future ? "future" : ""}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel notice-panel">
          <div className="section-heading">
            <div>
              <h2>Yaklaşan ödemeler</h2>
              <p>Önümüzdeki 3 gün</p>
            </div>
            <Bell size={20} />
          </div>
          <div className="notice-list">
            {upcomingEntries.slice(0, 5).map(({ row, installment }) => (
              <Link
                key={installment.id}
                href={`/sales/${row.id}`}
                className="notice-item"
              >
                <span className="notice-avatar">
                  {row.customer?.full_name?.charAt(0) ?? "?"}
                </span>
                <span>
                  <strong>{row.customer?.full_name}</strong>
                  <small>
                    {formatDate(installment.due_date)} ·{" "}
                    {formatMoney(installment.remainingCents)}
                  </small>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
            {upcomingEntries.length === 0 && (
              <p className="empty-small">Yaklaşan ödeme bulunmuyor.</p>
            )}
          </div>
          <PushSettings />
        </section>
      </div>

      <section className="panel table-panel">
        <div className="section-heading table-title">
          <div>
            <h2>Satışlar ve alacaklar</h2>
            <p>{data.rows.length} satış kaydı</p>
          </div>
        </div>
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Müşteri, ürün veya fatura ara"
              aria-label="Satışlarda ara"
            />
          </label>
          <div className="filter-tabs" role="group" aria-label="Satış filtresi">
            {(
              [
                ["all", "Tümü"],
                ["overdue", "Geciken"],
                ["upcoming", "Yaklaşan"],
                ["closed", "Tamamlanan"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Müşteri / Ürün</th>
                <th>Toplam satış</th>
                <th>Alınan</th>
                <th>Kalan</th>
                <th>Sonraki taksit</th>
                <th>Durum</th>
                <th aria-label="Aç" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status =
                  row.remainingCents === 0
                    ? "Ödendi"
                    : row.overdueCents > 0
                      ? "Gecikmiş"
                      : row.nextInstallment &&
                          row.nextInstallment.due_date <= addDays(data.today, 3)
                        ? "Yaklaşıyor"
                        : "Devam ediyor";
                const tone =
                  row.remainingCents === 0
                    ? "paid"
                    : row.overdueCents > 0
                      ? "overdue"
                      : status === "Yaklaşıyor"
                        ? "upcoming"
                        : "pending";
                return (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/sales/${row.id}`)}
                    className="clickable-row"
                  >
                    <td>
                      <strong>{row.customer?.full_name ?? "Müşteri"}</strong>
                      <small>{row.products}</small>
                    </td>
                    <td>{formatMoney(row.total_cents)}</td>
                    <td>{formatMoney(row.paidCents)}</td>
                    <td className="weight-semibold">
                      {formatMoney(row.remainingCents)}
                    </td>
                    <td>
                      {row.nextInstallment ? (
                        <>
                          <strong>
                            {formatDate(row.nextInstallment.due_date)}
                          </strong>
                          <small>
                            {formatMoney(row.nextInstallment.remainingCents)}
                          </small>
                        </>
                      ) : (
                        <CircleCheck className="success-text" size={19} />
                      )}
                    </td>
                    <td>
                      <span className={`badge ${tone}`}>{status}</span>
                    </td>
                    <td>
                      <Link
                        href={`/sales/${row.id}`}
                        aria-label={`${row.customer?.full_name} detayını aç`}
                      >
                        <ArrowRight size={18} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="empty-state">
            <Search size={28} />
            <strong>Kayıt bulunamadı</strong>
            <p>Aramanızı değiştirin veya yeni satış ekleyin.</p>
          </div>
        )}
      </section>
    </>
  );
}
