import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("stok satışta atomik düşer; yetersiz stok satışı ve müşteri arşivleme", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    `);
    for (const file of [
      "20261026000000_initial.sql",
      "20261030000000_inventory_customers.sql",
    ]) {
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    }
    const userId = "10000000-0000-4000-8000-000000000001";
    await db.query("insert into auth.users (id) values ($1)", [userId]);
    await db.query(
      "insert into public.staff (user_id, display_name) values ($1, 'Test')",
      [userId],
    );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '${userId}';`,
    );
    const product = await db.query<{ id: string }>(
      "select public.create_product($1::jsonb) as id",
      [
        JSON.stringify({
          name: "Buzdolabı",
          sku: "B-1",
          unit_price_cents: 400000,
          initial_quantity: 2,
          reorder_at: 1,
        }),
      ],
    );
    const productId = product.rows[0].id;
    const payload = {
      customer: { full_name: "Ayşe Yılmaz" },
      guarantor: {},
      items: [
        {
          product_id: productId,
          product_name: "Buzdolabı",
          quantity: 1,
          unit_price_cents: 400000,
          sale_date: "2026-10-30",
          delivered: false,
        },
      ],
      installment_count: 2,
      first_due_date: "2026-11-30",
      down_payment_cents: 100000,
      down_payment_date: "2026-10-30",
    };
    const sale = await db.query<{ id: string }>(
      "select public.create_sale($1::jsonb) as id",
      [JSON.stringify(payload)],
    );
    const stock = await db.query<{ stock_quantity: number }>(
      "select stock_quantity from public.products where id = $1",
      [productId],
    );
    assert.equal(stock.rows[0].stock_quantity, 1);
    const moves = await db.query<{ quantity_delta: number }>(
      "select quantity_delta from public.stock_movements where product_id = $1 order by created_at",
      [productId],
    );
    assert.deepEqual(
      moves.rows.map((row) => row.quantity_delta),
      [2, -1],
    );
    await assert.rejects(
      db.query("select public.create_sale($1::jsonb)", [
        JSON.stringify({
          ...payload,
          items: [{ ...payload.items[0], quantity: 2 }],
        }),
      ]),
    );
    const after = await db.query<{ stock_quantity: number }>(
      "select stock_quantity from public.products where id = $1",
      [productId],
    );
    assert.equal(after.rows[0].stock_quantity, 1);
    await db.query("select public.adjust_stock($1::uuid, 3, 'Yeni teslimat')", [
      productId,
    ]);
    const restocked = await db.query<{ stock_quantity: number }>(
      "select stock_quantity from public.products where id = $1",
      [productId],
    );
    assert.equal(restocked.rows[0].stock_quantity, 4);
    const customer = await db.query<{ customer_id: string }>(
      "select customer_id from public.sales where id = $1",
      [sale.rows[0].id],
    );
    await db.query(
      "update public.customers set deleted_at = now() where id = $1",
      [customer.rows[0].customer_id],
    );
    const history = await db.query<{ count: string }>(
      "select count(*)::text from public.sales where customer_id = $1",
      [customer.rows[0].customer_id],
    );
    assert.equal(Number(history.rows[0].count), 1);
  } finally {
    await db.close();
  }
});
