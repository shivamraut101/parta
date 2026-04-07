import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminContext = {
  adminId: string;
  email: string;
  fullName: string | null;
  isSuperAdmin: boolean;
  lastLogin: Date | null;
};

/**
 * Get the current admin context if user is authenticated as admin
 * Returns null if user is not an admin
 */
export const getAdminContext = cache(async function getAdminContextImpl(): Promise<AdminContext | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Check if this user is an admin
    const rows = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        fullName: adminUsers.fullName,
        isSuperAdmin: adminUsers.isSuperAdmin,
        lastLogin: adminUsers.lastLogin,
      })
      .from(adminUsers)
      .where(eq(adminUsers.email, user.email ?? ""))
      .limit(1);

    const adminUser = rows[0];
    if (!adminUser) {
      return null;
    }

    return {
      adminId: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      isSuperAdmin: adminUser.isSuperAdmin,
      lastLogin: adminUser.lastLogin,
    };
  } catch {
    return null;
  }
});

/**
 * Require admin context - redirects to home if not admin
 */
export async function requireAdminContext(): Promise<AdminContext> {
  const admin = await getAdminContext();
  if (!admin) {
    redirect("/");
  }
  return admin;
}

/**
 * Require super admin - redirects to home if not super admin
 */
export async function requireSuperAdmin(): Promise<AdminContext> {
  const admin = await getAdminContext();
  if (!admin || !admin.isSuperAdmin) {
    redirect("/");
  }
  return admin;
}
