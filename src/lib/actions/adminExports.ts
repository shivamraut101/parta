"use server";

import { getAdminContext } from "@/lib/admin/adminAuth";
import { logAdminAction } from "@/lib/admin/adminActions";
import { generatePDFBuffer, toCSV } from "@/lib/admin/exportUtils";
import { getAllDailySummaries, getAllSuppliers, getAllDebtAccounts } from "@/lib/admin/adminQueries";

type ExportResult = { data: string; filename: string; mimeType: string } | { error: string };

const today = () => new Date().toISOString().split("T")[0];

export async function exportAdminDailyPartaCsvAction(): Promise<ExportResult> {
  const admin = await getAdminContext();
  if (!admin) return { error: "Unauthorized" };

  const summaries = await getAllDailySummaries(5000, 0);

  await logAdminAction({
    adminId: admin.adminId,
    action: "DAILY_PARTA_EXPORTED",
    description: `Exported ${summaries.length} daily parta records to CSV`,
  });

  const csvData = summaries.map((s) => ({
    Shop: s.shopName || "—",
    Date: s.summaryDate ? new Date(s.summaryDate).toLocaleDateString("en-IN") : "—",
    "Cash Sales": s.totalSalesCash ? Number(s.totalSalesCash).toLocaleString("en-IN") : "0",
    "UPI Sales": s.totalSalesUpi ? Number(s.totalSalesUpi).toLocaleString("en-IN") : "0",
    "Gross Profit": s.estimatedGrossProfit ? Number(s.estimatedGrossProfit).toLocaleString("en-IN") : "0",
    "Margin %": s.marginApplied ? Number(s.marginApplied).toFixed(2) : "0",
    Status: s.isVoided ? "Voided" : "Active",
    "Void Reason": s.voidReason || "—",
  }));

  return {
    data: toCSV(csvData),
    filename: `daily-parta-${today()}.csv`,
    mimeType: "text/csv;charset=utf-8",
  };
}

export async function exportAdminDailyPartaPdfAction(): Promise<ExportResult> {
  const admin = await getAdminContext();
  if (!admin) return { error: "Unauthorized" };

  const summaries = await getAllDailySummaries(5000, 0);

  await logAdminAction({
    adminId: admin.adminId,
    action: "DAILY_PARTA_EXPORTED",
    description: `Exported ${summaries.length} daily parta records to PDF`,
  });

  const csvData = summaries.map((s) => ({
    Shop: s.shopName || "—",
    Date: s.summaryDate ? new Date(s.summaryDate).toLocaleDateString("en-IN") : "—",
    "Cash Sales": s.totalSalesCash ? Number(s.totalSalesCash).toLocaleString("en-IN") : "0",
    "UPI Sales": s.totalSalesUpi ? Number(s.totalSalesUpi).toLocaleString("en-IN") : "0",
    "Gross Profit": s.estimatedGrossProfit ? Number(s.estimatedGrossProfit).toLocaleString("en-IN") : "0",
    "Margin %": s.marginApplied ? Number(s.marginApplied).toFixed(2) : "0",
    Status: s.isVoided ? "Voided" : "Active",
    "Void Reason": s.voidReason || "—",
  }));

  const pdf = await generatePDFBuffer("Daily Parta Report", csvData);

  return {
    data: Buffer.from(pdf).toString("base64"),
    filename: `daily-parta-${today()}.pdf`,
    mimeType: "application/pdf",
  };
}

export async function exportAdminSuppliersCsvAction(): Promise<ExportResult> {
  const admin = await getAdminContext();
  if (!admin) return { error: "Unauthorized" };

  const suppliersList = await getAllSuppliers(5000, 0);

  await logAdminAction({
    adminId: admin.adminId,
    action: "SUPPLIERS_EXPORTED",
    description: `Exported ${suppliersList.length} suppliers to CSV`,
  });

  const csvData = suppliersList.map((s) => ({
    Shop: s.shopName || "—",
    "Supplier Name": s.name,
    Contact: s.contactNumber || "—",
    Category: s.category,
    "Current Balance": s.currentBalance ? Number(s.currentBalance).toLocaleString("en-IN") : "0",
    "Last Payment": s.lastPaymentDate ? new Date(s.lastPaymentDate).toLocaleDateString("en-IN") : "—",
    Created: s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-IN") : "—",
  }));

  return {
    data: toCSV(csvData),
    filename: `suppliers-${today()}.csv`,
    mimeType: "text/csv;charset=utf-8",
  };
}

export async function exportAdminSuppliersPdfAction(): Promise<ExportResult> {
  const admin = await getAdminContext();
  if (!admin) return { error: "Unauthorized" };

  const suppliersList = await getAllSuppliers(5000, 0);

  await logAdminAction({
    adminId: admin.adminId,
    action: "SUPPLIERS_EXPORTED",
    description: `Exported ${suppliersList.length} suppliers to PDF`,
  });

  const csvData = suppliersList.map((s) => ({
    Shop: s.shopName || "—",
    "Supplier Name": s.name,
    Contact: s.contactNumber || "—",
    Category: s.category,
    "Current Balance": s.currentBalance ? Number(s.currentBalance).toLocaleString("en-IN") : "0",
    "Last Payment": s.lastPaymentDate ? new Date(s.lastPaymentDate).toLocaleDateString("en-IN") : "—",
    Created: s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-IN") : "—",
  }));

  const pdf = await generatePDFBuffer("Suppliers Report", csvData);

  return {
    data: Buffer.from(pdf).toString("base64"),
    filename: `suppliers-${today()}.pdf`,
    mimeType: "application/pdf",
  };
}

export async function exportAdminDebtEngineCsvAction(): Promise<ExportResult> {
  const admin = await getAdminContext();
  if (!admin) return { error: "Unauthorized" };

  const accounts = await getAllDebtAccounts(5000, 0);

  await logAdminAction({
    adminId: admin.adminId,
    action: "DEBT_ENGINE_EXPORTED",
    description: `Exported ${accounts.length} debt accounts to CSV`,
  });

  const csvData = accounts.map((a) => ({
    Shop: a.shopName || "—",
    "Account Name": a.name,
    Lender: a.lenderName || "—",
    Type: a.kind,
    Principal: a.principalAmount ? Number(a.principalAmount).toLocaleString("en-IN") : "0",
    Outstanding: a.outstandingAmount ? Number(a.outstandingAmount).toLocaleString("en-IN") : "0",
    "Annual Rate %": a.annualRatePa ? Number(a.annualRatePa).toFixed(4) : "0",
    Status: a.isActive ? "Active" : "Inactive",
  }));

  return {
    data: toCSV(csvData),
    filename: `debt-engine-${today()}.csv`,
    mimeType: "text/csv;charset=utf-8",
  };
}

export async function exportAdminDebtEnginePdfAction(): Promise<ExportResult> {
  const admin = await getAdminContext();
  if (!admin) return { error: "Unauthorized" };

  const accounts = await getAllDebtAccounts(5000, 0);

  await logAdminAction({
    adminId: admin.adminId,
    action: "DEBT_ENGINE_EXPORTED",
    description: `Exported ${accounts.length} debt accounts to PDF`,
  });

  const csvData = accounts.map((a) => ({
    Shop: a.shopName || "—",
    "Account Name": a.name,
    Lender: a.lenderName || "—",
    Type: a.kind,
    Principal: a.principalAmount ? Number(a.principalAmount).toLocaleString("en-IN") : "0",
    Outstanding: a.outstandingAmount ? Number(a.outstandingAmount).toLocaleString("en-IN") : "0",
    "Annual Rate %": a.annualRatePa ? Number(a.annualRatePa).toFixed(4) : "0",
    Status: a.isActive ? "Active" : "Inactive",
  }));

  const pdf = await generatePDFBuffer("Debt Engine Report", csvData);

  return {
    data: Buffer.from(pdf).toString("base64"),
    filename: `debt-engine-${today()}.pdf`,
    mimeType: "application/pdf",
  };
}
