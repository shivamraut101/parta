"use client";

import { Search, Bell, Command, Sparkles } from "lucide-react";
import Link from "next/link";

type AdminHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
};

export function AdminHeader({ title, subtitle, breadcrumbs }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200/80 bg-white/85 backdrop-blur">
      <div className="px-6 py-4 lg:px-8">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-stone-500">
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {crumb.href ? (
                  <Link href={crumb.href} className="font-semibold text-teal-700 hover:text-teal-800">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-stone-600">{crumb.label}</span>
                )}
                {idx < breadcrumbs.length - 1 && <span className="text-stone-400">•</span>}
              </div>
            ))}
          </div>
        )}

        {/* Title */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 md:flex">
            <Sparkles size={14} />
            Live Workspace
          </div>
        </div>

        {/* Search and actions bar */}
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Global search is being rolled out"
              disabled
              aria-disabled="true"
              className="h-11 w-full cursor-not-allowed rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-20 text-sm text-stone-500 placeholder-stone-400 shadow-sm"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-500">
              <Command size={10} />
              Soon
            </span>
          </div>

          <button
            type="button"
            disabled
            aria-label="Notifications are not enabled yet"
            className="relative grid h-11 w-11 cursor-not-allowed place-items-center rounded-xl border border-stone-200 bg-stone-50 text-stone-400 shadow-sm"
          >
            <Bell size={18} className="text-stone-400" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-stone-300" />
          </button>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Search and notifications are disabled until multi-shop indexing and alert rules are enabled.
        </p>
      </div>
    </header>
  );
}
