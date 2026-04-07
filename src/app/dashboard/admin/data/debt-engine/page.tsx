import { AdminHeader } from "@/components/admin/AdminHeader";
import { ExportButton } from "@/components/admin/ExportButton";
import {
  AdminDataTable,
  type TableColumn,
  type TableSearchParams,
} from "@/components/admin/AdminDataTable";
import { requireAdminContext } from "@/lib/admin/adminAuth";
import { getAllDebtAccounts } from "@/lib/admin/adminQueries";
import { logAdminAction } from "@/lib/admin/adminActions";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

function formatCurrency(value: Decimal | number | string, symbol = "₹"): string {
  const decimal = new Decimal(value);
  return `${symbol}${Number(decimal.toFixed(0)).toLocaleString("en-IN")}`;
}

type DebtAccountWithShop = Awaited<ReturnType<typeof getAllDebtAccounts>>[0];

type DebtEnginePageProps = {
  searchParams?: Promise<TableSearchParams>;
};

const columns: TableColumn<DebtAccountWithShop>[] = [
  {
    key: "shopName",
    label: "Shop",
    sortable: true,
    sortType: "string",
  },
  {
    key: "name",
    label: "Account Name",
    sortable: true,
    sortType: "string",
  },
  {
    key: "lenderName",
    label: "Lender",
    sortable: true,
    sortType: "string",
  },
  {
    key: "kind",
    label: "Type",
    sortable: true,
    sortType: "string",
    render: (value) => {
      const typeMap: Record<string, string> = {
        BANK_CC: "Bank CC",
        BANK_TERM_LOAN: "Term Loan",
        BANK_OD: "Overdraft",
        LOCAL_DAILY: "Local Daily",
        LOCAL_MONTHLY: "Local Monthly",
        LOCAL_BULLET: "Local Bullet",
        LOCAL_FLEXI: "Local Flexi",
      };
      return typeMap[value as string] || String(value);
    },
  },
  {
    key: "principalAmount",
    label: "Principal",
    sortable: true,
    sortType: "currency",
    render: (value) => formatCurrency(value as Decimal),
  },
  {
    key: "outstandingAmount",
    label: "Outstanding",
    sortable: true,
    sortType: "currency",
    render: (value) => formatCurrency(value as Decimal),
  },
  {
    key: "annualRatePa",
    label: "Annual Rate %",
    sortable: true,
    sortType: "number",
    render: (value) => `${Number(value).toFixed(2)}%`,
  },
  {
    key: "isActive",
    label: "Status",
    render: (value) => (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
        value ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-700"
      }`}>
        {value ? "Active" : "Inactive"}
      </span>
    ),
  },
];

export default async function DebtEnginePage({ searchParams }: DebtEnginePageProps) {
  const admin = await requireAdminContext();
  const tableSearchParams = await searchParams;

  await logAdminAction({
    adminId: admin.adminId,
    action: "DEBT_ENGINE_VIEWED",
    description: "Admin viewed all debt accounts",
  });

  const accounts = await getAllDebtAccounts(500, 0);

  const totalOutstanding = accounts.reduce(
    (sum, a) => sum.plus(a.outstandingAmount || 0),
    new Decimal(0),
  );

  const activeCount = accounts.filter((a) => a.isActive).length;

  return (
    <div className="flex flex-col">
      <AdminHeader
        title="Debt Engine"
        subtitle="View all debt accounts across shops"
        breadcrumbs={[
          { label: "Admin", href: "/dashboard/admin" },
          { label: "Data" },
          { label: "Debt Engine" },
        ]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-600">
              Total Accounts: {accounts.length} ({activeCount} active)
            </p>
            <p className="mt-1 font-semibold text-stone-900">
              Outstanding Debt: {formatCurrency(totalOutstanding)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton actionKey="admin-debt-csv" label="Export CSV" />
            <ExportButton actionKey="admin-debt-pdf" label="Export PDF" />
          </div>
        </div>

        {/* Data Table */}
        <AdminDataTable<DebtAccountWithShop>
          columns={columns}
          data={accounts}
          rowKey="id"
          emptyText="No debt accounts found"
          basePath="/dashboard/admin/data/debt-engine"
          searchParams={tableSearchParams}
          defaultSort={{ key: "createdAt", direction: "desc" }}
        />
      </div>
    </div>
  );
}
