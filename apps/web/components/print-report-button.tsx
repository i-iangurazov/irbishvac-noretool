"use client";

export function PrintReportButton() {
  return (
    <button
      className="performance-report-toolbar__print"
      type="button"
      onClick={() => window.print()}
    >
      Print / save PDF
    </button>
  );
}
