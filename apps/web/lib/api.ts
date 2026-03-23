import { headers } from "next/headers";

export type DashboardNavItem = {
  href: string;
  label: string;
  section: string;
  shortLabel: string;
};

export const navItems: DashboardNavItem[] = [
  {
    href: "/company-wide",
    label: "Company-wide",
    shortLabel: "CW",
    section: "Overview"
  },
  {
    href: "/technicians",
    label: "Technicians",
    shortLabel: "TC",
    section: "Field Performance"
  },
  {
    href: "/installers",
    label: "Installers",
    shortLabel: "IN",
    section: "Field Performance"
  },
  {
    href: "/advisors",
    label: "Advisors",
    shortLabel: "AD",
    section: "Field Performance"
  },
  {
    href: "/call-center/summary",
    label: "Call Center Summary",
    shortLabel: "CS",
    section: "Call Center"
  },
  {
    href: "/call-center/by-csr",
    label: "Call Center By CSR",
    shortLabel: "CR",
    section: "Call Center"
  },
  {
    href: "/leads",
    label: "Lead Generation",
    shortLabel: "LG",
    section: "Demand"
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    shortLabel: "CM",
    section: "Demand"
  }
];

async function getWebOrigin() {
  if (typeof window !== "undefined") {
    return "";
  }

  try {
    const requestHeaders = await headers();
    const host =
      requestHeaders.get("x-forwarded-host") ??
      requestHeaders.get("host");

    if (host) {
      const protocol =
        requestHeaders.get("x-forwarded-proto") ??
        (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

      return `${protocol}://${host}`;
    }
  } catch {
    // Ignore missing request context and use environment fallback instead.
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export class DashboardApiError extends Error {
  readonly status: number;

  constructor(path: string, status: number) {
    super(`Failed to fetch ${path}: ${status}`);
    this.name = "DashboardApiError";
    this.status = status;
  }
}

export async function fetchApi<T>(path: string): Promise<T> {
  const baseUrl = await getWebOrigin();
  const response = await fetch(`${baseUrl}/api${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new DashboardApiError(path, response.status);
  }

  return response.json() as Promise<T>;
}
