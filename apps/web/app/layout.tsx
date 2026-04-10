import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IRBIS HVAC Dashboards",
  description: "Retool replacement dashboards for IRBIS HVAC"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-vw-app="true">{children}</body>
    </html>
  );
}
