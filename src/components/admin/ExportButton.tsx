"use client";

import { Download, Loader } from "lucide-react";
import { useState } from "react";
import {
  exportAdminDailyPartaCsvAction,
  exportAdminDailyPartaPdfAction,
  exportAdminDebtEngineCsvAction,
  exportAdminDebtEnginePdfAction,
  exportAdminSuppliersCsvAction,
  exportAdminSuppliersPdfAction,
} from "@/lib/actions/adminExports";

type ExportResult = { data: string; filename: string; mimeType: string } | { error: string };
type ExportActionKey =
  | "admin-daily-csv"
  | "admin-daily-pdf"
  | "admin-suppliers-csv"
  | "admin-suppliers-pdf"
  | "admin-debt-csv"
  | "admin-debt-pdf";

type ExportButtonProps = {
  label?: string;
  actionKey: ExportActionKey;
};

export function ExportButton({
  label = "Export CSV",
  actionKey,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runExport = async (): Promise<ExportResult> => {
    switch (actionKey) {
      case "admin-daily-csv":
        return exportAdminDailyPartaCsvAction();
      case "admin-daily-pdf":
        return exportAdminDailyPartaPdfAction();
      case "admin-suppliers-csv":
        return exportAdminSuppliersCsvAction();
      case "admin-suppliers-pdf":
        return exportAdminSuppliersPdfAction();
      case "admin-debt-csv":
        return exportAdminDebtEngineCsvAction();
      case "admin-debt-pdf":
        return exportAdminDebtEnginePdfAction();
      default:
        return { error: "Invalid export action" };
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await runExport();

      if ("error" in result) {
        setError(result.error);
        return;
      }

      const { data, filename, mimeType } = result;

      // Decode base64 for binary formats (PDF), use string directly for CSV
      const bytes = mimeType === "application/pdf"
        ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
        : new TextEncoder().encode(data);

      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.985] disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader size={18} className="animate-spin" />
            <span>{label} in progress...</span>
          </>
        ) : (
          <>
            <Download size={18} />
            <span>{label}</span>
          </>
        )}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
