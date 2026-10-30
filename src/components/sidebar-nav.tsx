"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, Plus, UsersRound } from "lucide-react";

const links = [
  { href: "/", label: "Genel bakış", icon: LayoutDashboard },
  { href: "/customers", label: "Müşteriler", icon: UsersRound },
  { href: "/stock", label: "Stok takibi", icon: Boxes },
  { href: "/sales/new", label: "Yeni satış", icon: Plus },
];

export default function SidebarNav() {
  const path = usePathname();
  return (
    <nav className="sidebar-nav">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? path === "/"
            : path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={19} /> <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
