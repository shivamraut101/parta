import { requireAdminContext } from "@/lib/admin/adminAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";

export const dynamic = "force-dynamic";

export default async function DashboardAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminContext();

  return (
    <AdminLayout adminEmail={admin.email}>
      {children}
    </AdminLayout>
  );
}
