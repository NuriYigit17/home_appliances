"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import type { Customer, Sale } from "@/lib/data";
import { formatMoney } from "@/lib/finance";

export default function CustomerList({
  rows,
}: {
  rows: { customer: Customer; sales: Sale[] }[];
}) {
  const [query, setQuery] = useState("");
  const visible = rows.filter(({ customer }) =>
    `${customer.full_name} ${customer.mobile_phone ?? ""} ${customer.home_phone ?? ""}`
      .toLocaleLowerCase("tr")
      .includes(query.toLocaleLowerCase("tr")),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KAYITLAR</span>
          <h1>Müşteriler</h1>
          <p>Müşteri bilgilerini düzenleyin ve satış geçmişini görün.</p>
        </div>
      </div>
      <section className="panel table-panel customer-list">
        <div className="table-title section-heading">
          <h2>{rows.length} müşteri</h2>
        </div>
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ad veya telefonla ara"
              aria-label="Müşteri ara"
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Müşteri</th>
                <th>Telefon</th>
                <th>Satış</th>
                <th>Toplam satış</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ customer, sales }) => (
                <tr key={customer.id}>
                  <td>
                    <strong>{customer.full_name}</strong>
                  </td>
                  <td>{customer.mobile_phone || customer.home_phone || "—"}</td>
                  <td>{sales.length}</td>
                  <td>
                    {formatMoney(
                      sales.reduce((sum, sale) => sum + sale.total_cents, 0),
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/customers/${customer.id}`}
                      className="button secondary small"
                    >
                      Düzenle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <div className="empty-state">
            <UserRound size={30} />
            <strong>Müşteri bulunamadı</strong>
            <p>Aramayı değiştirin veya yeni satış ekleyin.</p>
          </div>
        )}
      </section>
    </>
  );
}
