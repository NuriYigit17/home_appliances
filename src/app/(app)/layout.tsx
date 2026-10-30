import Link from "next/link";
import {
  Boxes,
  LayoutDashboard,
  LogOut,
  Plus,
  ReceiptText,
  UsersRound,
} from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import SidebarNav from "@/components/sidebar-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { staff } = await requireStaff();
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Ana menü">
        <Link href="/" className="sidebar-brand">
          <span className="brand-icon">
            <ReceiptText size={23} />
          </span>
          <span>
            Müşteri Hesap
            <br />
            Takibi
          </span>
        </Link>
        <p className="sidebar-caption">DÜKKÂN YÖNETİMİ</p>
        <SidebarNav />
        <div className="sidebar-bottom">
          <span className="user-name">{staff.display_name}</span>
          <form action={signOut}>
            <button type="submit" className="sidebar-exit">
              <LogOut size={18} /> Çıkış yap
            </button>
          </form>
        </div>
      </aside>
      <div className="app-main">
        <header className="mobile-header">
          <Link href="/" className="brand">
            <span className="brand-icon">
              <ReceiptText size={20} />
            </span>
            <span>Müşteri Hesap Takibi</span>
          </Link>
        </header>
        <nav className="mobile-nav" aria-label="Mobil menü">
          <Link href="/">
            <LayoutDashboard size={18} /> Özet
          </Link>
          <Link href="/customers">
            <UsersRound size={18} /> Müşteriler
          </Link>
          <Link href="/stock">
            <Boxes size={18} /> Stok
          </Link>
          <Link href="/sales/new">
            <Plus size={18} /> Satış
          </Link>
        </nav>
        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}
