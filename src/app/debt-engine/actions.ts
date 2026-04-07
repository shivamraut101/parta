"use server";

import Decimal from "decimal.js";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { debtAccounts, debtPayments, shops } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { assertBusinessDayUnlocked } from "@/lib/lock/assertBusinessDayUnlocked";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { normalizeBusinessDateInput } from "@/lib/time/businessDate";

const debtTargetTypeSchema = z.enum(["BANK_CC", "LOCAL_LOAN"]);
const debtPaymentSourceSchema = z.enum(["CASH", "UPI"]);

const debtPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  debtAccountId: z.string().uuid().optional(),
  targetType: debtTargetTypeSchema,
  source: debtPaymentSourceSchema,
});

const debtAccountKindSchema = z.enum([
  "BANK_CC",
  "BANK_TERM_LOAN",
  "BANK_OD",
  "BANK_BILL_DISCOUNT",
  "LOCAL_DAILY",
  "LOCAL_MONTHLY",
  "LOCAL_BULLET",
  "LOCAL_FLEXI",
]);

const debtRateInputTypeSchema = z.enum([
  "ANNUAL_PERCENT",
  "MONTHLY_PERCENT",
  "DAILY_FIXED",
  "EMI_DAILY",
  "EMI_MONTHLY",
]);

const debtInstallmentFrequencySchema = z.enum([
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "BULLET",
]);

const createDebtAccountSchema = z.object({
  name: z.string().min(2).max(160),
  lenderName: z.string().max(160).optional(),
  kind: debtAccountKindSchema,
  rateInputType: debtRateInputTypeSchema,
  principalAmount: z.coerce.number().nonnegative().default(0),
  outstandingAmount: z.coerce.number().nonnegative().default(0),
  annualRatePa: z.coerce.number().nonnegative().default(0),
  monthlyRate: z.coerce.number().nonnegative().default(0),
  dailyFixedInterest: z.coerce.number().nonnegative().default(0),
  installmentAmount: z.coerce.number().nonnegative().default(0),
  installmentFrequency: debtInstallmentFrequencySchema.default("MONTHLY"),
  remainingInstallments: z.coerce.number().int().nonnegative().default(0),
  startDate: z.string().optional(),
  maturityDate: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.outstandingAmount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Outstanding amount must be greater than 0",
      path: ["outstandingAmount"],
    });
  }

  if (data.rateInputType === "ANNUAL_PERCENT" && data.annualRatePa <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Annual rate is required and must be > 0",
      path: ["annualRatePa"],
    });
  }

  if (data.rateInputType === "MONTHLY_PERCENT" && data.monthlyRate <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Monthly rate is required and must be > 0",
      path: ["monthlyRate"],
    });
  }

  if (data.rateInputType === "DAILY_FIXED" && data.dailyFixedInterest <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Daily fixed interest is required and must be > 0",
      path: ["dailyFixedInterest"],
    });
  }

  if ((data.rateInputType === "EMI_DAILY" || data.rateInputType === "EMI_MONTHLY") && data.installmentAmount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Installment amount is required and must be > 0",
      path: ["installmentAmount"],
    });
  }

  if ((data.rateInputType === "EMI_DAILY" || data.rateInputType === "EMI_MONTHLY") && data.remainingInstallments <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Remaining installments must be > 0",
      path: ["remainingInstallments"],
    });
  }
});

async function assertTenantShopOwnership(shopId: string, userId: string) {
  const [shop] = await db
    .select({ id: shops.id })
    .from(shops)
    .where(and(eq(shops.id, shopId), eq(shops.ownerId, userId)))
    .limit(1);

  if (!shop) {
    throw new Error("Tenant ownership verification failed.");
  }
}

export async function recordDebtPayment(formData: FormData) {
  const context = await getTenantContext();

  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = debtPaymentSchema.safeParse({
    amount: formData.get("amount"),
    date: normalizeBusinessDateInput(formData.get("date")),
    debtAccountId: formData.get("debtAccountId") || undefined,
    targetType: formData.get("targetType"),
    source: formData.get("source"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid debt payment payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);

  const payload = parsed.data;

  // If account-ledger mode is enabled (active debt accounts exist), force explicit account selection.
  const [hasAnyActiveAccount] = await db
    .select({ id: debtAccounts.id })
    .from(debtAccounts)
    .where(and(eq(debtAccounts.shopId, context.shopId), eq(debtAccounts.isActive, true)))
    .limit(1);

  if (hasAnyActiveAccount && !payload.debtAccountId) {
    throw new Error("Please select a loan account before recording payment.");
  }

  let resolvedTargetType = payload.targetType;
  let resolvedDebtAccountId = payload.debtAccountId;
  let selectedAccount:
    | {
        id: string;
        kind: string;
        outstandingAmount: string;
        rateInputType: "ANNUAL_PERCENT" | "MONTHLY_PERCENT" | "DAILY_FIXED" | "EMI_DAILY" | "EMI_MONTHLY";
        installmentAmount: string;
        remainingInstallments: number;
      }
    | undefined;

  if (payload.debtAccountId) {
    const [account] = await db
      .select({
        id: debtAccounts.id,
        kind: debtAccounts.kind,
        outstandingAmount: debtAccounts.outstandingAmount,
        rateInputType: debtAccounts.rateInputType,
        installmentAmount: debtAccounts.installmentAmount,
        remainingInstallments: debtAccounts.remainingInstallments,
      })
      .from(debtAccounts)
      .where(
        and(
          eq(debtAccounts.id, payload.debtAccountId),
          eq(debtAccounts.shopId, context.shopId),
          eq(debtAccounts.isActive, true),
        ),
      )
      .limit(1);

    if (!account) {
      throw new Error("Invalid debt account selected.");
    }

    selectedAccount = account;
    resolvedTargetType = account.kind.startsWith("BANK_") ? "BANK_CC" : "LOCAL_LOAN";
    resolvedDebtAccountId = account.id;
  }

  await assertBusinessDayUnlocked(context.shopId, payload.date);

  const [insertedPayment] = await db.insert(debtPayments).values({
    shopId: context.shopId,
    amount: payload.amount.toString(),
    debtAccountId: resolvedDebtAccountId,
    paymentDate: payload.date,
    targetType: resolvedTargetType,
    source: payload.source,
  }).returning({ id: debtPayments.id });

  if (selectedAccount) {
    const paymentAmount = new Decimal(payload.amount);
    const outstandingBefore = new Decimal(selectedAccount.outstandingAmount || "0");
    const outstandingAfter = Decimal.max(outstandingBefore.minus(paymentAmount), 0);

    const installmentBased =
      selectedAccount.rateInputType === "EMI_DAILY" ||
      selectedAccount.rateInputType === "EMI_MONTHLY";

    let remainingInstallmentsAfter = selectedAccount.remainingInstallments;
    if (installmentBased && remainingInstallmentsAfter > 0) {
      const perInstallment = new Decimal(selectedAccount.installmentAmount || "0");
      const paidInstallments = perInstallment.gt(0)
        ? Math.max(1, paymentAmount.div(perInstallment).floor().toNumber())
        : 1;

      remainingInstallmentsAfter = Math.max(
        selectedAccount.remainingInstallments - paidInstallments,
        0,
      );
    }

    const nextIsActive = installmentBased
      ? outstandingAfter.gt(0) && remainingInstallmentsAfter > 0
      : outstandingAfter.gt(0);

    await db
      .update(debtAccounts)
      .set({
        outstandingAmount: outstandingAfter.toFixed(2),
        remainingInstallments: remainingInstallmentsAfter,
        isActive: nextIsActive,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(debtAccounts.id, selectedAccount.id),
          eq(debtAccounts.shopId, context.shopId),
        ),
      );
  }

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: payload.date,
    eventType: "DEBT_PAYMENT_RECORDED",
    entityType: "DEBT_PAYMENT",
    entityId: insertedPayment?.id,
    payload: {
      amount: payload.amount,
      targetType: resolvedTargetType,
      source: payload.source,
      debtAccountId: resolvedDebtAccountId,
    },
  });

  revalidatePath("/debt-engine");
}

export async function createDebtAccount(formData: FormData) {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = createDebtAccountSchema.safeParse({
    name: formData.get("name"),
    lenderName: formData.get("lenderName") || undefined,
    kind: formData.get("kind"),
    rateInputType: formData.get("rateInputType"),
    principalAmount: formData.get("principalAmount") || "0",
    outstandingAmount: formData.get("outstandingAmount") || "0",
    annualRatePa: formData.get("annualRatePa") || "0",
    monthlyRate: formData.get("monthlyRate") || "0",
    dailyFixedInterest: formData.get("dailyFixedInterest") || "0",
    installmentAmount: formData.get("installmentAmount") || "0",
    installmentFrequency: formData.get("installmentFrequency") || "MONTHLY",
    remainingInstallments: formData.get("remainingInstallments") || "0",
    startDate: normalizeBusinessDateInput(formData.get("startDate")) || undefined,
    maturityDate: normalizeBusinessDateInput(formData.get("maturityDate")) || undefined,
    notes: (formData.get("notes")?.toString() || "").trim() || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid debt account payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);

  const payload = parsed.data;
  await db.insert(debtAccounts).values({
    shopId: context.shopId,
    name: payload.name,
    lenderName: payload.lenderName,
    kind: payload.kind,
    rateInputType: payload.rateInputType,
    principalAmount: payload.principalAmount.toString(),
    outstandingAmount: payload.outstandingAmount.toString(),
    annualRatePa: payload.annualRatePa.toString(),
    monthlyRate: payload.monthlyRate.toString(),
    dailyFixedInterest: payload.dailyFixedInterest.toString(),
    installmentAmount: payload.installmentAmount.toString(),
    installmentFrequency: payload.installmentFrequency,
    remainingInstallments: payload.remainingInstallments,
    startDate: payload.startDate,
    maturityDate: payload.maturityDate,
    notes: payload.notes,
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: normalizeBusinessDateInput(formData.get("startDate")) || normalizeBusinessDateInput(formData.get("maturityDate")) || new Date().toISOString().slice(0, 10),
    eventType: "DEBT_ACCOUNT_CREATED",
    entityType: "DEBT_ACCOUNT",
    payload: {
      name: payload.name,
      kind: payload.kind,
      rateInputType: payload.rateInputType,
      outstandingAmount: payload.outstandingAmount,
    },
  });

  revalidatePath("/debt-engine");
}
