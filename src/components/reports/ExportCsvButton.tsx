"use client";

import { Download, Loader } from "lucide-react";
import { useState } from "react";

type ExportResult = { data: string; filename: string; mimeType: string } | { error: string };

type Props = {
  action: () => Promise<ExportResult>;
  label?: string;
  className?: string;
};

export function ExportCsvButton({ action, label = "Export CSV", className }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const result = await action();
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
      className={className}
    >
      {loading ? <Loader size={14} className="inline animate-spin mr-1" /> : <Download size={14} className="inline mr-1" />}
      {loading ? "Exporting..." : label}
    </button>
  );
}
