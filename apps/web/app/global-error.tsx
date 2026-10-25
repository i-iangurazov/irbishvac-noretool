"use client";
import React from "react";
import { DashboardErrorState } from "../components/dashboard-error-state";
export default function GlobalDashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <DashboardErrorState reset={reset} global />
      </body>
    </html>
  );
}
