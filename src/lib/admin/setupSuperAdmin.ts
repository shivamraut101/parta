import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { adminUsers } from "@/db/schema";

type SetupResult = {
  success: boolean;
  message: string;
};

function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function setupSuperAdmin(email: string, password: string): Promise<SetupResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { success: false, message: "Email is required." };
  }

  if (!password || password.length < 8) {
    return { success: false, message: "Password must be at least 8 characters." };
  }

  const existingAnyAdmin = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
  const existingThisAdmin = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, normalizedEmail))
    .limit(1);

  if (existingAnyAdmin.length > 0 && existingThisAdmin.length === 0) {
    return {
      success: false,
      message: "Admin already exists. Use that account or remove existing admin first.",
    };
  }

  const supabase = getAuthClient();
  const { error: signUpError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
  });

  // If user already exists, we continue and only ensure admin_users row is present.
  if (
    signUpError &&
    !/already|registered|exists/i.test(signUpError.message)
  ) {
    return {
      success: false,
      message: `Failed to create auth user: ${signUpError.message}`,
    };
  }

  if (existingThisAdmin.length === 0) {
    await db.insert(adminUsers).values({
      email: normalizedEmail,
      fullName: normalizedEmail.split("@")[0],
      isSuperAdmin: true,
    });
    return {
      success: true,
      message: "Super admin created. You can now log in from /admin/login.",
    };
  }

  return {
    success: true,
    message: "Super admin already configured for this email.",
  };
}
