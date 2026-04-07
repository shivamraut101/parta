import { Plus } from "lucide-react";
import Link from "next/link";

import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  AdminDataTable,
  type TableColumn,
  type TableSearchParams,
} from "@/components/admin/AdminDataTable";
import { requireAdminContext } from "@/lib/admin/adminAuth";
import { getAllShopsWithStats } from "@/lib/admin/adminQueries";
import { logAdminAction } from "@/lib/admin/adminActions";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

function formatCurrency(value: Decimal | number | string, symbol = "₹"): string {
  const decimal = new Decimal(value);
  return `${symbol}${Number(decimal.toFixed(0)).toLocaleString("en-IN")}`;
}

type ShopWithStats = Awaited<ReturnType<typeof getAllShopsWithStats>>[0];

type ShopsPageProps = {
  searchParams?: Promise<TableSearchParams>;
};

const columns: TableColumn<ShopWithStats>[] = [
  {
    key: "name",
    label: "Shop Name",
    sortable: true,
    sortType: "string",
  },
  {
    key: "brandName",
    label: "Brand",
    sortable: true,
    sortType: "string",
  },
  {
    key: "totalSales",
    label: "Total Sales",
    sortable: true,
    sortType: "currency",
    render: (value) => formatCurrency(value as Decimal),
  },
  {
    key: "totalDebt",
    label: "Outstanding Debt",
    sortable: true,
    sortType: "currency",
    render: (value) => formatCurrency(value as Decimal),
  },
  {
    key: "supplierPayables",
    label: "Supplier Payables",
    sortable: true,
    sortType: "currency",
    render: (value) => formatCurrency(value as Decimal),
  },
  {
    key: "createdAt",
    label: "Created",
    sortable: true,
    sortType: "date",
    render: (value) => {
      const date = new Date(value as string);
      return date.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },
  },
  {
    key: "id",
    label: "Actions",
    render: (_, row) => (
      <Link
        href={`/dashboard/admin/shops/${row.id}`}
        className="text-sm font-semibold text-teal-600 hover:underline"
      >
        View Details
      </Link>
    ),
  },
];

export default async function ShopsPage({ searchParams }: ShopsPageProps) {
  const admin = await requireAdminContext();
  const tableSearchParams = await searchParams;

  await logAdminAction({
    adminId: admin.adminId,
    action: "SHOPS_LIST_VIEWED",
    description: "Admin viewed shops directory",
  });

  const shops = await getAllShopsWithStats();

  return (
    <div className="flex flex-col">
      <AdminHeader
        title="Shops"
        subtitle="Manage all white-label shops"
        breadcrumbs={[{ label: "Admin", href: "/dashboard/admin" }, { label: "Shops" }]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Header with action */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-600">Total Shops: {shops.length}</p>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-stone-300 px-4 py-2 font-semibold text-white"
          >
            <Plus size={18} />
            <span>Add Shop (Soon)</span>
          </button>
        </div>
        <p className="mb-4 text-xs text-stone-500">
          Shop provisioning is currently handled through onboarding flow, not from admin UI.
        </p>

        {/* Data Table */}
        <AdminDataTable<ShopWithStats>
          columns={columns}
          data={shops}
          rowKey="id"
          emptyText="No shops found"
          basePath="/dashboard/admin/shops"
          searchParams={tableSearchParams}
          defaultSort={{ key: "createdAt", direction: "desc" }}
        />
      </div>
    </div>
  );
}
