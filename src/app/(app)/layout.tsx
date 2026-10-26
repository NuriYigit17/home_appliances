import Link from "next/link";
import { LayoutDashboard, LogOut, Plus, ReceiptText } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { staff } = await requireStaff();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <span className="brand-icon">
              <ReceiptText size={22} />
            </span>
            <span>Müşteri Hesap Takibi</span>
          </Link>
          <nav className="top-nav" aria-label="Ana menü">
            <Link href="/" className="nav-link">
              <LayoutDashboard size={18} /> <span>Dashboard</span>
            </Link>
            <Link href="/sales/new" className="button primary small">
              <Plus size={18} /> <span>Yeni satış</span>
            </Link>
          </nav>
          <div className="topbar-user">
            <span className="user-name">{staff.display_name}</span>
            <form action={signOut}>
              <button
                className="icon-button"
                type="submit"
                title="Çıkış yap"
                aria-label="Çıkış yap"
              >
                <LogOut size={19} />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="page-container">{children}</main>
    </div>
  );
}
