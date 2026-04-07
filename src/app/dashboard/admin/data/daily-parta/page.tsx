import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  AdminDataTable,
  type TableColumn,
  type TableSearchParams,
} from "@/components/admin/AdminDataTable";
import { ExportButton } from "@/components/admin/ExportButton";
import { requireAdminContext } from "@/lib/admin/adminAuth";
import { getAllDailySummaries } from "@/lib/admin/adminQueries";
import { logAdminAction } from "@/lib/admin/adminActions";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

function formatCurrency(value: Decimal | number | string, symbol = "₹"): string {
  const decimal = new Decimal(value);
  return `${symbol}${Number(decimal.toFixed(2)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type DailySummaryWithShop = Awaited<ReturnType<typeof getAllDailySummaries>>[0];

type DailyPartaPageProps = {
  searchParams?: Promise<TableSearchParams>;
};

const columns: TableColumn<DailySummaryWithShop>[] = [
  {
    key: "shopName",
    label: "Shop",
    sortable: true,
    sortType: "string",
  },
  {
    key: "summaryDate",
    label: "Date",
    sortable: true,
    sortType: "date",
    render: (value) => {
      const date = new Date(value as string);
      return date.toLocaleDateString("en-IN");
    },
  },
  {
    key: "totalSalesCash",
    label: "Cash Sales",
    sortable: true,
    sortType: "currency",
    render: (value) => formatCurrency(value as Decimal),
  },
  {
    key: "totalSalesUpi",
    label: "UPI Sales",
    sortable: true,
    sortType: "currency",
    render: (value) => formatCurrency(value as Decimal),
  },
  {
    key: "estimatedGrossProfit",
    label: "Gross Profit",
    sortable: true,
    sortType: "currency",
    render: (value) => formatCurrency(value as Decimal),
  },
  {
    key: "marginApplied",
    label: "Margin %",
    sortable: true,
    sortType: "number",
    render: (value) => `${Number(value).toFixed(2)}%`,
  },
  {
    key: "isVoided",
    label: "Status",
    render: (value) => (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
        value ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
      }`}>
        {value ? "Voided" : "Active"}
      </span>
    ),
  },
];

export default async function DailyPartaPage({ searchParams }: DailyPartaPageProps) {
  const admin = await requireAdminContext();
  const tableSearchParams = await searchParams;

  await logAdminAction({
    adminId: admin.adminId,
    action: "DAILY_PARTA_VIEWED",
    description: "Admin viewed all daily parta summaries",
  });

  const summaries = await getAllDailySummaries(500, 0);
  const activeSummaries = summaries.filter((row) => !row.isVoided);

  const totalSales = activeSummaries.reduce(
    (sum, s) => sum.plus(s.totalSalesCash || 0).plus(s.totalSalesUpi || 0),
    new Decimal(0),
  );

  return (
    <div className="flex flex-col">
      <AdminHeader
        title="Daily Parta"
        subtitle="View all daily sales summaries across shops"
        breadcrumbs={[
          { label: "Admin", href: "/dashboard/admin" },
          { label: "Data" },
          { label: "Daily Parta" },
        ]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-600">Total Records: {summaries.length}</p>
            <p className="mt-1 text-sm text-stone-600">
              Active: {activeSummaries.length} | Voided: {summaries.length - activeSummaries.length}
            </p>
            <p className="mt-1 font-semibold text-stone-900">
              Total Sales (Active): {formatCurrency(totalSales)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton actionKey="admin-daily-csv" label="Export CSV" />
            <ExportButton actionKey="admin-daily-pdf" label="Export PDF" />
          </div>
        </div>

        {/* Data Table */}
        <AdminDataTable<DailySummaryWithShop>
          columns={columns}
          data={summaries}
          rowKey="id"
          emptyText="No daily summaries found"
          basePath="/dashboard/admin/data/daily-parta"
          searchParams={tableSearchParams}
          defaultSort={{ key: "summaryDate", direction: "desc" }}
        />
      </div>
    </div>
  );
}
