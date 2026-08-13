import type { Metadata } from "next";
import { getBrandLogoUrl } from "../lib/assets";
import "./globals.css";

const brandLogoUrl = getBrandLogoUrl();

export const metadata: Metadata = {
  title: "IRBIS HVAC Dashboards",
  description: "Retool replacement dashboards for IRBIS HVAC",
  ...(brandLogoUrl ? { icons: { icon: brandLogoUrl } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-vw-app="true">{children}</body>
    </html>
  );
}
