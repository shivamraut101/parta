"use client";

import {
  BarChart3,
  Building2,
  ChevronRight,
  Circle,
  LogOut,
  Menu,
  Settings,
  X,
  Activity,
  TrendingUp,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOutAction } from "@/app/auth/actions";

type SidebarProps = {
  adminEmail?: string;
};

export function AdminSidebar({ adminEmail }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard/admin") {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const primaryNavItems = [
    { label: "Dashboard", href: "/dashboard/admin", icon: BarChart3 },
    { label: "Shops", href: "/dashboard/admin/shops", icon: Building2 },
  ];

  const dataNavItems = [
    { label: "Daily Parta", href: "/dashboard/admin/data/daily-parta", icon: Activity },
    { label: "Debt Engine", href: "/dashboard/admin/data/debt-engine", icon: TrendingUp },
    { label: "Suppliers", href: "/dashboard/admin/data/suppliers", icon: FileText },
  ];

  const systemNavItems = [
    { label: "Analytics", href: "/dashboard/admin/analytics", icon: BarChart3 },
    { label: "Audit Logs", href: "/dashboard/admin/audit-logs", icon: Activity },
    { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
  ];

  function renderNavGroup(
    items: Array<{ label: string; href: string; icon: typeof BarChart3 }>,
    title: string,
  ) {
    return (
      <div>
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-100/70">
          {title}
        </p>
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all ${
                  active
                    ? "bg-teal-500/20 text-white ring-1 ring-teal-300/40"
                    : "text-stone-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={16} className={active ? "text-teal-200" : "text-stone-300"} />
                  <span className="font-medium">{item.label}</span>
                </span>
                {active ? (
                  <Circle size={8} className="fill-teal-200 text-teal-200" />
                ) : (
                  <ChevronRight size={14} className="text-stone-500 opacity-0 transition group-hover:opacity-100" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-stone-900 p-2 text-white shadow-lg md:hidden"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-30 h-screen w-72 transform bg-linear-to-b from-slate-950 via-slate-900 to-slate-900 text-white transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_52%),radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.14),transparent_48%)]" />
        <div className="relative flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-white/10 p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                <BarChart3 size={18} className="text-cyan-200" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-white">Control Room</h1>
                <p className="mt-0.5 text-xs text-teal-100/80">Super Admin Workspace</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="admin-scrollbar flex-1 space-y-6 overflow-y-auto px-4 py-6">
            {renderNavGroup(primaryNavItems, "Overview")}
            {renderNavGroup(dataNavItems, "Data")}
            {renderNavGroup(systemNavItems, "System")}
          </nav>

          {/* Footer */}
          <div className="border-t border-white/10 p-4">
            <div className="mb-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur">
              <p className="text-xs text-teal-100/70">Logged in as</p>
              <p className="truncate text-sm font-semibold text-white">{adminEmail || "Admin"}</p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-stone-100 transition-colors hover:bg-white/10"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Sidebar spacing for desktop */}
      <div className="hidden md:block md:w-72" />
    </>
  );
}
