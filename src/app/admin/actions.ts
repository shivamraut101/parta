"use server";

import { createClient } from "@supabase/supabase-js";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import {
  adminAuditLogs,
  auditEvents,
  corrections,
  currentAccountAccounts,
  currentAccountMovements,
  dailyClosures,
  dailyInterestLogs,
  dailySummaries,
  debtAccountMovements,
  debtAccounts,
  debtPayments,
  expenses,
  financialConfigs,
  monthlySnapshots,
  shopMembers,
  shops,
  supplierTransactions,
  suppliers,
} from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { normalizeAnnualRate, normalizeMonthlyRate } from "@/lib/finance/normalizeRate";
import { generateMonthlySnapshot } from "@/lib/reports/generateMonthlySnapshot";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getBusinessDateString, normalizeBusinessDateInput } from "@/lib/time/businessDate";

const brandSchema = z.object({
  shopName: z.string().trim().min(2).max(160),
  brandName: z.string().trim().min(2).max(160),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  currencySymbol: z.string().trim().min(1).max(8),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
});

const financialSchema = z.object({
  ccLimit: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  bankInterestRatePa: z.string().trim().regex(/^\d+(\.\d{1,6})?$/),
  dailyLocalDrain: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  localLoanAprMonthly: z.string().trim().regex(/^\d+(\.\d{1,6})?$/),
  baseMarginDefault: z.string().trim().regex(/^\d+(\.\d{1,6})?$/),
});

export async function updateBrandSettings(formData: FormData) {
  const tenant = await getTenantContext();

  if (!tenant) {
    redirect("/");
  }

  const parsed = brandSchema.safeParse({
    shopName: formData.get("shopName"),
    brandName: formData.get("brandName"),
    primaryColor: formData.get("primaryColor"),
    currencySymbol: formData.get("currencySymbol"),
    logoUrl: formData.get("logoUrl") ?? "",
  });

  if (!parsed.success) {
    throw new Error("Invalid brand settings.");
  }

  const payload = parsed.data;

  await db
    .update(shops)
    .set({
      name: payload.shopName,
      brandName: payload.brandName,
      primaryColor: payload.primaryColor,
      currencySymbol: payload.currencySymbol,
      logoUrl: payload.logoUrl || null,
    })
    .where(eq(shops.id, tenant.shopId));

  await logAuditEvent({
    shopId: tenant.shopId,
    actorUserId: tenant.userId,
    eventType: "BRAND_SETTINGS_UPDATED",
    entityType: "SHOP",
    entityId: tenant.shopId,
    payload: {
      shopName: payload.shopName,
      brandName: payload.brandName,
      primaryColor: payload.primaryColor,
      currencySymbol: payload.currencySymbol,
      logoUrl: payload.logoUrl || null,
    },
  });

  redirect("/admin?saved=brand");
}

export async function updateFinancialSettings(formData: FormData) {
  const tenant = await getTenantContext();

  if (!tenant) {
    redirect("/");
  }

  const parsed = financialSchema.safeParse({
    ccLimit: formData.get("ccLimit"),
    bankInterestRatePa: formData.get("bankInterestRatePa"),
    dailyLocalDrain: formData.get("dailyLocalDrain"),
    localLoanAprMonthly: formData.get("localLoanAprMonthly"),
    baseMarginDefault: formData.get("baseMarginDefault"),
  });

  if (!parsed.success) {
    throw new Error("Invalid financial settings.");
  }

  const payload = parsed.data;
  const normalizedBankAnnualRate = normalizeAnnualRate(payload.bankInterestRatePa).toString();
  const normalizedLocalMonthlyRate = normalizeMonthlyRate(payload.localLoanAprMonthly).toString();

  await db
    .update(financialConfigs)
    .set({
      ccLimit: payload.ccLimit,
      bankInterestRatePa: normalizedBankAnnualRate,
      dailyLocalDrain: payload.dailyLocalDrain,
      localLoanAprMonthly: normalizedLocalMonthlyRate,
      baseMarginDefault: payload.baseMarginDefault,
      updatedAt: new Date(),
    })
    .where(eq(financialConfigs.shopId, tenant.shopId));

  await logAuditEvent({
    shopId: tenant.shopId,
    actorUserId: tenant.userId,
    eventType: "FINANCIAL_SETTINGS_UPDATED",
    entityType: "FINANCIAL_CONFIG",
    entityId: tenant.shopId,
    payload: {
      ccLimit: payload.ccLimit,
      bankInterestRatePa: normalizedBankAnnualRate,
      dailyLocalDrain: payload.dailyLocalDrain,
      localLoanAprMonthly: normalizedLocalMonthlyRate,
      baseMarginDefault: payload.baseMarginDefault,
    },
  });

  redirect("/admin?saved=finance");
}

export async function lockBusinessDay(formData: FormData) {
  const tenant = await getTenantContext();
  if (!tenant) {
    redirect("/");
  }

  const lockDate = normalizeBusinessDateInput(formData.get("date"));

  await db
    .insert(dailyClosures)
    .values({
      shopId: tenant.shopId,
      closureDate: lockDate,
      isLocked: true,
      closedBy: tenant.userId,
      reason: "Locked from admin control",
    })
    .onConflictDoUpdate({
      target: [dailyClosures.shopId, dailyClosures.closureDate],
      set: {
        isLocked: true,
        closedBy: tenant.userId,
        reason: "Locked from admin control",
      },
    });

  await logAuditEvent({
    shopId: tenant.shopId,
    actorUserId: tenant.userId,
    eventDate: lockDate,
    eventType: "BUSINESS_DAY_LOCKED",
    entityType: "DAY_LOCK",
    entityId: lockDate,
    payload: { lockDate },
  });

  redirect(`/admin?saved=locked&day=${lockDate}`);
}

export async function reopenBusinessDay(formData: FormData) {
  const tenant = await getTenantContext();
  if (!tenant) {
    redirect("/");
  }

  const unlockDate = normalizeBusinessDateInput(formData.get("date"));

  await db
    .insert(dailyClosures)
    .values({
      shopId: tenant.shopId,
      closureDate: unlockDate,
      isLocked: false,
      closedBy: tenant.userId,
      reason: "Reopened from admin control",
    })
    .onConflictDoUpdate({
      target: [dailyClosures.shopId, dailyClosures.closureDate],
      set: {
        isLocked: false,
        closedBy: tenant.userId,
        reason: "Reopened from admin control",
      },
    });

  await logAuditEvent({
    shopId: tenant.shopId,
    actorUserId: tenant.userId,
    eventDate: unlockDate,
    eventType: "BUSINESS_DAY_REOPENED",
    entityType: "DAY_LOCK",
    entityId: unlockDate,
    payload: { unlockDate },
  });

  redirect(`/admin?saved=reopened&day=${unlockDate}`);
}

export async function lockTodayBusinessDay() {
  const formData = new FormData();
  formData.set("date", getBusinessDateString());
  await lockBusinessDay(formData);
}

export async function reopenTodayBusinessDay() {
  const formData = new FormData();
  formData.set("date", getBusinessDateString());
  await reopenBusinessDay(formData);
}

const snapshotMonthSchema = z.object({
  monthYear: z.string().trim().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM"),
});

export async function generateSnapshotAction(formData: FormData) {
  const tenant = await getTenantContext();
  if (!tenant) {
    redirect("/");
  }

  const parsed = snapshotMonthSchema.safeParse({ monthYear: formData.get("monthYear") });
  if (!parsed.success) {
    throw new Error("Invalid month format. Use YYYY-MM e.g. 2026-03");
  }

  await generateMonthlySnapshot(tenant.shopId, parsed.data.monthYear);

  await logAuditEvent({
    shopId: tenant.shopId,
    actorUserId: tenant.userId,
    eventType: "MONTHLY_SNAPSHOT_GENERATED",
    entityType: "MONTHLY_SNAPSHOT",
    entityId: parsed.data.monthYear,
    payload: { monthYear: parsed.data.monthYear },
  });

  redirect(`/reports?generated=${parsed.data.monthYear}`);
}

const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["MANAGER", "VIEWER"]),
});

const accountResetSchema = z.object({
  currentPassword: z.string().trim().min(8),
  confirmPhrase: z.string().trim().refine((value) => value.toUpperCase() === "RESET"),
});

export async function inviteMember(formData: FormData) {
  const tenant = await getTenantContext();
  if (!tenant) {
    redirect("/");
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    throw new Error("Invalid invite payload. Provide a valid email and role.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for team invite.");
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: inviteData, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo: `${siteUrl}/auth/callback?next=/` },
  );

  if (error || !inviteData?.user) {
    throw new Error(`Invite failed: ${error?.message ?? "unknown error"}`);
  }

  await db
    .insert(shopMembers)
    .values({
      shopId: tenant.shopId,
      userId: inviteData.user.id,
      role: parsed.data.role,
      invitedBy: tenant.userId,
    })
    .onConflictDoUpdate({
      target: [shopMembers.shopId, shopMembers.userId],
      set: { role: parsed.data.role },
    });

  await logAuditEvent({
    shopId: tenant.shopId,
    actorUserId: tenant.userId,
    eventType: "MEMBER_INVITED",
    entityType: "SHOP_MEMBER",
    entityId: inviteData.user.id,
    payload: { email: parsed.data.email, role: parsed.data.role },
  });

  redirect("/admin?saved=invited");
}

export async function resetAccountData(formData: FormData) {
  const tenant = await getTenantContext();
  if (!tenant) {
    redirect("/");
  }

  const parsed = accountResetSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    confirmPhrase: formData.get("confirmPhrase"),
  });

  if (!parsed.success) {
    redirect("/admin?error=reset_invalid_input");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/admin?error=reset_auth_required");
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (verifyError) {
    redirect("/admin?error=reset_invalid_password");
  }

  try {
    await db.transaction(async (tx) => {
      // Admin and app audit trails for this shop
      await tx.delete(adminAuditLogs).where(eq(adminAuditLogs.shopId, tenant.shopId));
      await tx.delete(auditEvents).where(eq(auditEvents.shopId, tenant.shopId));

      // Business data (full wipe)
      await tx.delete(corrections).where(eq(corrections.shopId, tenant.shopId));
      await tx.delete(monthlySnapshots).where(eq(monthlySnapshots.shopId, tenant.shopId));
      await tx.delete(dailyClosures).where(eq(dailyClosures.shopId, tenant.shopId));
      await tx.delete(dailyInterestLogs).where(eq(dailyInterestLogs.shopId, tenant.shopId));
      await tx.delete(expenses).where(eq(expenses.shopId, tenant.shopId));
      await tx.delete(dailySummaries).where(eq(dailySummaries.shopId, tenant.shopId));
      await tx.delete(supplierTransactions).where(eq(supplierTransactions.shopId, tenant.shopId));
      await tx.delete(suppliers).where(eq(suppliers.shopId, tenant.shopId));

      // Debt + CA ledgers
      await tx.delete(currentAccountMovements).where(eq(currentAccountMovements.shopId, tenant.shopId));
      await tx.delete(debtPayments).where(eq(debtPayments.shopId, tenant.shopId));
      await tx.delete(debtAccountMovements).where(eq(debtAccountMovements.shopId, tenant.shopId));
      await tx.delete(debtAccounts).where(eq(debtAccounts.shopId, tenant.shopId));
      await tx.delete(currentAccountAccounts).where(eq(currentAccountAccounts.shopId, tenant.shopId));

      // Team membership reset: only owner remains
      await tx.delete(shopMembers).where(eq(shopMembers.shopId, tenant.shopId));
      await tx
        .insert(shopMembers)
        .values({
          shopId: tenant.shopId,
          userId: tenant.userId,
          role: "OWNER",
          invitedBy: tenant.userId,
        })
        .onConflictDoNothing({
          target: [shopMembers.shopId, shopMembers.userId],
        });

      // Financial config reset to defaults
      await tx
        .insert(financialConfigs)
        .values({
          shopId: tenant.shopId,
          ccLimit: "0",
          bankInterestRatePa: "0",
          dailyLocalDrain: "0",
          localLoanAprMonthly: "0",
          baseMarginDefault: "20",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [financialConfigs.shopId],
          set: {
            ccLimit: "0",
            bankInterestRatePa: "0",
            dailyLocalDrain: "0",
            localLoanAprMonthly: "0",
            baseMarginDefault: "20",
            updatedAt: new Date(),
          },
        });
    });

    await logAuditEvent({
      shopId: tenant.shopId,
      actorUserId: tenant.userId,
      eventType: "ACCOUNT_DATA_RESET",
      entityType: "SHOP",
      entityId: tenant.shopId,
      payload: { resetBy: tenant.userId },
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/daily-parta");
    revalidatePath("/debt-engine");
    revalidatePath("/debt-engine/ledger");
    revalidatePath("/debt-engine/current-account-statement");
    revalidatePath("/supplier-wall");
    revalidatePath("/financial-identity");
    revalidatePath("/reports");
  } catch (error) {
    console.error("Account reset failed:", error);
    redirect("/admin?error=reset_failed");
  }

  redirect("/admin?saved=account_reset");
}

export async function removeMember(formData: FormData) {
  const tenant = await getTenantContext();
  if (!tenant) {
    redirect("/");
  }

  const memberId = z.string().uuid().safeParse(formData.get("memberId"));
  if (!memberId.success) {
    throw new Error("Invalid member ID.");
  }

  await db
    .delete(shopMembers)
    .where(
      // Only allow deletion within this shop; can't delete self (owner)
      and(
        eq(shopMembers.id, memberId.data),
        eq(shopMembers.shopId, tenant.shopId),
      ),
    );

  await logAuditEvent({
    shopId: tenant.shopId,
    actorUserId: tenant.userId,
    eventType: "MEMBER_REMOVED",
    entityType: "SHOP_MEMBER",
    entityId: memberId.data,
    payload: {},
  });

  redirect("/admin?saved=member_removed");
}
