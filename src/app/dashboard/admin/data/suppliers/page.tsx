import { AdminHeader } from "@/components/admin/AdminHeader";
import { ExportButton } from "@/components/admin/ExportButton";
import {
  AdminDataTable,
  type TableColumn,
  type TableSearchParams,
} from "@/components/admin/AdminDataTable";
import { requireAdminContext } from "@/lib/admin/adminAuth";
import { getAllSuppliers } from "@/lib/admin/adminQueries";
import { logAdminAction } from "@/lib/admin/adminActions";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

function formatCurrency(value: Decimal | number | string, symbol = "₹"): string {
  const decimal = new Decimal(value);
  return `${symbol}${Number(decimal.toFixed(0)).toLocaleString("en-IN")}`;
}

type SupplierWithShop = Awaited<ReturnType<typeof getAllSuppliers>>[0];

type SuppliersPageProps = {
  searchParams?: Promise<TableSearchParams>;
};

const columns: TableColumn<SupplierWithShop>[] = [
  {
    key: "shopName",
    label: "Shop",
    sortable: true,
    sortType: "string",
  },
  {
    key: "name",
    label: "Supplier Name",
    sortable: true,
    sortType: "string",
  },
  {
    key: "contactNumber",
    label: "Contact",
  },
  {
    key: "category",
    label: "Category",
    sortable: true,
    sortType: "string",
  },
  {
    key: "currentBalance",
    label: "Current Balance",
    sortable: true,
    sortType: "currency",
    render: (value) => {
      const decimal = new Decimal(value as Decimal);
      const isNegative = decimal.isNegative();
      return (
        <span className={isNegative ? "text-green-600" : "text-red-600"}>
          {formatCurrency(value as Decimal)}
        </span>
      );
    },
  },
  {
    key: "lastPaymentDate",
    label: "Last Payment",
    render: (value) => {
      if (!value) return "—";
      const date = new Date(value as string);
      return date.toLocaleDateString("en-IN");
    },
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
];

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const admin = await requireAdminContext();
  const tableSearchParams = await searchParams;

  await logAdminAction({
    adminId: admin.adminId,
    action: "SUPPLIERS_VIEWED",
    description: "Admin viewed all suppliers",
  });

  const suppliers = await getAllSuppliers(500, 0);

  const totalPayables = suppliers.reduce(
    (sum, s) => sum.plus(s.currentBalance || 0),
    new Decimal(0),
  );

  return (
    <div className="flex flex-col">
      <AdminHeader
        title="Suppliers"
        subtitle="View all suppliers across shops"
        breadcrumbs={[
          { label: "Admin", href: "/dashboard/admin" },
          { label: "Data" },
          { label: "Suppliers" },
        ]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-600">Total Suppliers: {suppliers.length}</p>
            <p className="mt-1 font-semibold text-stone-900">
              Total Payables: {formatCurrency(totalPayables)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton actionKey="admin-suppliers-csv" label="Export CSV" />
            <ExportButton actionKey="admin-suppliers-pdf" label="Export PDF" />
          </div>
        </div>

        {/* Data Table */}
        <AdminDataTable<SupplierWithShop>
          columns={columns}
          data={suppliers}
          rowKey="id"
          emptyText="No suppliers found"
          basePath="/dashboard/admin/data/suppliers"
          searchParams={tableSearchParams}
          defaultSort={{ key: "createdAt", direction: "desc" }}
        />
      </div>
    </div>
  );
}
