import { and, desc, eq, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { dailySummaries, expenses } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

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

export async function GET(request: NextRequest) {
  // Auth guard
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) {
    return NextResponse.json({ error: "Shop not found" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const month = searchParams.get("month"); // YYYY-MM
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let fromDate: string;
  let toDate: string;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    fromDate = `${month}-01`;
    toDate = new Date(y!, m!, 0).toLocaleDateString("en-CA");
  } else if (from && to) {
    fromDate = from;
    toDate = to;
  } else {
    // Default: current month
    const today = new Date().toLocaleDateString("en-CA");
    fromDate = today.slice(0, 7) + "-01";
    const [y, m] = today.split("-").map(Number);
    toDate = new Date(y!, m!, 0).toLocaleDateString("en-CA");
  }

  const summaries = await db
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
        eq(dailySummaries.shopId, tenant.shopId),
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
        eq(expenses.shopId, tenant.shopId),
        gte(expenses.expenseDate, fromDate),
        lte(expenses.expenseDate, toDate),
      ),
    )
    .orderBy(desc(expenses.expenseDate));

  const lines: string[] = [];

  lines.push("DAILY SUMMARIES");
  lines.push(row(["Date", "Cash Sales", "UPI Sales", "Margin %", "Gross Profit", "Voided", "Void Reason"]));
  for (const s of summaries) {
    lines.push(row([
      s.date,
      s.totalSalesCash,
      s.totalSalesUpi,
      s.marginApplied,
      s.estimatedGrossProfit,
      s.isVoided ? "Yes" : "No",
      s.voidReason,
    ]));
  }

  lines.push("");
  lines.push("EXPENSES");
  lines.push(row(["Date", "Amount", "Category", "Description"]));
  for (const e of expenseRows) {
    lines.push(row([e.date, e.amount, e.category, e.description]));
  }

  const csvContent = lines.join("\r\n");
  const filename = `daily-parta-${fromDate}-to-${toDate}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
