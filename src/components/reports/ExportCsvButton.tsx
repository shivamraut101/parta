"use client";

import { Download, Loader } from "lucide-react";
import { useState } from "react";
import { exportDailyPartaCsvAction } from "@/lib/actions/exports";

type ExportResult = { data: string; filename: string; mimeType: string } | { error: string };

type Props = {
  monthYear?: string;
  label?: string;
  className?: string;
};

export function ExportCsvButton({ monthYear, label = "Export CSV", className }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const result: ExportResult = await exportDailyPartaCsvAction(monthYear);
      if ("error" in result) return;
      const blob = new Blob([new TextEncoder().encode(result.data)], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${className ?? ""} transition-all active:scale-[0.985] disabled:opacity-60`}
    >
      {loading ? <Loader size={14} className="mr-1 inline animate-spin" /> : <Download size={14} className="mr-1 inline" />}
      {loading ? "CSV export ho raha hai..." : label}
    </button>
  );
}
