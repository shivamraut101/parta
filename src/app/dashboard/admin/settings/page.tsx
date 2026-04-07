import { Lock, Key, LogOut } from "lucide-react";

import { AdminHeader } from "@/components/admin/AdminHeader";
import { requireAdminContext } from "@/lib/admin/adminAuth";
import { logAdminAction } from "@/lib/admin/adminActions";
import { signOutAction } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = await requireAdminContext();

  await logAdminAction({
    adminId: admin.adminId,
    action: "SETTINGS_VIEWED",
    description: "Admin viewed settings",
  });

  return (
    <div className="flex flex-col">
      <AdminHeader
        title="Settings"
        subtitle="Manage admin account and preferences"
        breadcrumbs={[
          { label: "Admin", href: "/dashboard/admin" },
          { label: "Settings" },
        ]}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Account Settings */}
        <div className="mb-8 max-w-2xl">
          <h2 className="mb-4 text-lg font-bold text-stone-900">Account Information</h2>
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-stone-600">Email</p>
                <p className="mt-1 text-stone-900">{admin.email}</p>
              </div>
              {admin.fullName && (
                <div>
                  <p className="text-sm font-medium text-stone-600">Full Name</p>
                  <p className="mt-1 text-stone-900">{admin.fullName}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-stone-600">Role</p>
                <p className="mt-1 text-stone-900">
                  {admin.isSuperAdmin ? "Super Admin" : "Admin"}
                </p>
              </div>
              {admin.lastLogin && (
                <div>
                  <p className="text-sm font-medium text-stone-600">Last Login</p>
                  <p className="mt-1 text-stone-900">
                    {new Date(admin.lastLogin).toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="mb-8 max-w-2xl">
          <h2 className="mb-4 text-lg font-bold text-stone-900">Security</h2>
          <div className="space-y-3">
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-6 py-3 font-semibold text-stone-500"
            >
              <Lock size={18} />
              <span>Change Password</span>
            </button>
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-6 py-3 font-semibold text-stone-500"
            >
              <Key size={18} />
              <span>Manage API Keys</span>
            </button>
            <p className="text-xs text-stone-500">
              These controls are disabled for now. Password and key lifecycle are currently managed via Supabase project settings.
            </p>
          </div>
        </div>

        {/* Session */}
        <div className="max-w-2xl">
          <h2 className="mb-4 text-lg font-bold text-stone-900">Session</h2>
          <div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-3 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 transition-colors"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
