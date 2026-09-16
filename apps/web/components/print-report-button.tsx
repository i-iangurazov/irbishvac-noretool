"use client";

import type { ReactNode } from "react";

export function PrintReportButton({ children }: { children?: ReactNode } = {}) {
  return (
    <button
      className="performance-report-toolbar__print"
      type="button"
      onClick={() => window.print()}
    >
      {children ?? "Print / save PDF"}
    </button>
  );
}
