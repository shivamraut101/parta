"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { adminAuditLogs, adminUsers } from "@/db/schema";

/**
 * Log an admin action to the audit log
 */
export async function logAdminAction({
  adminId,
  action,
  shopId,
  targetType,
  targetId,
  description,
  payload,
}: {
  adminId: string;
  action: string;
  shopId?: string;
  targetType?: string;
  targetId?: string;
  description?: string;
  payload?: Record<string, unknown>;
}) {
  try {
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    const userAgent = headersList.get("user-agent") || undefined;

    await db.insert(adminAuditLogs).values({
      adminId,
      action,
      shopId: shopId || undefined,
      targetType: targetType || undefined,
      targetId: targetId || undefined,
      description: description || undefined,
      payload: payload || undefined,
      ipAddress: ipAddress.split(",")[0]?.trim() || undefined,
      userAgent,
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
}

/**
 * Update admin last login timestamp
 */
export async function updateAdminLastLogin(adminId: string) {
  try {
    await db
      .update(adminUsers)
      .set({ lastLogin: new Date() })
      .where(eq(adminUsers.id, adminId));
  } catch (error) {
    console.error("Failed to update admin last login:", error);
  }
}
