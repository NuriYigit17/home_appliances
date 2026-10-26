"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayIstanbul } from "@/lib/finance";

export default function DeliveryControl({
  itemId,
  delivered,
  deliveryDate,
}: {
  itemId: string;
  delivered: boolean;
  deliveryDate: string | null;
}) {
  const router = useRouter();
  const [date, setDate] = useState(deliveryDate || todayIstanbul());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function update() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          delivered: !delivered,
          deliveryDate: date,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Teslim durumu değiştirilemedi.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Beklenmeyen hata.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="delivery-control">
      <input
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        aria-label="Teslim tarihi"
      />
      <button
        type="button"
        className="text-button"
        onClick={update}
        disabled={busy}
      >
        {delivered ? "Teslimi geri al" : "Teslim edildi olarak işaretle"}
      </button>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
