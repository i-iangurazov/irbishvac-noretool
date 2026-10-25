import { auth } from "@clerk/nextjs/server";
import { getConfig } from "@irbis/config";
import { isAllowedDashboardIdentity } from "./dashboard-identity";

export type DashboardNavItem = {
  id: string;
  href: string;
  label: string;
  section: string;
  shortLabel: string;
};

export const navItems: DashboardNavItem[] = [
  {
    id: "kitchen",
    href: "/kitchen",
    label: "People & Company News",
    shortLabel: "PN",
    section: "Company",
  },
  {
    id: "company-wide",
    href: "/company-wide",
    label: "Company-wide",
    shortLabel: "CW",
    section: "Overview",
  },
  {
    id: "performance",
    href: "/performance",
    label: "Performance Coaching",
    shortLabel: "PC",
    section: "Coaching",
  },
  {
    id: "technicians",
    href: "/technicians",
    label: "HVAC Service",
    shortLabel: "HS",
    section: "Field Performance",
  },
  {
    id: "plumbing",
    href: "/plumbing",
    label: "Plumbing Service",
    shortLabel: "PS",
    section: "Field Performance",
  },
  {
    id: "electrical",
    href: "/electrical",
    label: "Electrical Service",
    shortLabel: "ES",
    section: "Field Performance",
  },
  {
    id: "installers",
    href: "/installers",
    label: "HVAC Install",
    shortLabel: "HI",
    section: "Field Performance",
  },
  {
    id: "plumbing-install",
    href: "/plumbing-install",
    label: "Plumbing Install",
    shortLabel: "PI",
    section: "Field Performance",
  },
  {
    id: "electrical-install",
    href: "/electrical-install",
    label: "Electrical Install",
    shortLabel: "EI",
    section: "Field Performance",
  },
  {
    id: "advisors",
    href: "/advisors",
    label: "HVAC Sales",
    shortLabel: "AD",
    section: "Field Performance",
  },
  {
    id: "call-center-summary",
    href: "/call-center/summary",
    label: "Call Center Summary",
    shortLabel: "CS",
    section: "Call Center",
  },
  {
    id: "call-center-by-csr",
    href: "/call-center/by-csr",
    label: "Call Center By CSR",
    shortLabel: "CR",
    section: "Call Center",
  },
  {
    id: "memberships",
    href: "/memberships",
    label: "Membership Performance",
    shortLabel: "MP",
    section: "Call Center",
  },
  {
    id: "leads",
    href: "/leads",
    label: "Lead Generation",
    shortLabel: "LG",
    section: "Demand",
  },
  {
    id: "marketing",
    href: "/marketing",
    label: "Marketing",
    shortLabel: "MK",
    section: "Demand",
  },
  {
    id: "ops",
    href: "/ops",
    label: "Operations Docs",
    shortLabel: "OP",
    section: "Operations",
  },
];

export class DashboardApiError extends Error {
  readonly status: number;

  constructor(path: string, status: number) {
    super(`Failed to fetch ${path}: ${status}`);
    this.name = "DashboardApiError";
    this.status = status;
  }
}

export async function fetchApi<T>(path: string): Promise<T> {
  // Use the identity already verified for this Server Component request. A
  // self-fetch through Clerk middleware re-verifies an aging browser cookie and
  // can turn a token-refresh redirect into an HTML response during rotation.
  const identity = await auth();
  if (
    !isAllowedDashboardIdentity({
      isAuthenticated: identity.isAuthenticated,
      userId: identity.userId,
      primaryEmail: identity.sessionClaims?.primaryEmail,
    })
  )
    throw new DashboardApiError(path, 401);
  if (!path.startsWith("/dashboard/")) throw new DashboardApiError(path, 400);

  const baseUrl =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3001";
  let response: Response;
  try {
    response = await fetch(new URL(`/api${path}`, baseUrl), {
      cache: "no-store",
      redirect: "manual",
      headers: {
        accept: "application/json",
        "x-dashboard-access-token": getConfig().auth.cookieSecret,
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const timedOut = Boolean(
      error &&
      typeof error === "object" &&
      "name" in error &&
      /timeout|abort/i.test(String(error.name)),
    );
    throw new DashboardApiError(path, timedOut ? 504 : 503);
  }
  if (!response.ok) throw new DashboardApiError(path, response.status);
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new DashboardApiError(path, 502);
  try {
    return (await response.json()) as T;
  } catch {
    throw new DashboardApiError(path, 502);
  }
}
