"use client";
import React from "react";
import { DashboardErrorState } from "../components/dashboard-error-state";
export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardErrorState reset={reset} />;
}
