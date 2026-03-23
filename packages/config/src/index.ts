import { getEnv } from "./env";

export type { AppEnv } from "./env";

export type ReportConfig = {
  tenantId: string;
  reportId: string;
  category: string;
};

export type AppConfig = ReturnType<typeof getConfig>;

export function resolveBooleanFlag(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  return value === "true";
}

export function getConfig() {
  const env = getEnv();

  return {
    env,
    app: {
      timezone: env.APP_TIMEZONE,
      name: env.NEXT_PUBLIC_APP_NAME,
      apiBaseUrl: env.API_BASE_URL ?? env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
      logLevel: env.LOG_LEVEL,
      sentryDsn: env.SENTRY_DSN || null
    },
    dashboard: {
      fallbacksEnabled: resolveBooleanFlag(
        env.ENABLE_DASHBOARD_FALLBACKS,
        env.NODE_ENV !== "production",
      )
    },
    auth: {
      cookieSecret: env.AUTH_COOKIE_SECRET,
      defaultAdminEmail: env.AUTH_DEFAULT_ADMIN_EMAIL,
      defaultAdminPassword: env.AUTH_DEFAULT_ADMIN_PASSWORD
    },
    database: {
      url: env.DATABASE_URL
    },
    retoolDatabase: {
      url: env.RETOOL_DATABASE_URL || null
    },
    redis: {
      url: env.REDIS_URL
    },
    worker: {
      bootstrapOnStart: resolveBooleanFlag(
        env.WORKER_BOOTSTRAP_ON_START,
        env.NODE_ENV === "production",
      )
    },
    serviceTitan: {
      tenantId: env.SERVICETITAN_TENANT_ID,
      clientId: env.SERVICETITAN_CLIENT_ID,
      clientSecret: env.SERVICETITAN_CLIENT_SECRET,
      appKey: env.SERVICETITAN_APP_KEY,
      reports: {
        technicians: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: "technician",
          reportId: env.ST_REPORT_TECHNICIANS
        },
        installers: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: "technician-dashboard",
          reportId: env.ST_REPORT_INSTALLERS
        },
        advisors: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: "operations",
          reportId: env.ST_REPORT_ADVISORS
        },
        callCenterSource: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: "operations",
          reportId: env.ST_REPORT_CALL_CENTER_SOURCE
        },
        callCenterPerformance: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: "operations",
          reportId: env.ST_REPORT_CALL_CENTER_PERFORMANCE
        },
        leads: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: "business-unit-dashboard",
          reportId: env.ST_REPORT_LEADS
        },
        campaigns: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: "marketing",
          reportId: env.ST_REPORT_CAMPAIGNS
        },
        bookingRate: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: "marketing",
          reportId: env.ST_REPORT_BOOKING_RATE
        },
        trending: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: "other",
          reportId: env.ST_REPORT_TRENDING
        },
        sales: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: "business-unit-dashboard",
          reportId: env.ST_REPORT_SALES
        },
        revenueMonthlyPace: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: "operations",
          reportId: env.ST_REPORT_REVENUE_MONTHLY_PACE
        },
        capacity: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: env.ST_REPORT_CAPACITY_CATEGORY || "UNRESOLVED",
          reportId: env.ST_REPORT_CAPACITY_ID || "UNRESOLVED"
        },
        jobCostingSummary: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: env.ST_REPORT_JOB_COSTING_CATEGORY || "UNRESOLVED",
          reportId: env.ST_REPORT_JOB_COSTING_ID || "UNRESOLVED"
        },
        revenueGoals: {
          tenantId: env.SERVICETITAN_TENANT_ID,
          category: env.ST_REPORT_REVENUE_GOALS_CATEGORY || "UNRESOLVED",
          reportId: env.ST_REPORT_REVENUE_GOALS_ID || "UNRESOLVED"
        }
      },
      businessUnits: {
        installers: env.ST_BU_INSTALLERS,
        advisors: env.ST_BU_ADVISORS,
        company: env.ST_BU_COMPANY
      }
    },
    assets: {
      publicBaseUrl: env.R2_PUBLIC_BASE_URL || null,
      technicianPhotoExtension: env.R2_TECHNICIAN_PHOTO_EXT,
      technicianPhotoNameStyle: env.R2_TECHNICIAN_PHOTO_NAME_STYLE,
      logoKey: env.R2_LOGO_KEY || null,
      technicianPhotoFolder: env.ASSET_FOLDER_TECHNICIAN_PHOTOS,
      logoFolder: env.ASSET_FOLDER_LOGOS
    }
  };
}
