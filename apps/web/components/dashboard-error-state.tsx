"use client";
import React, { useEffect, useState } from "react";
import { DashboardAutoRefreshRuntime } from "@irbis/ui";
import { requestDashboardRecovery } from "../../../packages/ui/src/components/dashboard-recovery";
export function DashboardErrorState({
  reset,
  global = false,
}: {
  reset: () => void;
  global?: boolean;
}) {
  const [tv, setTv] = useState(false);
  useEffect(() => {
    const display =
      new URLSearchParams(window.location.search).get("tv") === "1";
    setTv(display);
    if (!display) return;
    const timer = window.setTimeout(() => requestDashboardRecovery(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <>
      {global && <DashboardAutoRefreshRuntime enabled={tv} />}
      <main
        data-dashboard-error="true"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 32,
          background: "#f3f8fb",
          color: "#003644",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <section
          style={{
            maxWidth: 620,
            padding: 40,
            borderRadius: 20,
            background: "white",
            textAlign: "center",
          }}
        >
          <img
            src="/kitchen/irbis-logo.png"
            alt="IRBIS"
            style={{ width: 160, margin: "0 auto 28px", objectFit: "contain" }}
          />
          <h1 style={{ fontSize: 30, margin: "0 0 16px" }}>
            {tv
              ? "Reconnecting to your dashboard"
              : "This dashboard is temporarily unavailable"}
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "#4a6670" }}>
            {tv
              ? "Your display will retry automatically when the connection is available."
              : "Please try again in a moment."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "14px 24px",
              marginTop: 20,
              border: 0,
              borderRadius: 10,
              background: "#003644",
              color: "white",
              font: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </section>
      </main>
    </>
  );
}
