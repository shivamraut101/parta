"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/daily-parta", label: "Daily Parta" },
  { href: "/debt-engine", label: "Debt Engine" },
  { href: "/supplier-wall", label: "Suppliers" },
  { href: "/financial-identity", label: "Fin. Identity" },
  { href: "/reports", label: "Reports" },
  { href: "/admin", label: "Admin" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            pathname === link.href
              ? "bg-teal-700 text-white"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
