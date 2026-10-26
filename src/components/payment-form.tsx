"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { formatMoney, parseMoney, todayIstanbul } from "@/lib/finance";

export default function PaymentForm({
  installmentId,
  remainingCents,
}: {
  installmentId: string;
  remainingCents: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    (remainingCents / 100).toFixed(2).replace(".", ","),
  );
  const [paidOn, setPaidOn] = useState(todayIstanbul());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseMoney(amount);
    if (!amountCents || amountCents > remainingCents) {
      setError(
        `1 kuruş ile ${formatMoney(remainingCents)} arasında tutar girin.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installmentId, amountCents, paidOn }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Ödeme kaydedilemedi.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Beklenmeyen hata.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="payment-form">
      <label>
        Tahsil edilen (TL)
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          required
        />
      </label>
      <label>
        Ödeme tarihi
        <input
          type="date"
          value={paidOn}
          onChange={(event) => setPaidOn(event.target.value)}
          required
        />
      </label>
      <button className="button primary small" type="submit" disabled={busy}>
        <Check size={17} /> {busy ? "Kaydediliyor" : "Ödemeyi onayla"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
