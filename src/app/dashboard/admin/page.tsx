import { Building2, TrendingUp, DollarSign, AlertCircle, ArrowUpRight, Layers3 } from "lucide-react";
import Link from "next/link";

import { AdminHeader } from "@/components/admin/AdminHeader";
import { requireAdminContext } from "@/lib/admin/adminAuth";
import { getAllShopsWithStats, getCrossShopAnalytics, getDebtAnalytics } from "@/lib/admin/adminQueries";
import { logAdminAction } from "@/lib/admin/adminActions";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

function formatCurrency(value: Decimal | number | string, symbol = "₹"): string {
  const decimal = new Decimal(value);
  return `${symbol}${Number(decimal.toFixed(0)).toLocaleString("en-IN")}`;
}

export default async function AdminDashboard() {
  const admin = await requireAdminContext();

  // Log this access
  await logAdminAction({
    adminId: admin.adminId,
    action: "DASHBOARD_VIEWED",
    description: "Admin accessed dashboard",
  });

  // Fetch all data
  const shopsData = await getAllShopsWithStats();
  const analyticsData = await getCrossShopAnalytics(7);
  const debtAnalytics = await getDebtAnalytics();

  // Calculate totals
  const totalShops = shopsData.length;
  const totalDebt = shopsData.reduce((sum, shop) => sum.plus(shop.totalDebt || 0), new Decimal(0));
  const totalSupplierPayables = shopsData.reduce(
    (sum, shop) => sum.plus(shop.supplierPayables || 0),
    new Decimal(0),
  );

  // Recent sales (last 7 days), excluding voided summaries via query layer.
  const recentSales = analyticsData
    .slice(-7)
    .reduce((sum, day) => sum.plus(day.totalCash).plus(day.totalUpi), new Decimal(0));
  const totalOutstanding = debtAnalytics.totalOutstandingActive;

  const weeklyTrend = analyticsData.slice(-7).map((day) => {
    const value = new Decimal(day.totalCash).plus(day.totalUpi);
    return {
      date: day.date,
      value,
    };
  });

  const maxTrend = weeklyTrend.reduce(
    (max, item) => (item.value.greaterThan(max) ? item.value : max),
    new Decimal(0),
  );

  const statCards = [
    {
      label: "Active Shops",
      value: totalShops,
      context: "stores live on platform",
      icon: Building2,
      color: "from-sky-500/15 to-cyan-500/10 text-sky-700",
      href: "/dashboard/admin/shops",
    },
    {
      label: "Total Sales (7d)",
      value: formatCurrency(recentSales),
      context: "non-voided cash + UPI",
      icon: TrendingUp,
      color: "from-emerald-500/15 to-teal-500/10 text-emerald-700",
      href: "/dashboard/admin/analytics",
    },
    {
      label: "Total Debt Outstanding",
      value: formatCurrency(totalDebt),
      context: "active debt exposure",
      icon: DollarSign,
      color: "from-amber-500/15 to-orange-500/10 text-amber-700",
      href: "/dashboard/admin/data/debt-engine",
    },
    {
      label: "Supplier Payables",
      value: formatCurrency(totalSupplierPayables),
      context: "current settlement pipeline",
      icon: AlertCircle,
      color: "from-rose-500/15 to-red-500/10 text-rose-700",
      href: "/dashboard/admin/data/suppliers",
    },
  ];

  return (
    <div className="flex flex-col">
      <AdminHeader
        title="Dashboard"
        subtitle="High-level health, trends, and direct action points"
        breadcrumbs={[{ label: "Admin" }, { label: "Dashboard" }]}
      />

      <div className="flex-1 overflow-auto p-6 lg:p-8">
        <section className="mb-6 rounded-2xl border border-stone-200 bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_45%,#fff7ed_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Command Summary</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                {totalShops} active shop{totalShops === 1 ? "" : "s"} with {formatCurrency(totalOutstanding)} debt load
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                This panel highlights current pressure points before you drill into tables.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-stone-200 bg-white/90 p-3 shadow-sm">
              {weeklyTrend.length === 0 ? (
                <div className="col-span-3 text-center text-xs text-stone-500">No weekly trend data yet</div>
              ) : (
                weeklyTrend.map((item) => {
                  const height =
                    maxTrend.greaterThan(0)
                      ? Number(item.value.div(maxTrend).mul(100).toFixed(0))
                      : 4;
                  return (
                    <div key={item.date} className="flex flex-col items-center gap-1">
                      <div className="flex h-16 w-6 items-end rounded-md bg-stone-100 p-1">
                        <div
                          className="w-full rounded-sm bg-linear-to-t from-teal-600 to-cyan-500"
                          style={{ height: `${Math.max(8, height)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-stone-500">
                        {new Date(item.date).toLocaleDateString("en-IN", { weekday: "short" })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Stat Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Link
                key={idx}
                href={card.href || "#"}
                className={`group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                  card.href ? "cursor-pointer" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-stone-600">{card.label}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{card.value}</p>
                    <p className="mt-1 text-xs text-stone-500">{card.context}</p>
                  </div>
                  <div className={`rounded-xl bg-linear-to-br p-3 ${card.color}`}>
                    <Icon size={24} />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100">
                  Open details
                  <ArrowUpRight size={13} />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 size={18} className="text-stone-700" />
            <h2 className="text-lg font-semibold tracking-tight text-stone-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Link
              href="/dashboard/admin/shops"
              className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="font-semibold text-stone-900">View All Shops</h3>
              <p className="mt-1 text-sm text-stone-600">Monitor ownership, performance, and setup quality across tenants.</p>
              <p className="mt-3 text-xs font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100">Go to Shops</p>
            </Link>

            <Link
              href="/dashboard/admin/analytics"
              className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="font-semibold text-stone-900">Analytics</h3>
              <p className="mt-1 text-sm text-stone-600">Compare trends and find anomalies in sales and debt behavior.</p>
              <p className="mt-3 text-xs font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100">Open Analytics</p>
            </Link>

            <Link
              href="/dashboard/admin/audit-logs"
              className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="font-semibold text-stone-900">Audit Logs</h3>
              <p className="mt-1 text-sm text-stone-600">Review activity timeline for accountability and support debugging.</p>
              <p className="mt-3 text-xs font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100">View Logs</p>
            </Link>

            <Link
              href="/dashboard/admin/data/daily-parta"
              className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="font-semibold text-stone-900">Daily Parta</h3>
              <p className="mt-1 text-sm text-stone-600">Inspect revenue snapshots and voided records by shop and day.</p>
              <p className="mt-3 text-xs font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100">Open Data</p>
            </Link>

            <Link
              href="/dashboard/admin/data/debt-engine"
              className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="font-semibold text-stone-900">Debt Engine</h3>
              <p className="mt-1 text-sm text-stone-600">Track liability mix, overdue risk, and lender-wise exposure.</p>
              <p className="mt-3 text-xs font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100">Review Debt</p>
            </Link>

            <Link
              href="/dashboard/admin/data/suppliers"
              className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="font-semibold text-stone-900">Suppliers</h3>
              <p className="mt-1 text-sm text-stone-600">Observe payable trends and vendor concentration in one place.</p>
              <p className="mt-3 text-xs font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100">Open Suppliers</p>
            </Link>
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-stone-900">KPI Definitions</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-stone-100 bg-stone-50 p-3 text-sm">
              <p className="font-semibold text-stone-900">Active Shops</p>
              <p className="mt-1 text-stone-600">Count of shop records currently present in the platform.</p>
            </div>
            <div className="rounded-xl border border-stone-100 bg-stone-50 p-3 text-sm">
              <p className="font-semibold text-stone-900">Total Sales (7d)</p>
              <p className="mt-1 text-stone-600">Sum of non-voided cash and UPI sales from the last 7 days.</p>
            </div>
            <div className="rounded-xl border border-stone-100 bg-stone-50 p-3 text-sm">
              <p className="font-semibold text-stone-900">Total Debt Outstanding</p>
              <p className="mt-1 text-stone-600">Outstanding amount from active debt accounts only.</p>
            </div>
            <div className="rounded-xl border border-stone-100 bg-stone-50 p-3 text-sm">
              <p className="font-semibold text-stone-900">Supplier Payables</p>
              <p className="mt-1 text-stone-600">Current supplier balances summed across all shops.</p>
            </div>
          </div>
        </section>

        {/* System Health */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-stone-900">System Health</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <span className="text-stone-600">Active Debt Accounts</span>
              <span className="font-semibold text-stone-900">{debtAnalytics.activeAccounts}</span>
            </div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <span className="text-stone-600">Total Debt Outstanding</span>
              <span className="font-semibold text-stone-900">{formatCurrency(debtAnalytics.totalOutstandingActive)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600">Total Shops</span>
              <span className="font-semibold text-stone-900">{totalShops}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
