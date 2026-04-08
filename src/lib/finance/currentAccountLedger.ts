import Decimal from "decimal.js";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  currentAccountAccounts,
  currentAccountMovements,
} from "@/db/schema";

type LedgerTx = {
  select: typeof db.select;
  insert: typeof db.insert;
  update: typeof db.update;
  delete: typeof db.delete;
};

export type CaMovementType =
  | "SALES_INFLOW"
  | "CC_DRAWDOWN_INFLOW"
  | "EXTERNAL_DEPOSIT_INFLOW"
  | "SUPPLIER_PAYMENT_OUTFLOW"
  | "CC_REPAYMENT_OUTFLOW"
  | "EXPENSE_OUTFLOW"
  | "ADJUSTMENT";

export type CaSourceType =
  | "SALES"
  | "DEBT_DRAWDOWN"
  | "SUPPLIER_PAYMENT"
  | "EXPENSE"
  | "DEBT_REPAYMENT"
  | "MANUAL_ADJUSTMENT";

export async function ensureCurrentAccount(
  tx: LedgerTx,
  shopId: string,
  preferredName?: string | null,
) {
  const [existing] = await tx
    .select({
      id: currentAccountAccounts.id,
      accountName: currentAccountAccounts.accountName,
      openingBalance: currentAccountAccounts.openingBalance,
      currentBalance: currentAccountAccounts.currentBalance,
    })
    .from(currentAccountAccounts)
    .where(eq(currentAccountAccounts.shopId, shopId))
    .limit(1);

  if (existing) {
    if (preferredName && preferredName.trim() && existing.accountName !== preferredName.trim()) {
      await tx
        .update(currentAccountAccounts)
        .set({
          accountName: preferredName.trim(),
          updatedAt: new Date(),
        })
        .where(eq(currentAccountAccounts.id, existing.id));

      return {
        ...existing,
        accountName: preferredName.trim(),
      };
    }

    return existing;
  }

  const [inserted] = await tx
    .insert(currentAccountAccounts)
    .values({
      shopId,
      accountName: preferredName?.trim() || "Current Account",
      openingBalance: "0",
      currentBalance: "0",
    })
    .returning({
      id: currentAccountAccounts.id,
      accountName: currentAccountAccounts.accountName,
      openingBalance: currentAccountAccounts.openingBalance,
      currentBalance: currentAccountAccounts.currentBalance,
    });

  if (!inserted) {
    throw new Error("Unable to initialize current account ledger.");
  }

  return inserted;
}

export async function recomputeCurrentAccountBalances(tx: LedgerTx, shopId: string, preferredName?: string | null) {
  const account = await ensureCurrentAccount(tx, shopId, preferredName);
  const openingBalance = new Decimal(account.openingBalance || "0");

  const rows = await tx
    .select({
      id: currentAccountMovements.id,
      amount: currentAccountMovements.amount,
      direction: currentAccountMovements.direction,
    })
    .from(currentAccountMovements)
    .where(eq(currentAccountMovements.shopId, shopId))
    .orderBy(
      asc(currentAccountMovements.movementDate),
      asc(currentAccountMovements.createdAt),
      asc(currentAccountMovements.id),
    );

  let running = openingBalance;
  for (const row of rows) {
    const amount = new Decimal(row.amount || "0");
    running = row.direction === 1 ? running.add(amount) : running.minus(amount);

    await tx
      .update(currentAccountMovements)
      .set({ balanceAfter: running.toFixed(2) })
      .where(eq(currentAccountMovements.id, row.id));
  }

  await tx
    .update(currentAccountAccounts)
    .set({
      currentBalance: running.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(currentAccountAccounts.shopId, shopId));
}

export async function recordCurrentAccountMovement(
  tx: LedgerTx,
  input: {
    shopId: string;
    movementDate: string;
    movementType: CaMovementType;
    amount: string | number;
    direction: 1 | -1;
    sourceType?: CaSourceType;
    sourceId?: string;
    linkedDebtAccountId?: string;
    linkedDebtMovementId?: string;
    description?: string;
    notes?: string;
    preferredAccountName?: string | null;
  },
) {
  const amountDecimal = new Decimal(input.amount || 0);
  if (amountDecimal.lte(0)) {
    return null;
  }

  await ensureCurrentAccount(tx, input.shopId, input.preferredAccountName);

  const [inserted] = await tx
    .insert(currentAccountMovements)
    .values({
      shopId: input.shopId,
      movementDate: input.movementDate,
      movementType: input.movementType,
      amount: amountDecimal.toFixed(2),
      direction: input.direction,
      sourceType: input.sourceType || null,
      sourceId: input.sourceId || null,
      linkedDebtAccountId: input.linkedDebtAccountId || null,
      linkedDebtMovementId: input.linkedDebtMovementId || null,
      description: input.description || null,
      notes: input.notes || null,
      balanceAfter: null,
    })
    .returning({ id: currentAccountMovements.id });

  await recomputeCurrentAccountBalances(tx, input.shopId, input.preferredAccountName);

  return inserted?.id ?? null;
}

export async function upsertCurrentAccountMovementBySource(
  tx: LedgerTx,
  input: {
    shopId: string;
    sourceType: CaSourceType;
    sourceId: string;
    movementDate: string;
    movementType: CaMovementType;
    amount: string | number;
    direction: 1 | -1;
    linkedDebtAccountId?: string;
    linkedDebtMovementId?: string;
    description?: string;
    notes?: string;
    preferredAccountName?: string | null;
  },
) {
  const amountDecimal = new Decimal(input.amount || 0);
  if (amountDecimal.lt(0)) {
    throw new Error("Current account movement amount cannot be negative.");
  }

  await ensureCurrentAccount(tx, input.shopId, input.preferredAccountName);

  const [existing] = await tx
    .select({ id: currentAccountMovements.id })
    .from(currentAccountMovements)
    .where(
      and(
        eq(currentAccountMovements.shopId, input.shopId),
        eq(currentAccountMovements.sourceType, input.sourceType),
        eq(currentAccountMovements.sourceId, input.sourceId),
      ),
    )
    .limit(1);

  if (existing) {
    if (amountDecimal.eq(0)) {
      await tx.delete(currentAccountMovements).where(eq(currentAccountMovements.id, existing.id));
      await recomputeCurrentAccountBalances(tx, input.shopId, input.preferredAccountName);
      return null;
    }

    await tx
      .update(currentAccountMovements)
      .set({
        movementDate: input.movementDate,
        movementType: input.movementType,
        amount: amountDecimal.toFixed(2),
        direction: input.direction,
        linkedDebtAccountId: input.linkedDebtAccountId || null,
        linkedDebtMovementId: input.linkedDebtMovementId || null,
        description: input.description || null,
        notes: input.notes || null,
      })
      .where(eq(currentAccountMovements.id, existing.id));

    await recomputeCurrentAccountBalances(tx, input.shopId, input.preferredAccountName);
    return existing.id;
  }

  if (amountDecimal.eq(0)) {
    return null;
  }

  const [inserted] = await tx
    .insert(currentAccountMovements)
    .values({
      shopId: input.shopId,
      movementDate: input.movementDate,
      movementType: input.movementType,
      amount: amountDecimal.toFixed(2),
      direction: input.direction,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      linkedDebtAccountId: input.linkedDebtAccountId || null,
      linkedDebtMovementId: input.linkedDebtMovementId || null,
      description: input.description || null,
      notes: input.notes || null,
      balanceAfter: null,
    })
    .returning({ id: currentAccountMovements.id });

  await recomputeCurrentAccountBalances(tx, input.shopId, input.preferredAccountName);
  return inserted?.id ?? null;
}
