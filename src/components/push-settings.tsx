"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

function base64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export default function PushSettings() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        setSupported(true);
        setEnabled(Boolean(await registration.pushManager.getSubscription()));
      })
      .catch(() => setSupported(false));
  }, []);

  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const response = await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        if (!response.ok) throw new Error("Bildirim kaydı kaldırılamadı.");
        await existing.unsubscribe();
        setEnabled(false);
      } else {
        if (!publicKey) throw new Error("Bildirim anahtarı henüz kurulmadı.");
        const permission = await Notification.requestPermission();
        if (permission !== "granted")
          throw new Error("Telefon veya tarayıcı bildirim izni vermedi.");
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(publicKey),
        });
        const json = subscription.toJSON();
        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            p256dh: json.keys?.p256dh,
            auth_secret: json.keys?.auth,
          }),
        });
        if (!response.ok) {
          await subscription.unsubscribe();
          throw new Error("Bildirim kaydı oluşturulamadı.");
        }
        setEnabled(true);
      }
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Bildirim ayarı değiştirilemedi.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="push-settings">
      <div>
        <strong>Telefon bildirimi</strong>
        <small>
          {enabled ? "Bu cihazda açık" : "Vadesine 3 gün kalanlar için"}
        </small>
      </div>
      <button
        className="button secondary small"
        type="button"
        onClick={toggle}
        disabled={busy || !supported || !publicKey}
      >
        {enabled ? (
          <>
            <BellOff size={16} /> Kapat
          </>
        ) : (
          <>
            <Bell size={16} /> Aç
          </>
        )}
      </button>
      {!supported && (
        <p>
          Bu tarayıcı bildirimleri desteklemiyor. iPhone’da siteyi ana ekrana
          ekleyin.
        </p>
      )}
      {supported && !publicKey && (
        <p>Bildirimler sunucu kurulumu tamamlanınca açılacak.</p>
      )}
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
