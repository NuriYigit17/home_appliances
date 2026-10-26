import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("satış, peşinat, aylık plan ve kısmi ödeme veritabanında tutarlı kalır", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    `);
    const migration = await readFile(
      new URL(
        "../supabase/migrations/20261026000000_initial.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(migration);
    const userId = "10000000-0000-4000-8000-000000000001";
    await db.query("insert into auth.users (id) values ($1)", [userId]);
    await db.query(
      "insert into public.staff (user_id, display_name) values ($1, 'Test')",
      [userId],
    );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '${userId}';`,
    );

    const payload = {
      customer: { full_name: "Ayşe Yılmaz", tc_identity_no: "12345678901" },
      guarantor: { full_name: "Mehmet Yılmaz" },
      invoice_date: "2026-12-01",
      invoice_no: "F-1",
      account_no: "H-1",
      items: [
        {
          product_name: "Buzdolabı",
          quantity: 1,
          unit_price_cents: 400000,
          sale_date: "2026-12-01",
          delivery_date: "",
          delivered: false,
        },
      ],
      installment_count: 3,
      first_due_date: "2027-01-31",
      down_payment_cents: 100000,
      down_payment_date: "2026-12-01",
    };
    const created = await db.query<{ id: string }>(
      "select public.create_sale($1::jsonb) as id",
      [JSON.stringify(payload)],
    );
    const saleId = created.rows[0].id;
    const installments = await db.query<{
      id: string;
      due_date: string;
      amount_cents: string;
    }>(
      "select id, due_date::text, amount_cents::text from public.installments where sale_id = $1 order by installment_no",
      [saleId],
    );
    assert.deepEqual(
      installments.rows.map((row) => row.due_date),
      ["2027-01-31", "2027-02-28", "2027-03-31"],
    );
    assert.equal(
      installments.rows.reduce((sum, row) => sum + Number(row.amount_cents), 0),
      300000,
    );
    const downPayment = await db.query<{ amount_cents: string }>(
      "select amount_cents::text from public.payments where sale_id = $1 and kind = 'down_payment'",
      [saleId],
    );
    assert.equal(Number(downPayment.rows[0].amount_cents), 100000);

    const first = installments.rows[0].id;
    await db.query(
      "select public.record_payment($1::uuid, $2::bigint, $3::date)",
      [first, 50000, "2027-01-30"],
    );
    await assert.rejects(() =>
      db.query("select public.record_payment($1::uuid, $2::bigint, $3::date)", [
        first,
        60000,
        "2027-01-31",
      ]),
    );
    const second = await db.query<{ record_payment: string }>(
      "select public.record_payment($1::uuid, $2::bigint, $3::date)",
      [first, 50000, "2027-01-31"],
    );
    const paid = await db.query<{ sum: string }>(
      "select sum(amount_cents)::text from public.payments where installment_id = $1 and voided_at is null",
      [first],
    );
    assert.equal(Number(paid.rows[0].sum), 100000);
    await db.query("select public.void_payment($1::uuid, $2::text)", [
      second.rows[0].record_payment,
      "Yanlış kayıt",
    ]);
    const remaining = await db.query<{ sum: string }>(
      "select sum(amount_cents)::text from public.payments where installment_id = $1 and voided_at is null",
      [first],
    );
    assert.equal(Number(remaining.rows[0].sum), 50000);
    const ledger = await db.query<{
      paid_date: string;
      remaining_cents: string;
    }>(
      "select paid_date::text, remaining_cents::text from public.installment_ledger where id = $1",
      [first],
    );
    assert.equal(ledger.rows[0].paid_date, "2027-01-30");
    assert.equal(Number(ledger.rows[0].remaining_cents), 50000);
    const balance = await db.query<{
      total_paid_cents: string;
      remaining_debt_cents: string;
    }>(
      "select total_paid_cents::text, remaining_debt_cents::text from public.sale_balances where sale_id = $1",
      [saleId],
    );
    assert.equal(Number(balance.rows[0].total_paid_cents), 150000);
    assert.equal(Number(balance.rows[0].remaining_debt_cents), 250000);
    await assert.rejects(() =>
      db.query(
        "insert into public.payments (sale_id,kind,amount_cents,paid_on,created_by) values ($1,'down_payment',1,current_date,$2)",
        [saleId, userId],
      ),
    );
    await db.exec(
      "set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000099';",
    );
    const hidden = await db.query("select id from public.sales");
    assert.equal(hidden.rows.length, 0);
    await assert.rejects(() =>
      db.query("select public.create_sale($1::jsonb)", [
        JSON.stringify(payload),
      ]),
    );
  } finally {
    await db.close();
  }
});
