"use client";

import { Download, Loader } from "lucide-react";
import { useState } from "react";

type ExportResult = { data: string; filename: string; mimeType: string } | { error: string };

type ExportButtonProps = {
  label?: string;
  action: () => Promise<ExportResult>;
};

export function ExportButton({
  label = "Export CSV",
  action,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleExport = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await action();

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
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <>
            <Loader size={18} className="animate-spin" />
            <span>Exporting...</span>
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
