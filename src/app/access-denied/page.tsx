import { ShieldAlert } from "lucide-react";
import { signOut } from "@/app/login/actions";

export default function AccessDeniedPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-mark">
          <ShieldAlert size={30} />
        </div>
        <h1>Hesabınız yetkilendirilmemiş</h1>
        <p className="muted">
          Bu hesap giriş yapabiliyor fakat mağaza kayıtlarına erişim izni yok.
          Yönetici sizi staff listesine eklemeli.
        </p>
        <form action={signOut}>
          <button className="button secondary" type="submit">
            Çıkış yap
          </button>
        </form>
      </section>
    </main>
  );
}
