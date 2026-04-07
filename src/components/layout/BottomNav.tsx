"use client";

import {
  BarChart3,
  ClipboardList,
  CreditCard,
  Home,
  LogOut,
  MoreHorizontal,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOutAction } from "@/app/auth/actions";

const mainLinks = [
  { href: "/", icon: Home, label: "Munim" },
  { href: "/daily-parta", icon: ClipboardList, label: "Galla" },
  { href: "/debt-engine", icon: CreditCard, label: "Karj" },
  { href: "/supplier-wall", icon: Users, label: "Saakh" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Don't show on auth pages
  if (pathname.startsWith("/auth/")) return null;

  return (
    <>
      {/* ── Fixed bottom bar (mobile only) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-[60] flex h-16 items-stretch border-t border-stone-200 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)] sm:hidden">
        {mainLinks.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                active
                  ? "text-teal-700"
                  : "text-stone-400 active:text-stone-700"
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-teal-50" : ""
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              </span>
              <span>{link.label}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          type="button"
          onClick={() => setMoreOpen((prev) => !prev)}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
            moreOpen ? "text-teal-700" : "text-stone-400 active:text-stone-700"
          }`}
        >
          <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
            moreOpen ? "bg-teal-50" : ""
          }`}>
            <MoreHorizontal size={20} strokeWidth={moreOpen ? 2.5 : 1.8} />
          </span>
          <span>Aur</span>
        </button>
      </nav>

      {/* ── More overlay ── */}
      {moreOpen ? (
        <div
          className="fixed inset-0 bottom-16 z-50 flex flex-col justify-end sm:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 pointer-events-none" />
          <div
            className="relative z-10 rounded-t-3xl bg-white px-4 pb-6 pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />

            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-bold text-stone-900">Aur Options</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <Link
                href="/financial-identity"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-2xl p-3 active:bg-stone-50 hover:bg-stone-50 transition-colors"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 shrink-0">
                  <Wallet size={20} />
                </span>
                <div>
                  <p className="text-sm font-bold text-stone-900">Financial Identity</p>
                  <p className="text-xs text-stone-400">CC limit, rates, margin</p>
                </div>
              </Link>

              <Link
                href="/reports"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-2xl p-3 active:bg-stone-50 hover:bg-stone-50 transition-colors"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 shrink-0">
                  <BarChart3 size={20} />
                </span>
                <div>
                  <p className="text-sm font-bold text-stone-900">Monthly Reports</p>
                  <p className="text-xs text-stone-400">Snapshots & CSV export</p>
                </div>
              </Link>

              <Link
                href="/admin"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-2xl p-3 active:bg-stone-50 hover:bg-stone-50 transition-colors"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-stone-600 shrink-0">
                  <Settings size={20} />
                </span>
                <div>
                  <p className="text-sm font-bold text-stone-900">Admin Control</p>
                  <p className="text-xs text-stone-400">Brand, team, day lock</p>
                </div>
              </Link>

              <form action={signOutAction} className="pt-2 border-t border-stone-200">
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-2xl p-3 active:bg-rose-50 hover:bg-rose-50 transition-colors"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                    <LogOut size={20} />
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-bold text-rose-700">Sign Out</p>
                    <p className="text-xs text-stone-400">App se bahar jayein</p>
                  </div>
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
