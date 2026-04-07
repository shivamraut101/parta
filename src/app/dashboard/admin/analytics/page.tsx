import { TrendingUp } from "lucide-react";

import { AdminHeader } from "@/components/admin/AdminHeader";
import { requireAdminContext } from "@/lib/admin/adminAuth";
import { getCrossShopAnalytics, getDebtAnalytics } from "@/lib/admin/adminQueries";
import { logAdminAction } from "@/lib/admin/adminActions";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

function formatCurrency(value: Decimal | number | string, symbol = "₹"): string {
  const decimal = new Decimal(value);
  return `${symbol}${Number(decimal.toFixed(0)).toLocaleString("en-IN")}`;
}

export default async function AnalyticsPage() {
  const admin = await requireAdminContext();

  await logAdminAction({
    adminId: admin.adminId,
    action: "ANALYTICS_VIEWED",
    description: "Admin viewed cross-shop analytics",
  });

  const [salesAnalytics, debtAnalytics] = await Promise.all([
    getCrossShopAnalytics(30),
    getDebtAnalytics(),
  ]);

  // Calculate metrics
  const totalSales = salesAnalytics.reduce(
    (sum, day) => sum.plus(day.totalCash).plus(day.totalUpi),
    new Decimal(0),
  );

  const totalProfit = salesAnalytics.reduce((sum, day) => sum.plus(day.profit), new Decimal(0));

  const avgDailyRevenue = salesAnalytics.length > 0 ? totalSales.div(salesAnalytics.length) : new Decimal(0);

  // Debt analysis
  const debtByKind = Object.entries(debtAnalytics.byKindActive).map(([kind, data]) => ({
    kind,
    count: data.count,
    outstanding: formatCurrency(data.outstanding),
    percentage: debtAnalytics.totalOutstandingActive.isZero()
      ? "0%"
      : `${data.outstanding.div(debtAnalytics.totalOutstandingActive).mul(100).toFixed(1)}%`,
  }));

  return (
    <div className="flex flex-col">
      <AdminHeader
        title="Analytics"
        subtitle="Cross-shop analytics and insights"
        breadcrumbs={[
          { label: "Admin", href: "/dashboard/admin" },
          { label: "Analytics" },
        ]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Sales Metrics */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-stone-900">Sales Metrics (Last 30 Days)</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-600">Total Revenue</p>
                  <p className="mt-2 text-2xl font-bold text-stone-900">{formatCurrency(totalSales)}</p>
                </div>
                <div className="rounded-lg bg-green-100 p-3 text-green-600">
                  <TrendingUp size={24} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-600">Average Daily Revenue</p>
                  <p className="mt-2 text-2xl font-bold text-stone-900">{formatCurrency(avgDailyRevenue)}</p>
                </div>
                <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
                  <TrendingUp size={24} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-600">Total Profit</p>
                  <p className="mt-2 text-2xl font-bold text-stone-900">{formatCurrency(totalProfit)}</p>
                </div>
                <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600">
                  <TrendingUp size={24} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Debt Analysis */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-stone-900">Debt Overview</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-stone-600">Total Outstanding Debt (Active)</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">
                    {formatCurrency(debtAnalytics.totalOutstandingActive)}
                  </p>
                </div>
                <div className="border-t border-stone-200 pt-4">
                  <p className="text-sm font-medium text-stone-600">Total Principal (Active)</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">
                    {formatCurrency(debtAnalytics.totalPrincipalActive)}
                  </p>
                </div>
                <div className="border-t border-stone-200 pt-4">
                  <p className="text-sm font-medium text-stone-600">Total Outstanding Debt (All Accounts)</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">
                    {formatCurrency(debtAnalytics.totalOutstandingAll)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-stone-600">Active Accounts</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">{debtAnalytics.activeAccounts}</p>
                </div>
                <div className="border-t border-stone-200 pt-4">
                  <p className="text-sm font-medium text-stone-600">Inactive Accounts</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">{debtAnalytics.inactiveAccounts}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Debt by Type */}
        <div>
          <h2 className="mb-4 text-lg font-bold text-stone-900">Debt Distribution by Type</h2>
          <div className="rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-stone-700">Type</th>
                  <th className="px-6 py-3 text-right font-semibold text-stone-700">Count</th>
                  <th className="px-6 py-3 text-right font-semibold text-stone-700">Outstanding</th>
                  <th className="px-6 py-3 text-right font-semibold text-stone-700">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {debtByKind.map((item, idx) => (
                  <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4 text-stone-900 font-semibold">{item.kind}</td>
                    <td className="px-6 py-4 text-right text-stone-900">{item.count}</td>
                    <td className="px-6 py-4 text-right text-stone-900">{item.outstanding}</td>
                    <td className="px-6 py-4 text-right font-semibold text-teal-600">
                      {item.percentage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
