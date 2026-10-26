import { Settings2 } from "lucide-react";

export default function SetupPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-mark">
          <Settings2 size={30} />
        </div>
        <h1>Veritabanı bağlantısı bekleniyor</h1>
        <p className="muted">
          Uygulama hazır. Supabase projesi oluşturulup <code>.env.local</code>{" "}
          ayarları girildiğinde giriş ekranı açılacak.
        </p>
        <p className="muted">
          Kurulum adımları proje klasöründeki README dosyasında.
        </p>
      </section>
    </main>
  );
}
