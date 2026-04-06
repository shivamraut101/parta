import { and, desc, eq, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { supplierTransactions, suppliers } from "@/db/schema";
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

  // Optional date filter via ?from=YYYY-MM-DD&to=YYYY-MM-DD or ?month=YYYY-MM
  const { searchParams } = request.nextUrl;
  const month = searchParams.get("month");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [eq(supplierTransactions.shopId, tenant.shopId)];

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const fromDate = `${month}-01`;
    const toDate = new Date(y!, m!, 0).toLocaleDateString("en-CA");
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
      id: supplierTransactions.id,
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
    lines.push(row([
      tx.createdAt.toLocaleDateString("en-CA"),
      tx.supplierName,
      tx.category,
      tx.type,
      tx.amount,
      tx.note,
    ]));
  }

  const filenameTag = month ?? from ? `${from}-to-${to}` : "all";
  const filename = `supplier-transactions-${filenameTag}.csv`;

  return new NextResponse(lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
