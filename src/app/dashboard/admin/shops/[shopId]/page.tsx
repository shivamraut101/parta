import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";

import { AdminHeader } from "@/components/admin/AdminHeader";
import { requireAdminContext } from "@/lib/admin/adminAuth";
import { logAdminAction } from "@/lib/admin/adminActions";
import { getShopAdminDetails } from "@/lib/admin/adminQueries";

export const dynamic = "force-dynamic";

type ShopDetailPageProps = {
  params: Promise<{ shopId: string }>;
};

function formatCurrency(value: Decimal | number | string, symbol = "₹") {
  const decimal = new Decimal(value);
  return `${symbol}${Number(decimal.toFixed(2)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function ShopDetailPage({ params }: ShopDetailPageProps) {
  const admin = await requireAdminContext();
  const { shopId } = await params;

  const detail = await getShopAdminDetails(shopId);
  if (!detail) {
    notFound();
  }

  await logAdminAction({
    adminId: admin.adminId,
    action: "SHOP_DETAIL_VIEWED",
    shopId,
    targetType: "SHOP",
    targetId: shopId,
    description: `Viewed details for shop ${detail.shop.name}`,
  });

  return (
    <div className="flex flex-col">
      <AdminHeader
        title={detail.shop.name}
        subtitle="Shop deep-dive for support and analysis"
        breadcrumbs={[
          { label: "Admin", href: "/dashboard/admin" },
          { label: "Shops", href: "/dashboard/admin/shops" },
          { label: detail.shop.name },
        ]}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">Total Sales (last 30 entries)</p>
            <p className="mt-2 text-lg font-bold text-stone-900">{formatCurrency(detail.metrics.totalSales, detail.shop.currencySymbol ?? "₹")}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">Total Profit (last 30 entries)</p>
            <p className="mt-2 text-lg font-bold text-stone-900">{formatCurrency(detail.metrics.totalProfit, detail.shop.currencySymbol ?? "₹")}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">Outstanding Debt</p>
            <p className="mt-2 text-lg font-bold text-stone-900">{formatCurrency(detail.metrics.totalDebt, detail.shop.currencySymbol ?? "₹")}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">Supplier Balance</p>
            <p className="mt-2 text-lg font-bold text-stone-900">{formatCurrency(detail.metrics.totalSupplierBalance, detail.shop.currencySymbol ?? "₹")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <h2 className="text-base font-bold text-stone-900">Brand & Financial Config</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-stone-500">Brand Name</dt><dd className="font-medium text-stone-900">{detail.shop.brandName ?? detail.shop.name}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-500">Currency</dt><dd className="font-medium text-stone-900">{detail.shop.currencySymbol}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-500">CC Limit</dt><dd className="font-medium text-stone-900">{detail.shop.ccLimit ?? "0"}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-500">Bank Interest (PA)</dt><dd className="font-medium text-stone-900">{detail.shop.bankInterestRatePa ?? "0"}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-500">Local APR Monthly</dt><dd className="font-medium text-stone-900">{detail.shop.localLoanAprMonthly ?? "0"}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-500">Base Margin</dt><dd className="font-medium text-stone-900">{detail.shop.baseMarginDefault ?? "20"}</dd></div>
            </dl>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <h2 className="text-base font-bold text-stone-900">Entity Counts</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-stone-500">Recent Daily Summaries (30)</dt><dd className="font-medium text-stone-900">{detail.metrics.summaryCount}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-500">Debt Accounts</dt><dd className="font-medium text-stone-900">{detail.metrics.debtCount}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-500">Suppliers</dt><dd className="font-medium text-stone-900">{detail.metrics.supplierCount}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-500">Owner User ID</dt><dd className="font-mono text-xs text-stone-900">{detail.shop.ownerId}</dd></div>
            </dl>
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-base font-bold text-stone-900">Recent Daily Summaries</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-stone-700">Date</th>
                  <th className="px-3 py-2 text-right font-semibold text-stone-700">Cash</th>
                  <th className="px-3 py-2 text-right font-semibold text-stone-700">UPI</th>
                  <th className="px-3 py-2 text-right font-semibold text-stone-700">Profit</th>
                  <th className="px-3 py-2 text-right font-semibold text-stone-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.summaries.map((row) => (
                  <tr key={row.id} className="border-b border-stone-100">
                    <td className="px-3 py-2 text-stone-900">{new Date(row.summaryDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-3 py-2 text-right text-stone-900">{formatCurrency(row.totalSalesCash ?? "0", detail.shop.currencySymbol ?? "₹")}</td>
                    <td className="px-3 py-2 text-right text-stone-900">{formatCurrency(row.totalSalesUpi ?? "0", detail.shop.currencySymbol ?? "₹")}</td>
                    <td className="px-3 py-2 text-right text-stone-900">{formatCurrency(row.estimatedGrossProfit ?? "0", detail.shop.currencySymbol ?? "₹")}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.isVoided ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {row.isVoided ? "Voided" : "Active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <Link href="/dashboard/admin/shops" className="text-sm font-semibold text-teal-600 hover:underline">
            Back to shops
          </Link>
        </div>
      </div>
    </div>
  );
}
