import { db } from "@/db";
import {
  adminAuditLogs,
  adminUsers,
  dailySummaries,
  debtAccounts,
  financialConfigs,
  shops,
  suppliers,
} from "@/db/schema";
import Decimal from "decimal.js";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

/**
 * Get all shops with summary statistics
 */
export async function getAllShopsWithStats() {
  const [shopsData, salesAggRows, debtAggRows, supplierAggRows] = await Promise.all([
    db.select().from(shops),
    db
      .select({
        shopId: dailySummaries.shopId,
        totalCash: sql<string>`coalesce(sum(${dailySummaries.totalSalesCash}), '0')`,
        totalUpi: sql<string>`coalesce(sum(${dailySummaries.totalSalesUpi}), '0')`,
      })
      .from(dailySummaries)
      .where(eq(dailySummaries.isVoided, false))
      .groupBy(dailySummaries.shopId),
    db
      .select({
        shopId: debtAccounts.shopId,
        totalDebt: sql<string>`coalesce(sum(${debtAccounts.outstandingAmount}), '0')`,
      })
      .from(debtAccounts)
      .where(eq(debtAccounts.isActive, true))
      .groupBy(debtAccounts.shopId),
    db
      .select({
        shopId: suppliers.shopId,
        totalSupplierPayables: sql<string>`coalesce(sum(${suppliers.currentBalance}), '0')`,
      })
      .from(suppliers)
      .groupBy(suppliers.shopId),
  ]);

  const salesByShop = new Map(
    salesAggRows.map((row) => [
      row.shopId,
      {
        cash: new Decimal(row.totalCash ?? "0"),
        upi: new Decimal(row.totalUpi ?? "0"),
      },
    ]),
  );

  const debtByShop = new Map(
    debtAggRows.map((row) => [row.shopId, new Decimal(row.totalDebt ?? "0")]),
  );

  const supplierByShop = new Map(
    supplierAggRows.map((row) => [row.shopId, new Decimal(row.totalSupplierPayables ?? "0")]),
  );

  return shopsData.map((shop) => {
    const shopSales = salesByShop.get(shop.id) ?? {
      cash: new Decimal(0),
      upi: new Decimal(0),
    };

    return {
      ...shop,
      totalSales: shopSales.cash.plus(shopSales.upi),
      totalDebt: debtByShop.get(shop.id) ?? new Decimal(0),
      supplierPayables: supplierByShop.get(shop.id) ?? new Decimal(0),
    };
  });
}

/**
 * Get all daily summaries across all shops
 */
export async function getAllDailySummaries(limit = 1000, offset = 0) {
  return db
    .select({
      id: dailySummaries.id,
      shopId: dailySummaries.shopId,
      shopName: shops.name,
      summaryDate: dailySummaries.summaryDate,
      totalSalesCash: dailySummaries.totalSalesCash,
      totalSalesUpi: dailySummaries.totalSalesUpi,
      marginApplied: dailySummaries.marginApplied,
      estimatedGrossProfit: dailySummaries.estimatedGrossProfit,
      isVoided: dailySummaries.isVoided,
      voidReason: dailySummaries.voidReason,
      createdAt: dailySummaries.createdAt,
    })
    .from(dailySummaries)
    .leftJoin(shops, eq(dailySummaries.shopId, shops.id))
    .orderBy(desc(dailySummaries.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get all debt accounts across all shops
 */
export async function getAllDebtAccounts(limit = 1000, offset = 0) {
  return db
    .select({
      id: debtAccounts.id,
      shopId: debtAccounts.shopId,
      shopName: shops.name,
      name: debtAccounts.name,
      lenderName: debtAccounts.lenderName,
      kind: debtAccounts.kind,
      principalAmount: debtAccounts.principalAmount,
      outstandingAmount: debtAccounts.outstandingAmount,
      annualRatePa: debtAccounts.annualRatePa,
      monthlyRate: debtAccounts.monthlyRate,
      dailyFixedInterest: debtAccounts.dailyFixedInterest,
      isActive: debtAccounts.isActive,
      createdAt: debtAccounts.createdAt,
    })
    .from(debtAccounts)
    .leftJoin(shops, eq(debtAccounts.shopId, shops.id))
    .orderBy(desc(debtAccounts.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get all suppliers across all shops
 */
export async function getAllSuppliers(limit = 1000, offset = 0) {
  return db
    .select({
      id: suppliers.id,
      shopId: suppliers.shopId,
      shopName: shops.name,
      name: suppliers.name,
      contactNumber: suppliers.contactNumber,
      category: suppliers.category,
      currentBalance: suppliers.currentBalance,
      lastPaymentDate: suppliers.lastPaymentDate,
      createdAt: suppliers.createdAt,
    })
    .from(suppliers)
    .leftJoin(shops, eq(suppliers.shopId, shops.id))
    .orderBy(desc(suppliers.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get cross-shop analytics - last 30 days
 */
export async function getCrossShopAnalytics(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const salesData = await db
    .select({
      date: dailySummaries.summaryDate,
      totalCash: dailySummaries.totalSalesCash,
      totalUpi: dailySummaries.totalSalesUpi,
      profit: dailySummaries.estimatedGrossProfit,
    })
    .from(dailySummaries)
    .where(
      and(
        gte(dailySummaries.summaryDate, startDate.toISOString().split("T")[0]),
        eq(dailySummaries.isVoided, false),
      ),
    )
    .orderBy(asc(dailySummaries.summaryDate));

  // Aggregate by date
  const aggregated = salesData.reduce(
    (acc, row) => {
      const existingDay = acc.find((d) => d.date === row.date);
      if (existingDay) {
        existingDay.totalCash = existingDay.totalCash.plus(row.totalCash);
        existingDay.totalUpi = existingDay.totalUpi.plus(row.totalUpi);
        existingDay.profit = existingDay.profit.plus(row.profit);
      } else {
        acc.push({
          date: row.date,
          totalCash: new Decimal(row.totalCash),
          totalUpi: new Decimal(row.totalUpi),
          profit: new Decimal(row.profit),
        });
      }
      return acc;
    },
    [] as Array<{ date: string; totalCash: Decimal; totalUpi: Decimal; profit: Decimal }>,
  );

  return aggregated;
}

/**
 * Get debt analytics across all shops
 */
export async function getDebtAnalytics() {
  const debtData = await db.select().from(debtAccounts);

  const analytics = {
    totalOutstandingActive: new Decimal(0),
    totalPrincipalActive: new Decimal(0),
    totalOutstandingAll: new Decimal(0),
    totalPrincipalAll: new Decimal(0),
    byKindActive: {} as Record<string, { count: number; outstanding: Decimal; principal: Decimal }>,
    byKindAll: {} as Record<string, { count: number; outstanding: Decimal; principal: Decimal }>,
    activeAccounts: 0,
    inactiveAccounts: 0,
  };

  const accumulate = (
    bucket: Record<string, { count: number; outstanding: Decimal; principal: Decimal }>,
    kind: string,
    outstandingAmount: Decimal,
    principalAmount: Decimal,
  ) => {
    if (!bucket[kind]) {
      bucket[kind] = {
        count: 0,
        outstanding: new Decimal(0),
        principal: new Decimal(0),
      };
    }

    bucket[kind].count += 1;
    bucket[kind].outstanding = bucket[kind].outstanding.plus(outstandingAmount);
    bucket[kind].principal = bucket[kind].principal.plus(principalAmount);
  };

  debtData.forEach((account) => {
    const outstandingAmount = new Decimal(account.outstandingAmount ?? "0");
    const principalAmount = new Decimal(account.principalAmount ?? "0");

    analytics.totalOutstandingAll = analytics.totalOutstandingAll.plus(outstandingAmount);
    analytics.totalPrincipalAll = analytics.totalPrincipalAll.plus(principalAmount);
    accumulate(analytics.byKindAll, account.kind, outstandingAmount, principalAmount);

    if (account.isActive) {
      analytics.activeAccounts += 1;
      analytics.totalOutstandingActive = analytics.totalOutstandingActive.plus(outstandingAmount);
      analytics.totalPrincipalActive = analytics.totalPrincipalActive.plus(principalAmount);
      accumulate(analytics.byKindActive, account.kind, outstandingAmount, principalAmount);
    } else {
      analytics.inactiveAccounts += 1;
    }
  });

  return {
    ...analytics,
    // Backward-compatible aliases used by existing pages.
    totalOutstanding: analytics.totalOutstandingActive,
    totalPrincipal: analytics.totalPrincipalActive,
    byKind: analytics.byKindActive,
  };
}

/**
 * Get all admin audit logs
 */
export async function getAdminAuditLogs(limit = 500, offset = 0) {
  return db
    .select({
      id: adminAuditLogs.id,
      adminEmail: adminUsers.email,
      action: adminAuditLogs.action,
      shopId: adminAuditLogs.shopId,
      targetType: adminAuditLogs.targetType,
      targetId: adminAuditLogs.targetId,
      description: adminAuditLogs.description,
      ipAddress: adminAuditLogs.ipAddress,
      createdAt: adminAuditLogs.createdAt,
    })
    .from(adminAuditLogs)
    .leftJoin(adminUsers, eq(adminAuditLogs.adminId, adminUsers.id))
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get detailed metrics for one shop
 */
export async function getShopAdminDetails(shopId: string) {
  const shopRows = await db
    .select({
      id: shops.id,
      name: shops.name,
      ownerId: shops.ownerId,
      brandName: shops.brandName,
      logoUrl: shops.logoUrl,
      primaryColor: shops.primaryColor,
      currencySymbol: shops.currencySymbol,
      createdAt: shops.createdAt,
      ccLimit: financialConfigs.ccLimit,
      bankInterestRatePa: financialConfigs.bankInterestRatePa,
      dailyLocalDrain: financialConfigs.dailyLocalDrain,
      localLoanAprMonthly: financialConfigs.localLoanAprMonthly,
      baseMarginDefault: financialConfigs.baseMarginDefault,
    })
    .from(shops)
    .leftJoin(financialConfigs, eq(financialConfigs.shopId, shops.id))
    .where(eq(shops.id, shopId))
    .limit(1);

  const shop = shopRows[0];
  if (!shop) {
    return null;
  }

  const [summaries, accounts, supplierRows] = await Promise.all([
    db
      .select({
        id: dailySummaries.id,
        summaryDate: dailySummaries.summaryDate,
        totalSalesCash: dailySummaries.totalSalesCash,
        totalSalesUpi: dailySummaries.totalSalesUpi,
        estimatedGrossProfit: dailySummaries.estimatedGrossProfit,
        isVoided: dailySummaries.isVoided,
      })
      .from(dailySummaries)
      .where(eq(dailySummaries.shopId, shopId))
      .orderBy(desc(dailySummaries.summaryDate))
      .limit(30),
    db
      .select({
        id: debtAccounts.id,
        name: debtAccounts.name,
        kind: debtAccounts.kind,
        outstandingAmount: debtAccounts.outstandingAmount,
        isActive: debtAccounts.isActive,
      })
      .from(debtAccounts)
      .where(eq(debtAccounts.shopId, shopId))
      .orderBy(desc(debtAccounts.createdAt)),
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        category: suppliers.category,
        currentBalance: suppliers.currentBalance,
      })
      .from(suppliers)
      .where(eq(suppliers.shopId, shopId))
      .orderBy(desc(suppliers.createdAt)),
  ]);

  const activeSummaries = summaries.filter((row) => !row.isVoided);

  const totalSales = activeSummaries.reduce(
    (sum, row) => sum.plus(row.totalSalesCash || 0).plus(row.totalSalesUpi || 0),
    new Decimal(0),
  );

  const totalProfit = activeSummaries.reduce(
    (sum, row) => sum.plus(row.estimatedGrossProfit || 0),
    new Decimal(0),
  );

  const totalDebt = accounts.reduce((sum, row) => sum.plus(row.outstandingAmount || 0), new Decimal(0));
  const totalSupplierBalance = supplierRows.reduce(
    (sum, row) => sum.plus(row.currentBalance || 0),
    new Decimal(0),
  );

  return {
    shop,
    summaries,
    debtAccounts: accounts,
    suppliers: supplierRows,
    metrics: {
      summaryCount: summaries.length,
      activeSummaryCount: activeSummaries.length,
      voidedSummaryCount: summaries.length - activeSummaries.length,
      debtCount: accounts.length,
      supplierCount: supplierRows.length,
      totalSales,
      totalProfit,
      totalDebt,
      totalSupplierBalance,
    },
  };
}
