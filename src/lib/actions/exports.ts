"use server";

import { and, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { dailySummaries, expenses, supplierTransactions, suppliers } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

type ExportResult = { data: string; filename: string; mimeType: string } | { error: string };

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsv).join(",");
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function getAuthContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const tenant = await getTenantContext();
  if (!tenant) return null;
  return { user, tenant };
}

export async function exportDailyPartaCsvAction(month?: string, from?: string, to?: string): Promise<ExportResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: "Unauthorized" };

  let fromDate: string;
  let toDate: string;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    fromDate = `${month}-01`;
    toDate = toYmd(new Date(Date.UTC(y!, m!, 0)));
  } else if (from && to) {
    fromDate = from;
    toDate = to;
  } else {
    const today = toYmd(new Date());
    fromDate = today.slice(0, 7) + "-01";
    const [y, m] = today.split("-").map(Number);
    toDate = toYmd(new Date(Date.UTC(y!, m!, 0)));
  }

  const summaryRows = await db
    .select({
      date: dailySummaries.summaryDate,
      totalSalesCash: dailySummaries.totalSalesCash,
      totalSalesUpi: dailySummaries.totalSalesUpi,
      marginApplied: dailySummaries.marginApplied,
      estimatedGrossProfit: dailySummaries.estimatedGrossProfit,
      isVoided: dailySummaries.isVoided,
      voidReason: dailySummaries.voidReason,
    })
    .from(dailySummaries)
    .where(
      and(
        eq(dailySummaries.shopId, ctx.tenant.shopId),
        gte(dailySummaries.summaryDate, fromDate),
        lte(dailySummaries.summaryDate, toDate),
      ),
    )
    .orderBy(desc(dailySummaries.summaryDate));

  const expenseRows = await db
    .select({
      date: expenses.expenseDate,
      amount: expenses.amount,
      category: expenses.category,
      description: expenses.description,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.shopId, ctx.tenant.shopId),
        gte(expenses.expenseDate, fromDate),
        lte(expenses.expenseDate, toDate),
      ),
    )
    .orderBy(desc(expenses.expenseDate));

  const lines: string[] = [];
  lines.push("DAILY SUMMARIES");
  lines.push(row(["Date", "Cash Sales", "UPI Sales", "Margin %", "Gross Profit", "Voided", "Void Reason"]));
  for (const s of summaryRows) {
    lines.push(row([s.date, s.totalSalesCash, s.totalSalesUpi, s.marginApplied, s.estimatedGrossProfit, s.isVoided ? "Yes" : "No", s.voidReason]));
  }
  lines.push("");
  lines.push("EXPENSES");
  lines.push(row(["Date", "Amount", "Category", "Description"]));
  for (const e of expenseRows) {
    lines.push(row([e.date, e.amount, e.category, e.description]));
  }

  return {
    data: lines.join("\r\n"),
    filename: `daily-parta-${fromDate}-to-${toDate}.csv`,
    mimeType: "text/csv;charset=utf-8",
  };
}

export async function exportSuppliersCsvAction(month?: string, from?: string, to?: string): Promise<ExportResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: "Unauthorized" };

  const conditions = [eq(supplierTransactions.shopId, ctx.tenant.shopId)];

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const fromDate = `${month}-01`;
    const toDate = toYmd(new Date(Date.UTC(y!, m!, 0)));
    conditions.push(
      gte(supplierTransactions.createdAt, new Date(`${fromDate}T00:00:00+05:30`)),
      lte(supplierTransactions.createdAt, new Date(`${toDate}T23:59:59+05:30`)),
    );
  } else if (from && to) {
    conditions.push(
      gte(supplierTransactions.createdAt, new Date(`${from}T00:00:00+05:30`)),
      lte(supplierTransactions.createdAt, new Date(`${to}T23:59:59+05:30`)),
    );
  }

  const txRows = await db
    .select({
      createdAt: supplierTransactions.createdAt,
      supplierName: suppliers.name,
      category: suppliers.category,
      type: supplierTransactions.type,
      amount: supplierTransactions.amount,
      note: supplierTransactions.note,
    })
    .from(supplierTransactions)
    .innerJoin(suppliers, eq(suppliers.id, supplierTransactions.supplierId))
    .where(and(...conditions))
    .orderBy(desc(supplierTransactions.createdAt));

  const lines: string[] = [];
  lines.push(row(["Date", "Supplier", "Category", "Type", "Amount", "Note"]));
  for (const tx of txRows) {
    lines.push(row([toYmd(tx.createdAt), tx.supplierName, tx.category, tx.type, tx.amount, tx.note]));
  }

  const filenameTag = month ? month : from && to ? `${from}-to-${to}` : "all";

  return {
    data: lines.join("\r\n"),
    filename: `supplier-transactions-${filenameTag}.csv`,
    mimeType: "text/csv;charset=utf-8",
  };
}
