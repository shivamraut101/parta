"use server";

import Decimal from "decimal.js";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import {
  currentAccountMovements,
  debtAccountMovements,
  debtAccounts,
  debtPayments,
  shops,
} from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { recomputeCurrentAccountBalances, recordCurrentAccountMovement } from "@/lib/finance/currentAccountLedger";
import { assertBusinessDayUnlocked } from "@/lib/lock/assertBusinessDayUnlocked";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { normalizeBusinessDateInput } from "@/lib/time/businessDate";

const debtTargetTypeSchema = z.enum(["BANK_CC", "LOCAL_LOAN"]);
const debtPaymentSourceSchema = z.enum([
  "CASH",
  "UPI",
  "NEFT",
  "IMPS",
  "CC_TO_CA_TRANSFER",
  "CA_TO_CC_TRANSFER",
]);

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

const debtDrawdownSchema = z.object({
  debtAccountId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  source: debtPaymentSourceSchema.optional(),
  notes: z.string().max(500).optional(),
});

const currentAccountAdjustmentSchema = z.object({
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  direction: z.enum(["IN", "OUT"]),
  notes: z.string().max(500).optional(),
  accountName: z.string().max(160).optional(),
});

const updateDebtMovementMetaSchema = z.object({
  movementId: z.string().uuid(),
  movementDate: z.string().min(1),
  notes: z.string().max(500).optional(),
  returnTo: z.string().optional(),
});

const updateCurrentAccountMovementSchema = z.object({
  movementId: z.string().uuid(),
  movementDate: z.string().min(1).optional(),
  amount: z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      if (typeof value === "string") return Number(value);
      return value;
    },
    z.number().finite().optional(),
  ),
  direction: z.enum(["IN", "OUT"]).optional(),
  notes: z.string().max(500).optional(),
  returnTo: z.string().optional(),
});

type DebtRateInputType = z.infer<typeof debtRateInputTypeSchema>;
type DebtInstallmentFrequency = z.infer<typeof debtInstallmentFrequencySchema>;
type DebtAccountKind = z.infer<typeof debtAccountKindSchema>;

const revolvingDebtKinds = new Set<DebtAccountKind>(["BANK_CC", "BANK_OD", "LOCAL_FLEXI"]);

const debtAccountBaseSchema = z.object({
  name: z.string().min(2).max(160),
  lenderName: z.string().max(160).optional(),
  linkedCurrentAccountName: z.string().max(160).optional(),
  kind: debtAccountKindSchema,
  rateInputType: debtRateInputTypeSchema,
  creditLimit: z.coerce.number().nonnegative().default(0),
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
});

type DebtAccountPayload = z.infer<typeof debtAccountBaseSchema>;

function validateDebtAccountPayload(
  data: DebtAccountPayload,
  ctx: z.RefinementCtx,
  requirePositiveOutstanding: boolean,
) {
  if (requirePositiveOutstanding && data.outstandingAmount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Outstanding amount must be greater than 0",
      path: ["outstandingAmount"],
    });
  }

  if ((data.kind === "BANK_CC" || data.kind === "BANK_OD") && data.creditLimit <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "CC/OD account ke liye credit limit required hai.",
      path: ["creditLimit"],
    });
  }

  if ((data.kind === "BANK_CC" || data.kind === "BANK_OD") && data.creditLimit > 0 && data.outstandingAmount > data.creditLimit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Outstanding amount credit limit se zyada nahi ho sakta.",
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
}

const createDebtAccountSchema = debtAccountBaseSchema.superRefine((data, ctx) => {
  validateDebtAccountPayload(data, ctx, false);
});

const updateDebtAccountSchema = debtAccountBaseSchema.extend({
  debtAccountId: z.string().uuid(),
}).superRefine((data, ctx) => {
  validateDebtAccountPayload(data, ctx, false);
});

function isInstallmentRateType(type: DebtRateInputType) {
  return type === "EMI_DAILY" || type === "EMI_MONTHLY";
}

function sanitizeRateValues(payload: {
  rateInputType: DebtRateInputType;
  annualRatePa: number;
  monthlyRate: number;
  dailyFixedInterest: number;
  installmentAmount: number;
  installmentFrequency: DebtInstallmentFrequency;
  remainingInstallments: number;
}) {
  const installmentBased = isInstallmentRateType(payload.rateInputType);
  return {
    annualRatePa: payload.rateInputType === "ANNUAL_PERCENT" ? payload.annualRatePa.toString() : "0",
    monthlyRate: payload.rateInputType === "MONTHLY_PERCENT" ? payload.monthlyRate.toString() : "0",
    dailyFixedInterest: payload.rateInputType === "DAILY_FIXED" ? payload.dailyFixedInterest.toString() : "0",
    installmentAmount: installmentBased ? payload.installmentAmount.toString() : "0",
    installmentFrequency: installmentBased ? payload.installmentFrequency : "MONTHLY" as const,
    remainingInstallments: installmentBased ? payload.remainingInstallments : 0,
  };
}

function assertOutstandingWithinLimit(kind: DebtAccountKind | string, outstanding: Decimal, limit: Decimal) {
  if ((kind === "BANK_CC" || kind === "BANK_OD") && limit.gt(0) && outstanding.gt(limit)) {
    throw new Error("Outstanding amount cannot exceed credit limit for CC/OD account.");
  }
}

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
      name: string;
      kind: DebtAccountKind;
      linkedCurrentAccountName: string | null;
      outstandingAmount: string;
      totalRepaidAmount: string;
      rateInputType: DebtRateInputType;
      installmentAmount: string;
      remainingInstallments: number;
    }
    | undefined;

  if (payload.debtAccountId) {
    const [account] = await db
      .select({
        id: debtAccounts.id,
        name: debtAccounts.name,
        kind: debtAccounts.kind,
        linkedCurrentAccountName: debtAccounts.linkedCurrentAccountName,
        outstandingAmount: debtAccounts.outstandingAmount,
        totalRepaidAmount: debtAccounts.totalRepaidAmount,
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

  if (selectedAccount) {
    const paymentAmount = new Decimal(payload.amount);
    const outstandingBefore = new Decimal(selectedAccount.outstandingAmount || "0");
    if (paymentAmount.gt(outstandingBefore)) {
      throw new Error("Payment outstanding amount se zyada nahi ho sakta.");
    }
  }

  await assertBusinessDayUnlocked(context.shopId, payload.date);
  let insertedPaymentId: string | undefined;

  await db.transaction(async (tx) => {
    const [insertedPayment] = await tx.insert(debtPayments).values({
      shopId: context.shopId,
      amount: payload.amount.toString(),
      debtAccountId: resolvedDebtAccountId,
      paymentDate: payload.date,
      targetType: resolvedTargetType,
      source: payload.source,
    }).returning({ id: debtPayments.id });

    insertedPaymentId = insertedPayment?.id;

    if (selectedAccount) {
      const paymentAmount = new Decimal(payload.amount);
      const outstandingBefore = new Decimal(selectedAccount.outstandingAmount || "0");

      const outstandingAfter = Decimal.max(outstandingBefore.minus(paymentAmount), 0);
      const totalRepaidAfter = new Decimal(selectedAccount.totalRepaidAmount || "0").add(paymentAmount);

      const installmentBased = isInstallmentRateType(selectedAccount.rateInputType);

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

      await tx
        .update(debtAccounts)
        .set({
          outstandingAmount: outstandingAfter.toFixed(2),
          totalRepaidAmount: totalRepaidAfter.toFixed(2),
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

      const [insertedMovement] = await tx.insert(debtAccountMovements).values({
        shopId: context.shopId,
        debtAccountId: selectedAccount.id,
        movementType: "REPAYMENT",
        amount: paymentAmount.toFixed(2),
        movementDate: payload.date,
        source: payload.source,
        notes: "Payment recorded from debt engine",
      }).returning({ id: debtAccountMovements.id });

      if (payload.source === "CA_TO_CC_TRANSFER") {
        const linkedCaMovementId = await recordCurrentAccountMovement(tx, {
          shopId: context.shopId,
          movementDate: payload.date,
          movementType: "CC_REPAYMENT_OUTFLOW",
          amount: paymentAmount.toFixed(2),
          direction: -1,
          sourceType: "DEBT_REPAYMENT",
          sourceId: insertedPayment?.id,
          linkedDebtAccountId: selectedAccount.id,
          linkedDebtMovementId: insertedMovement?.id,
          description: `CA to CC repayment for ${selectedAccount.name}`,
          preferredAccountName: selectedAccount.linkedCurrentAccountName,
        });

        if (linkedCaMovementId && insertedMovement?.id) {
          await tx
            .update(debtAccountMovements)
            .set({ linkedCaMovementId })
            .where(eq(debtAccountMovements.id, insertedMovement.id));
        }
      }
    }
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: payload.date,
    eventType: "DEBT_PAYMENT_RECORDED",
    entityType: "DEBT_PAYMENT",
    entityId: insertedPaymentId,
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

  const rawStartDate = (formData.get("startDate")?.toString() || "").trim();
  const rawMaturityDate = (formData.get("maturityDate")?.toString() || "").trim();

  const parsed = createDebtAccountSchema.safeParse({
    name: formData.get("name"),
    lenderName: formData.get("lenderName") || undefined,
    linkedCurrentAccountName: (formData.get("linkedCurrentAccountName")?.toString() || "").trim() || undefined,
    kind: formData.get("kind"),
    rateInputType: formData.get("rateInputType"),
    creditLimit: formData.get("creditLimit") || "0",
    principalAmount: formData.get("principalAmount") || "0",
    outstandingAmount: formData.get("outstandingAmount") || "0",
    annualRatePa: formData.get("annualRatePa") || "0",
    monthlyRate: formData.get("monthlyRate") || "0",
    dailyFixedInterest: formData.get("dailyFixedInterest") || "0",
    installmentAmount: formData.get("installmentAmount") || "0",
    installmentFrequency: formData.get("installmentFrequency") || "MONTHLY",
    remainingInstallments: formData.get("remainingInstallments") || "0",
    startDate: rawStartDate ? normalizeBusinessDateInput(rawStartDate) : undefined,
    maturityDate: rawMaturityDate ? normalizeBusinessDateInput(rawMaturityDate) : undefined,
    notes: (formData.get("notes")?.toString() || "").trim() || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid debt account payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);

  const payload = parsed.data;
  const principalAmount = new Decimal(payload.principalAmount || 0);
  const outstandingAmount = new Decimal(payload.outstandingAmount || 0);
  const creditLimit = (payload.kind === "BANK_CC" || payload.kind === "BANK_OD")
    ? new Decimal(payload.creditLimit || payload.principalAmount || payload.outstandingAmount || 0)
    : principalAmount;

  const possibleDuplicates = await db
    .select({
      id: debtAccounts.id,
      lenderName: debtAccounts.lenderName,
      startDate: debtAccounts.startDate,
      creditLimit: debtAccounts.creditLimit,
      kind: debtAccounts.kind,
      name: debtAccounts.name,
    })
    .from(debtAccounts)
    .where(and(
      eq(debtAccounts.shopId, context.shopId),
      eq(debtAccounts.kind, payload.kind),
      eq(debtAccounts.name, payload.name),
    ));

  const hasExactDuplicate = possibleDuplicates.some((row) => {
    const sameLender = (row.lenderName ?? "").trim().toLowerCase() === (payload.lenderName ?? "").trim().toLowerCase();
    const sameStartDate = (row.startDate ?? "") === (payload.startDate ?? null);
    const sameCreditLimit = new Decimal(row.creditLimit || "0").eq(creditLimit);
    return sameLender && sameStartDate && sameCreditLimit;
  });

  if (hasExactDuplicate) {
    throw new Error("Same loan account pehle se exist karta hai. Naya add karne ki jagah Edit use karo.");
  }

  assertOutstandingWithinLimit(payload.kind, outstandingAmount, creditLimit);

  const totalDrawnAmount = Decimal.max(principalAmount, outstandingAmount);
  const totalRepaidAmount = Decimal.max(totalDrawnAmount.minus(outstandingAmount), 0);
  const sanitizedRates = sanitizeRateValues(payload);

  const [insertedAccount] = await db.insert(debtAccounts).values({
    shopId: context.shopId,
    name: payload.name,
    lenderName: payload.lenderName,
    linkedCurrentAccountName: payload.linkedCurrentAccountName,
    kind: payload.kind,
    rateInputType: payload.rateInputType,
    creditLimit: creditLimit.toFixed(2),
    principalAmount: principalAmount.toFixed(2),
    outstandingAmount: outstandingAmount.toFixed(2),
    totalDrawnAmount: totalDrawnAmount.toFixed(2),
    totalRepaidAmount: totalRepaidAmount.toFixed(2),
    annualRatePa: sanitizedRates.annualRatePa,
    monthlyRate: sanitizedRates.monthlyRate,
    dailyFixedInterest: sanitizedRates.dailyFixedInterest,
    installmentAmount: sanitizedRates.installmentAmount,
    installmentFrequency: sanitizedRates.installmentFrequency,
    remainingInstallments: sanitizedRates.remainingInstallments,
    startDate: payload.startDate,
    maturityDate: payload.maturityDate,
    notes: payload.notes,
  }).returning({ id: debtAccounts.id });

  if (totalDrawnAmount.gt(0) && insertedAccount?.id) {
    await db.insert(debtAccountMovements).values({
      shopId: context.shopId,
      debtAccountId: insertedAccount.id,
      movementType: "OPENING",
      amount: totalDrawnAmount.toFixed(2),
      movementDate: payload.startDate || new Date().toISOString().slice(0, 10),
      notes: "Opening balance",
    });
  }

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: payload.startDate || new Date().toISOString().slice(0, 10),
    eventType: "DEBT_ACCOUNT_CREATED",
    entityType: "DEBT_ACCOUNT",
    entityId: insertedAccount?.id,
    payload: {
      name: payload.name,
      kind: payload.kind,
      rateInputType: payload.rateInputType,
      creditLimit: creditLimit.toFixed(2),
      outstandingAmount: outstandingAmount.toFixed(2),
    },
  });

  revalidatePath("/debt-engine");
}

export async function updateDebtAccount(formData: FormData) {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const rawMaturityDate = (formData.get("maturityDate")?.toString() || "").trim();
  const rawLinkedCurrentAccountName = (formData.get("linkedCurrentAccountName")?.toString() || "").trim();

  const parsed = updateDebtAccountSchema.safeParse({
    debtAccountId: formData.get("debtAccountId"),
    name: formData.get("name"),
    lenderName: formData.get("lenderName") || undefined,
    linkedCurrentAccountName: rawLinkedCurrentAccountName || undefined,
    kind: formData.get("kind"),
    rateInputType: formData.get("rateInputType"),
    creditLimit: formData.get("creditLimit") || "0",
    principalAmount: formData.get("principalAmount") || "0",
    outstandingAmount: formData.get("outstandingAmount") || "0",
    annualRatePa: formData.get("annualRatePa") || "0",
    monthlyRate: formData.get("monthlyRate") || "0",
    dailyFixedInterest: formData.get("dailyFixedInterest") || "0",
    installmentAmount: formData.get("installmentAmount") || "0",
    installmentFrequency: formData.get("installmentFrequency") || "MONTHLY",
    remainingInstallments: formData.get("remainingInstallments") || "0",
    startDate: normalizeBusinessDateInput(formData.get("startDate")) || undefined,
    maturityDate: normalizeBusinessDateInput(rawMaturityDate) || undefined,
    notes: (formData.get("notes")?.toString() || "").trim() || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid debt account update payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);
  const payload = parsed.data;

  const [existing] = await db
    .select({
      id: debtAccounts.id,
      totalDrawnAmount: debtAccounts.totalDrawnAmount,
      totalRepaidAmount: debtAccounts.totalRepaidAmount,
    })
    .from(debtAccounts)
    .where(and(eq(debtAccounts.id, payload.debtAccountId), eq(debtAccounts.shopId, context.shopId)))
    .limit(1);

  if (!existing) {
    throw new Error("Loan account not found.");
  }

  const principalAmount = new Decimal(payload.principalAmount || 0);
  const outstandingAmount = new Decimal(payload.outstandingAmount || 0);
  const creditLimit = (payload.kind === "BANK_CC" || payload.kind === "BANK_OD")
    ? new Decimal(payload.creditLimit || payload.principalAmount || payload.outstandingAmount || 0)
    : principalAmount;

  assertOutstandingWithinLimit(payload.kind, outstandingAmount, creditLimit);

  let totalDrawnAmount = new Decimal(existing.totalDrawnAmount || "0");
  let totalRepaidAmount = new Decimal(existing.totalRepaidAmount || "0");
  const oldOutstanding = Decimal.max(totalDrawnAmount.minus(totalRepaidAmount), 0);

  if (outstandingAmount.gt(oldOutstanding)) {
    totalDrawnAmount = totalDrawnAmount.add(outstandingAmount.minus(oldOutstanding));
  } else if (outstandingAmount.lt(oldOutstanding)) {
    totalRepaidAmount = totalRepaidAmount.add(oldOutstanding.minus(outstandingAmount));
  }

  totalDrawnAmount = Decimal.max(totalDrawnAmount, principalAmount, outstandingAmount);
  totalRepaidAmount = Decimal.max(totalRepaidAmount, totalDrawnAmount.minus(outstandingAmount), 0);

  const sanitizedRates = sanitizeRateValues(payload);
  const installmentBased = isInstallmentRateType(payload.rateInputType);
  const nextIsActive = installmentBased
    ? outstandingAmount.gt(0) && sanitizedRates.remainingInstallments > 0
    : outstandingAmount.gt(0);

  await db
    .update(debtAccounts)
    .set({
      name: payload.name,
      lenderName: payload.lenderName,
      linkedCurrentAccountName: rawLinkedCurrentAccountName || null,
      kind: payload.kind,
      rateInputType: payload.rateInputType,
      creditLimit: creditLimit.toFixed(2),
      principalAmount: principalAmount.toFixed(2),
      outstandingAmount: outstandingAmount.toFixed(2),
      totalDrawnAmount: totalDrawnAmount.toFixed(2),
      totalRepaidAmount: totalRepaidAmount.toFixed(2),
      annualRatePa: sanitizedRates.annualRatePa,
      monthlyRate: sanitizedRates.monthlyRate,
      dailyFixedInterest: sanitizedRates.dailyFixedInterest,
      installmentAmount: sanitizedRates.installmentAmount,
      installmentFrequency: sanitizedRates.installmentFrequency,
      remainingInstallments: sanitizedRates.remainingInstallments,
      startDate: payload.startDate,
      maturityDate: rawMaturityDate ? payload.maturityDate : null,
      notes: payload.notes,
      isActive: nextIsActive,
      updatedAt: new Date(),
    })
    .where(and(eq(debtAccounts.id, payload.debtAccountId), eq(debtAccounts.shopId, context.shopId)));

  if (!outstandingAmount.eq(oldOutstanding)) {
    await db.insert(debtAccountMovements).values({
      shopId: context.shopId,
      debtAccountId: payload.debtAccountId,
      movementType: "ADJUSTMENT",
      amount: outstandingAmount.minus(oldOutstanding).abs().toFixed(2),
      movementDate: new Date().toISOString().slice(0, 10),
      notes: `Manual edit: outstanding ${oldOutstanding.toFixed(2)} -> ${outstandingAmount.toFixed(2)}`,
    });
  }

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: new Date().toISOString().slice(0, 10),
    eventType: "DEBT_ACCOUNT_UPDATED",
    entityType: "DEBT_ACCOUNT",
    entityId: payload.debtAccountId,
    payload: {
      name: payload.name,
      kind: payload.kind,
      rateInputType: payload.rateInputType,
      creditLimit: creditLimit.toFixed(2),
      outstandingAmount: outstandingAmount.toFixed(2),
    },
  });

  revalidatePath("/debt-engine");
}

export async function recordDebtDrawdown(formData: FormData) {
  const context = await getTenantContext();

  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = debtDrawdownSchema.safeParse({
    debtAccountId: formData.get("debtAccountId"),
    amount: formData.get("amount"),
    date: normalizeBusinessDateInput(formData.get("date")),
    source: formData.get("source") || undefined,
    notes: (formData.get("notes")?.toString() || "").trim() || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid drawdown payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);
  const payload = parsed.data;

  await assertBusinessDayUnlocked(context.shopId, payload.date);

  const [account] = await db
    .select({
      id: debtAccounts.id,
      name: debtAccounts.name,
      kind: debtAccounts.kind,
      linkedCurrentAccountName: debtAccounts.linkedCurrentAccountName,
      creditLimit: debtAccounts.creditLimit,
      outstandingAmount: debtAccounts.outstandingAmount,
      totalDrawnAmount: debtAccounts.totalDrawnAmount,
    })
    .from(debtAccounts)
    .where(and(eq(debtAccounts.id, payload.debtAccountId), eq(debtAccounts.shopId, context.shopId)))
    .limit(1);

  if (!account) {
    throw new Error("Invalid debt account selected.");
  }

  if (!revolvingDebtKinds.has(account.kind as DebtAccountKind)) {
    throw new Error("Drawdown sirf revolving accounts (CC/OD/Flexi) me allowed hai.");
  }

  const drawAmount = new Decimal(payload.amount);
  const outstandingBefore = new Decimal(account.outstandingAmount || "0");
  const outstandingAfter = outstandingBefore.add(drawAmount);
  const creditLimit = new Decimal(account.creditLimit || "0");
  assertOutstandingWithinLimit(account.kind, outstandingAfter, creditLimit);

  const totalDrawnAfter = new Decimal(account.totalDrawnAmount || "0").add(drawAmount);

  await db.transaction(async (tx) => {
    await tx
      .update(debtAccounts)
      .set({
        outstandingAmount: outstandingAfter.toFixed(2),
        totalDrawnAmount: totalDrawnAfter.toFixed(2),
        isActive: true,
        updatedAt: new Date(),
      })
      .where(and(eq(debtAccounts.id, account.id), eq(debtAccounts.shopId, context.shopId)));

    const [insertedMovement] = await tx.insert(debtAccountMovements).values({
      shopId: context.shopId,
      debtAccountId: account.id,
      movementType: "DRAWDOWN",
      amount: drawAmount.toFixed(2),
      movementDate: payload.date,
      source: payload.source,
      notes: payload.notes,
    }).returning({ id: debtAccountMovements.id });

    if (payload.source === "CC_TO_CA_TRANSFER") {
      const linkedCaMovementId = await recordCurrentAccountMovement(tx, {
        shopId: context.shopId,
        movementDate: payload.date,
        movementType: "CC_DRAWDOWN_INFLOW",
        amount: drawAmount.toFixed(2),
        direction: 1,
        sourceType: "DEBT_DRAWDOWN",
        sourceId: insertedMovement?.id,
        linkedDebtAccountId: account.id,
        linkedDebtMovementId: insertedMovement?.id,
        description: `CC drawdown to CA from ${account.name}`,
        preferredAccountName: account.linkedCurrentAccountName,
        notes: payload.notes,
      });

      if (linkedCaMovementId && insertedMovement?.id) {
        await tx
          .update(debtAccountMovements)
          .set({ linkedCaMovementId })
          .where(eq(debtAccountMovements.id, insertedMovement.id));
      }
    }
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: payload.date,
    eventType: "DEBT_DRAWDOWN_RECORDED",
    entityType: "DEBT_ACCOUNT",
    entityId: account.id,
    payload: {
      amount: drawAmount.toFixed(2),
      kind: account.kind,
      source: payload.source,
      notes: payload.notes,
    },
  });

  revalidatePath("/debt-engine");
}

export async function recordCurrentAccountAdjustment(formData: FormData) {
  const context = await getTenantContext();

  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = currentAccountAdjustmentSchema.safeParse({
    amount: formData.get("amount"),
    date: normalizeBusinessDateInput(formData.get("date")),
    direction: formData.get("direction"),
    notes: (formData.get("notes")?.toString() || "").trim() || undefined,
    accountName: (formData.get("accountName")?.toString() || "").trim() || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid current account adjustment payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);
  const payload = parsed.data;

  await assertBusinessDayUnlocked(context.shopId, payload.date);

  const movementType = payload.direction === "IN"
    ? "EXTERNAL_DEPOSIT_INFLOW"
    : "ADJUSTMENT";

  const direction = payload.direction === "IN" ? 1 : -1;

  const movementId = await db.transaction(async (tx) => {
    return recordCurrentAccountMovement(tx, {
      shopId: context.shopId,
      movementDate: payload.date,
      movementType,
      amount: payload.amount.toString(),
      direction,
      sourceType: "MANUAL_ADJUSTMENT",
      description: payload.direction === "IN"
        ? "Manual CA inflow recorded"
        : "Manual CA outflow/adjustment recorded",
      notes: payload.notes,
      preferredAccountName: payload.accountName,
    });
  });

  await logAuditEvent({
    shopId: context.shopId,
    actorUserId: context.userId,
    eventDate: payload.date,
    eventType: "CURRENT_ACCOUNT_ADJUSTMENT_RECORDED",
    entityType: "CURRENT_ACCOUNT_MOVEMENT",
    entityId: movementId || undefined,
    payload: {
      amount: payload.amount,
      direction: payload.direction,
      movementType,
      notes: payload.notes || null,
      accountName: payload.accountName || null,
    },
  });

  revalidatePath("/debt-engine");
}

function getSafeReturnPath(input: string | undefined, fallback: string) {
  if (!input) return fallback;
  if (input.startsWith("/debt-engine")) return input;
  return fallback;
}

export async function updateDebtMovementMeta(formData: FormData) {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = updateDebtMovementMetaSchema.safeParse({
    movementId: formData.get("movementId"),
    movementDate: normalizeBusinessDateInput(formData.get("movementDate")),
    notes: (formData.get("notes")?.toString() || "").trim() || undefined,
    returnTo: (formData.get("returnTo")?.toString() || "").trim() || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid debt movement update payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);
  await assertBusinessDayUnlocked(context.shopId, parsed.data.movementDate);

  const [existing] = await db
    .select({ id: debtAccountMovements.id })
    .from(debtAccountMovements)
    .where(and(eq(debtAccountMovements.id, parsed.data.movementId), eq(debtAccountMovements.shopId, context.shopId)))
    .limit(1);

  if (!existing) {
    throw new Error("Debt movement not found.");
  }

  await db
    .update(debtAccountMovements)
    .set({
      movementDate: parsed.data.movementDate,
      notes: parsed.data.notes || null,
    })
    .where(eq(debtAccountMovements.id, parsed.data.movementId));

  revalidatePath("/debt-engine");

  redirect(getSafeReturnPath(parsed.data.returnTo, "/debt-engine"));
}

export async function updateCurrentAccountMovementEntry(formData: FormData) {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Unauthorized tenant context.");
  }

  const parsed = updateCurrentAccountMovementSchema.safeParse({
    movementId: formData.get("movementId"),
    movementDate: formData.get("movementDate")
      ? normalizeBusinessDateInput(formData.get("movementDate"))
      : undefined,
    amount: formData.get("amount") || undefined,
    direction: formData.get("direction") || undefined,
    notes: (formData.get("notes")?.toString() || "").trim() || undefined,
    returnTo: (formData.get("returnTo")?.toString() || "").trim() || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid current account movement update payload.");
  }

  await assertTenantShopOwnership(context.shopId, context.userId);

  const [existing] = await db
    .select({
      id: currentAccountMovements.id,
      sourceType: currentAccountMovements.sourceType,
      movementDate: currentAccountMovements.movementDate,
      movementType: currentAccountMovements.movementType,
      amount: currentAccountMovements.amount,
      direction: currentAccountMovements.direction,
    })
    .from(currentAccountMovements)
    .where(and(eq(currentAccountMovements.id, parsed.data.movementId), eq(currentAccountMovements.shopId, context.shopId)))
    .limit(1);

  if (!existing) {
    throw new Error("Current account movement not found.");
  }

  const isManual = existing.sourceType === "MANUAL_ADJUSTMENT";

  if (isManual) {
    const nextDate = parsed.data.movementDate || existing.movementDate;
    const nextDirection = parsed.data.direction
      ? (parsed.data.direction === "IN" ? 1 : -1)
      : existing.direction;
    const requestedAmount = parsed.data.amount !== undefined
      ? new Decimal(parsed.data.amount)
      : null;
    const nextAmount = requestedAmount && requestedAmount.gt(0)
      ? requestedAmount
      : new Decimal(existing.amount || "0");

    await assertBusinessDayUnlocked(context.shopId, nextDate);

    await db.transaction(async (tx) => {
      await tx
        .update(currentAccountMovements)
        .set({
          movementDate: nextDate,
          direction: nextDirection,
          movementType: nextDirection === 1 ? "EXTERNAL_DEPOSIT_INFLOW" : "ADJUSTMENT",
          amount: nextAmount.toFixed(2),
          notes: parsed.data.notes || null,
        })
        .where(eq(currentAccountMovements.id, existing.id));

      await recomputeCurrentAccountBalances(tx, context.shopId);
    });
  } else {
    await db
      .update(currentAccountMovements)
      .set({
        notes: parsed.data.notes || null,
      })
      .where(eq(currentAccountMovements.id, existing.id));
  }

  revalidatePath("/debt-engine");
  revalidatePath("/debt-engine/current-account-statement");

  redirect(getSafeReturnPath(parsed.data.returnTo, "/debt-engine/current-account-statement"));
}
