import { redirect } from "next/navigation";
import { LockKeyhole, ReceiptText } from "lucide-react";
import { signIn } from "./actions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import SetupPage from "@/app/setup/page";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupPage />;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-mark">
          <ReceiptText size={30} />
        </div>
        <span className="eyebrow">DÜKKÂN YÖNETİMİ</span>
        <h1>Müşteri Hesap Takibi</h1>
        <p className="muted">
          Satışları, taksitleri ve tahsilatları güvenle takip edin.
        </p>
        {error && (
          <p className="alert error">
            E-posta veya şifre hatalı. Lütfen tekrar deneyin.
          </p>
        )}
        <form action={signIn} className="form-stack">
          <label>
            E-posta
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Şifre
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button primary full" type="submit">
            <LockKeyhole size={18} /> Giriş yap
          </button>
        </form>
        <p className="auth-footnote">
          Yalnızca yetkili kullanıcılar giriş yapabilir.
        </p>
      </section>
    </main>
  );
}
