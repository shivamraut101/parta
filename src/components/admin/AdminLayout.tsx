import { AdminSidebar } from "@/components/admin/AdminSidebar";

type AdminLayoutProps = {
  children: React.ReactNode;
  adminEmail?: string;
};

export function AdminLayout({ children, adminEmail }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar adminEmail={adminEmail} />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
