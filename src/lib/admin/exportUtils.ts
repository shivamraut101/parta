/**
 * Export utilities for admin data
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type CsvValue = string | number | boolean | null | undefined | Date;
export type ExportRow = Record<string, CsvValue>;

/**
 * Convert data to CSV format
 */
export function toCSV(data: ExportRow[], columns?: string[]): string {
  if (data.length === 0) {
    return "";
  }

  const resolvedColumns = columns && columns.length > 0 ? columns : Object.keys(data[0]);

  // Header row
  const header = resolvedColumns.map((col) => `"${col}"`).join(",");

  // Data rows
  const rows = data.map((row) => {
    return resolvedColumns
      .map((col) => {
        const value = row[col];
        // Escape quotes and wrap in quotes if contains comma or quote
        const stringValue = String(value ?? "");
        if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return `"${stringValue}"`;
      })
      .join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Create a PDF report from rows
 */
export async function generatePDFBuffer(
  title: string,
  data: ExportRow[],
  columns?: string[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const resolvedColumns = columns && columns.length > 0 ? columns : Object.keys(data[0] ?? {});
  const page = pdf.addPage([842, 595]);
  const { height } = page.getSize();
  let y = height - 40;

  page.drawText(title, {
    x: 40,
    y,
    size: 16,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 18;

  page.drawText(`Generated: ${new Date().toLocaleString("en-IN")}`, {
    x: 40,
    y,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 20;

  const headerLine = resolvedColumns.join(" | ");
  page.drawText(headerLine.slice(0, 180), {
    x: 40,
    y,
    size: 9,
    font: bold,
    color: rgb(0, 0, 0),
  });
  y -= 14;

  const maxRows = 34;
  const rows = data.slice(0, maxRows);
  for (const row of rows) {
    const line = resolvedColumns.map((c) => String(row[c] ?? "")).join(" | ");
    page.drawText(line.slice(0, 180), {
      x: 40,
      y,
      size: 9,
      font,
      color: rgb(0.12, 0.12, 0.12),
    });
    y -= 13;
    if (y < 30) break;
  }

  if (data.length > maxRows) {
    page.drawText(`Showing ${maxRows} of ${data.length} rows`, {
      x: 40,
      y: 20,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  }

  return pdf.save();
}
