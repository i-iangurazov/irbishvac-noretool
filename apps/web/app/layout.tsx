import { ClerkProvider, Show, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardTvRuntime } from "../components/dashboard-tv-runtime";
import { getBrandLogoUrl } from "../lib/assets";
import "./globals.css";

const brandLogoUrl = getBrandLogoUrl();

export const metadata: Metadata = {
  title: "IRBIS HVAC Dashboards",
  description: "Retool replacement dashboards for IRBIS HVAC",
  ...(brandLogoUrl ? { icons: { icon: brandLogoUrl } } : {}),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reportRenderMode = process.env.PERFORMANCE_REPORT_RENDER_MODE === "true";
  return (
    <html lang="en">
      <body data-vw-app="true">
        {reportRenderMode ? children : <ClerkProvider dynamic>
          <Suspense fallback={null}>
            <DashboardTvRuntime />
          </Suspense>
          <Show when="signed-in">
            <div
              className="irbis-account-control"
              aria-label="Account settings"
            >
              <UserButton />
            </div>
          </Show>
          {children}
        </ClerkProvider>}
      </body>
    </html>
  );
}
