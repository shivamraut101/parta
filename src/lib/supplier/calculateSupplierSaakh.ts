import Decimal from "decimal.js";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { supplierTransactions, suppliers } from "@/db/schema";

export type SupplierSaakhResult = {
  score: number;
  currentBalance: Decimal;
  totalPurchaseVolume: Decimal;
  daysSinceLastTransaction: number | null;
  recentPaymentIn7Days: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export async function calculateSupplierSaakh(supplierId: string): Promise<SupplierSaakhResult> {
  const [supplier] = await db
    .select({
      id: suppliers.id,
      currentBalance: suppliers.currentBalance,
      lastPaymentDate: suppliers.lastPaymentDate,
    })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);

  if (!supplier) {
    throw new Error("Supplier not found.");
  }

  const [purchaseAgg] = await db
    .select({
      total: sql<string>`coalesce(sum(${supplierTransactions.amount}), '0')`,
    })
    .from(supplierTransactions)
    .where(
      and(
        eq(supplierTransactions.supplierId, supplierId),
        eq(supplierTransactions.type, "PURCHASE"),
      ),
    );

  const [latestTx] = await db
    .select({
      createdAt: supplierTransactions.createdAt,
    })
    .from(supplierTransactions)
    .where(
      and(
        eq(supplierTransactions.supplierId, supplierId),
        inArray(supplierTransactions.type, ["PURCHASE", "PAYMENT", "RETURN"]),
      ),
    )
    .orderBy(desc(supplierTransactions.createdAt))
    .limit(1);

  const now = new Date();
  const lastPaymentDate = supplier.lastPaymentDate ? new Date(supplier.lastPaymentDate) : null;
  const daysSinceLastPayment = lastPaymentDate
    ? Math.floor((now.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const recentPaymentIn7Days = daysSinceLastPayment !== null && daysSinceLastPayment <= 7;

  const currentBalance = new Decimal(supplier.currentBalance);
  const totalPurchaseVolume = new Decimal(purchaseAgg?.total ?? "0");

  const belowHalfPurchaseVolume =
    totalPurchaseVolume.gt(0) && currentBalance.lt(totalPurchaseVolume.mul(0.5));

  const daysSinceLastTransaction = latestTx?.createdAt
    ? Math.floor((now.getTime() - new Date(latestTx.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let score = 0;
  if (recentPaymentIn7Days) {
    score += 50;
  }

  if (belowHalfPurchaseVolume) {
    score += 25;
  }

  if (daysSinceLastTransaction !== null && daysSinceLastTransaction >= 15) {
    score -= 20;
  }

  return {
    score: clamp(score, 0, 100),
    currentBalance,
    totalPurchaseVolume,
    daysSinceLastTransaction,
    recentPaymentIn7Days,
  };
}
