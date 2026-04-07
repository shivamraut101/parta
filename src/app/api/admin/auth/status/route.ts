import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateAdminLastLogin } from "@/lib/admin/adminActions";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user is admin
    const admin = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, user.email ?? ""))
      .limit(1)
      .then((rows) => rows[0]);

    if (!admin) {
      return NextResponse.json({ error: "Not an admin user" }, { status: 403 });
    }

    // Update last login
    await updateAdminLastLogin(admin.id);

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        isSuperAdmin: admin.isSuperAdmin,
      },
    });
  } catch (error) {
    console.error("Failed to verify admin:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
