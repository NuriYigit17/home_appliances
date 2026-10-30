"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Plus, Save, Search } from "lucide-react";
import type { StockMovement, StockProduct } from "@/lib/data";
import { formatMoney, parseMoney } from "@/lib/finance";

type ProductFields = {
  name: string;
  sku: string;
  price: string;
  reorder: string;
  quantity: string;
  active: boolean;
};
const empty: ProductFields = {
  name: "",
  sku: "",
  price: "0",
  reorder: "2",
  quantity: "0",
  active: true,
};
const fromProduct = (product: StockProduct): ProductFields => ({
  name: product.name,
  sku: product.sku ?? "",
  price: (product.unit_price_cents / 100).toFixed(2),
  reorder: String(product.reorder_at),
  quantity: String(product.stock_quantity),
  active: product.active,
});

async function send(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "İşlem tamamlanamadı.");
  return result;
}

export default function StockClient({
  data,
}: {
  data: { products: StockProduct[]; movements: StockMovement[] };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "stock">("stock");
  const [fields, setFields] = useState<ProductFields>(empty);
  const [direction, setDirection] = useState("in");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const products = data.products.filter((product) =>
    `${product.name} ${product.sku ?? ""}`
      .toLocaleLowerCase("tr")
      .includes(query.toLocaleLowerCase("tr")),
  );
  const active = data.products.filter((product) => product.active);
  const low = active.filter(
    (product) => product.stock_quantity <= product.reorder_at,
  );
  function open(product: StockProduct, nextMode: "edit" | "stock") {
    setCreating(false);
    setSelected(product.id);
    setMode(nextMode);
    setFields(fromProduct(product));
    setError("");
    setSuccess("");
    setAmount("");
    setNote("");
  }
  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const price = parseMoney(fields.price);
    if (price === null) {
      setError("Fiyatı kontrol edin.");
      return;
    }
    setBusy(true);
    try {
      await send("/api/products", "POST", {
        name: fields.name,
        sku: fields.sku,
        unit_price_cents: price,
        reorder_at: Number(fields.reorder),
        initial_quantity: Number(fields.quantity),
      });
      setFields(empty);
      setCreating(false);
      setSuccess("Ürün eklendi.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Hata oluştu.");
    } finally {
      setBusy(false);
    }
  }
  async function submitEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setSuccess("");
    const price = parseMoney(fields.price);
    if (price === null) {
      setError("Fiyatı kontrol edin.");
      return;
    }
    setBusy(true);
    try {
      await send(`/api/products/${selected}`, "PATCH", {
        name: fields.name,
        sku: fields.sku,
        unit_price_cents: price,
        reorder_at: Number(fields.reorder),
        active: fields.active,
      });
      setSelected(null);
      setSuccess("Ürün güncellendi.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Hata oluştu.");
    } finally {
      setBusy(false);
    }
  }
  async function submitStock(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setSuccess("");
    const quantity = Number(amount);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Geçerli bir adet girin.");
      return;
    }
    setBusy(true);
    try {
      await send(`/api/products/${selected}/stock`, "POST", {
        delta: direction === "in" ? quantity : -quantity,
        note,
      });
      setSelected(null);
      setAmount("");
      setNote("");
      setSuccess("Stok hareketi kaydedildi.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Hata oluştu.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ÜRÜN YÖNETİMİ</span>
          <h1>Stok takibi</h1>
          <p>Ürünleri ve adetleri kaydedin; satışta stok otomatik azalır.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setCreating(true);
            setSelected(null);
            setFields(empty);
            setError("");
          }}
        >
          <Plus size={18} /> Yeni ürün
        </button>
      </div>
      <div className="stock-grid">
        <div className="stat-card">
          <span>Aktif ürün</span>
          <strong>{active.length}</strong>
          <small>Katalogdaki ürünler</small>
        </div>
        <div className="stat-card">
          <span>Toplam adet</span>
          <strong>
            {active.reduce((sum, product) => sum + product.stock_quantity, 0)}
          </strong>
          <small>Aktif ürünlerin stoku</small>
        </div>
        <div className="stat-card">
          <span>Azalan stok</span>
          <strong className="stock-low">{low.length}</strong>
          <small>Uyarı sınırında veya altında</small>
        </div>
        <div className="stat-card">
          <span>Stok liste değeri</span>
          <strong>
            {formatMoney(
              active.reduce(
                (sum, product) =>
                  sum + product.stock_quantity * product.unit_price_cents,
                0,
              ),
            )}
          </strong>
          <small>Birim satış fiyatlarıyla</small>
        </div>
      </div>
      {success && (
        <p className="alert" role="status">
          {success}
        </p>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {creating && (
        <section className="panel form-section">
          <div className="section-heading">
            <h2>Yeni ürün ekle</h2>
          </div>
          <form onSubmit={submitCreate}>
            <ProductInputs
              fields={fields}
              setFields={setFields}
              includeQuantity
            />
            <div className="inline-actions">
              <button className="button primary" disabled={busy}>
                <Plus size={17} /> Kaydet
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setCreating(false)}
              >
                Vazgeç
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="panel table-panel">
        <div className="table-title section-heading">
          <h2>Ürünler</h2>
        </div>
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Ürün ara"
              placeholder="Ürün veya kod ara"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Ürün kodu</th>
                <th>Birim fiyat</th>
                <th>Stok</th>
                <th>Uyarı sınırı</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                  </td>
                  <td>{product.sku || "—"}</td>
                  <td>{formatMoney(product.unit_price_cents)}</td>
                  <td>
                    <span
                      className={`stock-quantity ${product.stock_quantity <= product.reorder_at ? "stock-low" : ""}`}
                    >
                      {product.stock_quantity}
                    </span>
                  </td>
                  <td>{product.reorder_at}</td>
                  <td>{product.active ? "Aktif" : "Pasif"}</td>
                  <td>
                    <div className="inline-actions">
                      <button
                        className="text-button"
                        onClick={() => open(product, "stock")}
                      >
                        Stok giriş / çıkış
                      </button>
                      <button
                        className="text-button"
                        onClick={() => open(product, "edit")}
                      >
                        Düzenle
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!products.length && (
          <div className="empty-state">
            <Boxes size={30} />
            <strong>Ürün bulunamadı</strong>
            <p>Yeni ürün ekleyerek stok takibini başlatın.</p>
          </div>
        )}
      </section>
      {selected && (
        <section className="panel form-section" style={{ marginTop: 20 }}>
          <div className="section-heading">
            <div>
              <h2>{fields.name}</h2>
              <p>
                {mode === "stock"
                  ? "Stok adedini artırın veya azaltın."
                  : "Ürün kartını düzenleyin."}
              </p>
            </div>
          </div>
          {mode === "edit" ? (
            <form onSubmit={submitEdit}>
              <ProductInputs fields={fields} setFields={setFields} />
              <label className="field" style={{ marginBottom: 16 }}>
                <span>Durum</span>
                <select
                  value={fields.active ? "active" : "passive"}
                  onChange={(event) =>
                    setFields((old) => ({
                      ...old,
                      active: event.target.value === "active",
                    }))
                  }
                >
                  <option value="active">Aktif</option>
                  <option value="passive">Pasif</option>
                </select>
              </label>
              <div className="inline-actions">
                <button className="button primary" disabled={busy}>
                  <Save size={17} /> Kaydet
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setSelected(null)}
                >
                  Vazgeç
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitStock}>
              <div className="form-grid three">
                <label className="field">
                  <span>İşlem</span>
                  <select
                    value={direction}
                    onChange={(event) => setDirection(event.target.value)}
                  >
                    <option value="in">Stok girişi (+)</option>
                    <option value="out">Stok çıkışı (−)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Adet</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Açıklama</span>
                  <input
                    required
                    maxLength={300}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Örn. Tedarikçi teslimatı"
                  />
                </label>
              </div>
              <div className="inline-actions">
                <button className="button primary" disabled={busy}>
                  <Save size={17} /> Kaydet
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setSelected(null)}
                >
                  Vazgeç
                </button>
              </div>
            </form>
          )}
        </section>
      )}
      <section className="panel table-panel" style={{ marginTop: 20 }}>
        <div className="table-title section-heading">
          <h2>Son stok hareketleri</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Ürün</th>
                <th>İşlem</th>
                <th>Adet</th>
                <th>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {data.movements.map((movement) => (
                <tr key={movement.id}>
                  <td>
                    {new Date(movement.created_at).toLocaleString("tr-TR")}
                  </td>
                  <td>
                    {data.products.find(
                      (product) => product.id === movement.product_id,
                    )?.name ?? "—"}
                  </td>
                  <td>
                    {movement.kind === "sale"
                      ? "Satış"
                      : movement.kind === "opening"
                        ? "Açılış"
                        : "Manuel"}
                  </td>
                  <td
                    className={
                      movement.quantity_delta < 0 ? "stock-low" : "success-text"
                    }
                  >
                    {movement.quantity_delta > 0 ? "+" : ""}
                    {movement.quantity_delta}
                  </td>
                  <td>{movement.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.movements.length && (
          <p className="empty-small" style={{ padding: 20 }}>
            Henüz stok hareketi yok.
          </p>
        )}
      </section>
    </>
  );
}

function ProductInputs({
  fields,
  setFields,
  includeQuantity = false,
}: {
  fields: ProductFields;
  setFields: React.Dispatch<React.SetStateAction<ProductFields>>;
  includeQuantity?: boolean;
}) {
  function change(key: keyof ProductFields, value: string) {
    setFields((old) => ({ ...old, [key]: value }));
  }
  return (
    <div className="form-grid three">
      <label className="field">
        <span>Ürün adı *</span>
        <input
          required
          maxLength={200}
          value={fields.name}
          onChange={(event) => change("name", event.target.value)}
        />
      </label>
      <label className="field">
        <span>Ürün kodu (isteğe bağlı)</span>
        <input
          maxLength={80}
          value={fields.sku}
          onChange={(event) => change("sku", event.target.value)}
        />
      </label>
      <label className="field">
        <span>Birim satış fiyatı (TL)</span>
        <input
          required
          inputMode="decimal"
          value={fields.price}
          onChange={(event) => change("price", event.target.value)}
        />
      </label>
      {includeQuantity && (
        <label className="field">
          <span>Başlangıç stoku</span>
          <input
            required
            type="number"
            min="0"
            value={fields.quantity}
            onChange={(event) => change("quantity", event.target.value)}
          />
        </label>
      )}
      <label className="field">
        <span>Az stok uyarı sınırı</span>
        <input
          required
          type="number"
          min="0"
          value={fields.reorder}
          onChange={(event) => change("reorder", event.target.value)}
        />
      </label>
    </div>
  );
}
