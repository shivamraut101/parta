import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  AdminDataTable,
  type TableColumn,
  type TableSearchParams,
} from "@/components/admin/AdminDataTable";
import { requireAdminContext } from "@/lib/admin/adminAuth";
import { getAdminAuditLogs } from "@/lib/admin/adminQueries";
import { logAdminAction } from "@/lib/admin/adminActions";

export const dynamic = "force-dynamic";

type AdminAuditLogEntry = Awaited<ReturnType<typeof getAdminAuditLogs>>[0];

type AuditLogsPageProps = {
  searchParams?: Promise<TableSearchParams>;
};

const columns: TableColumn<AdminAuditLogEntry>[] = [
  {
    key: "createdAt",
    label: "Timestamp",
    sortable: true,
    sortType: "date",
    render: (value) => {
      const date = new Date(value as string);
      return date.toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    },
  },
  {
    key: "adminEmail",
    label: "Admin",
    sortable: true,
    sortType: "string",
  },
  {
    key: "action",
    label: "Action",
    sortable: true,
    sortType: "string",
    render: (value) => {
      const action = value as string;
      const actionMap: Record<string, string> = {
        DASHBOARD_VIEWED: "Dashboard Viewed",
        SHOPS_LIST_VIEWED: "Shops List Viewed",
        DAILY_PARTA_VIEWED: "Daily Parta Viewed",
        DEBT_ENGINE_VIEWED: "Debt Engine Viewed",
        SUPPLIERS_VIEWED: "Suppliers Viewed",
        ANALYTICS_VIEWED: "Analytics Viewed",
        AUDIT_LOGS_VIEWED: "Audit Logs Viewed",
        SHOP_DATA_EDITED: "Shop Data Edited",
        SHOP_DATA_DELETED: "Shop Data Deleted",
      };
      return actionMap[action] || action;
    },
  },
  {
    key: "description",
    label: "Description",
  },
  {
    key: "ipAddress",
    label: "IP Address",
    render: (value) => (value ? String(value) : "—"),
  },
];

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const admin = await requireAdminContext();
  const tableSearchParams = await searchParams;

  await logAdminAction({
    adminId: admin.adminId,
    action: "AUDIT_LOGS_VIEWED",
    description: "Admin viewed audit logs",
  });

  const logs = await getAdminAuditLogs(500, 0);

  return (
    <div className="flex flex-col">
      <AdminHeader
        title="Audit Logs"
        subtitle="Track all admin actions and system events"
        breadcrumbs={[
          { label: "Admin", href: "/dashboard/admin" },
          { label: "Audit Logs" },
        ]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm text-stone-600">Total Records: {logs.length}</p>
        </div>

        {/* Data Table */}
        <AdminDataTable<AdminAuditLogEntry>
          columns={columns}
          data={logs}
          rowKey="id"
          emptyText="No audit logs found"
          basePath="/dashboard/admin/audit-logs"
          searchParams={tableSearchParams}
          defaultSort={{ key: "createdAt", direction: "desc" }}
        />
      </div>
    </div>
  );
}
