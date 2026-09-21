/**
 * Export Utilities for Excel and PDF
 * Zero-dependency, client-side export for OrderFlow tables.
 */

interface ExportTableData {
  title: string;
  subtitle?: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  orientation?: "landscape" | "portrait";
}

/**
 * Escapes a cell value for CSV / Excel.
 * Treats numbers, strings, and handles commas, quotes, and newlines.
 */
function escapeCsvValue(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  // If string contains comma, double-quote, or newline, escape it with double-quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Exports data as an Excel-compatible CSV file with UTF-8 BOM.
 * Opens seamlessly in Microsoft Excel, Google Sheets, and LibreOffice.
 */
export function exportToExcel(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map(escapeCsvValue).join(","));

  // Data rows
  for (const row of rows) {
    csvRows.push(row.map(escapeCsvValue).join(","));
  }

  const csvContent = "\uFEFF" + csvRows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filename.replace(/\s+/g, "_")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports data as a beautifully formatted PDF report via the browser's native Print dialog.
 * Opens a print-optimized window formatted with crisp Excel table borders, headers, and metadata.
 */
export function exportToPdf({
  title,
  subtitle,
  filename,
  headers,
  rows,
  orientation = "landscape",
}: ExportTableData): void {
  const printWindow = window.open("", "_blank", "width=1200,height=800");

  if (!printWindow) {
    alert("Please allow pop-ups to generate and download the PDF report.");
    return;
  }

  const currentDate = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const headersHtml = headers
    .map(
      (h) =>
        `<th style="border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #1e293b; padding: 6px 8px; font-size: 11px; font-weight: 700; text-align: left; text-transform: uppercase;">${h}</th>`
    )
    .join("");

  const rowsHtml = rows
    .map(
      (row, rIdx) => `
      <tr style="background-color: ${rIdx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
        ${row
          .map(
            (cell, cIdx) => `
          <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 11px; color: #334155; vertical-align: middle; ${
            cIdx === 0 ? "text-align: center; font-weight: 600;" : ""
          }">
            ${cell !== undefined && cell !== null ? String(cell) : ""}
          </td>
        `
          )
          .join("")}
      </tr>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${title} - ${filename}</title>
      <style>
        @page {
          size: ${orientation};
          margin: 10mm;
        }
        * {
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        body {
          margin: 0;
          padding: 16px;
          color: #0f172a;
          background: #ffffff;
        }
        .header-bar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 12px;
          border-bottom: 2px solid #0f766e;
          margin-bottom: 16px;
        }
        .brand-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f766e;
          letter-spacing: -0.5px;
        }
        .report-title {
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
          margin-top: 2px;
        }
        .report-sub {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .meta-info {
          text-align: right;
          font-size: 11px;
          color: #64748b;
        }
        .meta-info strong {
          color: #0f172a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: auto;
          margin-top: 10px;
        }
        .toolbar {
          margin-bottom: 14px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .btn {
          background-color: #0f766e;
          color: white;
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn:hover {
          background-color: #115e59;
        }
        .btn-outline {
          background: white;
          color: #334155;
          border: 1px solid #cbd5e1;
        }
        .btn-outline:hover {
          background: #f8fafc;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="toolbar no-print">
        <button class="btn" onclick="window.print()">Print / Save as PDF</button>
        <button class="btn btn-outline" onclick="window.close()">Close</button>
        <span style="font-size: 11px; color: #64748b; margin-left: 8px;">
          Tip: In the print dialog, select destination <strong>"Save as PDF"</strong>.
        </span>
      </div>

      <div class="header-bar">
        <div>
          <div class="brand-title">OrderFlow</div>
          <div class="report-title">${title}</div>
          ${subtitle ? `<div class="report-sub">${subtitle}</div>` : ""}
        </div>
        <div class="meta-info">
          <div>Generated: <strong>${currentDate}</strong></div>
          <div>Total Records: <strong>${rows.length}</strong></div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            ${headersHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <script>
        window.addEventListener('load', () => {
          setTimeout(() => {
            window.print();
          }, 400);
        });
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
