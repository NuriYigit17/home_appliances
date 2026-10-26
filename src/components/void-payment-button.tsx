"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VoidPaymentButton({
  paymentId,
}: {
  paymentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function voidPayment() {
    const reason = window.prompt("Ödemeyi geri alma gerekçesi:");
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payments/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "İşlem başarısız.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Beklenmeyen hata.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span>
      <button
        className="text-button danger"
        type="button"
        onClick={voidPayment}
        disabled={busy}
      >
        Geri al
      </button>
      {error && <span className="form-error">{error}</span>}
    </span>
  );
}
