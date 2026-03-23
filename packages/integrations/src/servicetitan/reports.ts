import { getConfig } from "@irbis/config";
import {
  addDays,
  getDateParts,
  getPresetRange,
  toBusinessDateString,
  type DatePreset
} from "@irbis/utils";

export type ReportFamilyKey =
  | "technicians"
  | "installers"
  | "advisors"
  | "callCenterByCsr"
  | "callCenterSummary"
  | "leadGeneration"
  | "campaigns"
  | "trending"
  | "marketing"
  | "capacity"
  | "jobCostingSummary"
  | "revenueGoals"
  | "salesToday"
  | "salesYesterday"
  | "salesMonthlyPace"
  | "revenueMonthlyPace"
  | "bookingRate";

export type ReportParameter = {
  name: string;
  value: string | number | boolean | number[];
};

export type ReportRequestContext = {
  from?: string;
  to?: string;
  preset?: DatePreset;
  referenceDate?: Date;
  businessUnitIds?: number[];
  timezone?: string;
  defaultBusinessUnits?: Partial<
    Record<NonNullable<ServiceTitanReportDefinition["businessUnitGroup"]>, number[]>
  >;
};

export type ServiceTitanReportDefinition = {
  family: ReportFamilyKey;
  category: string;
  reportId: string;
  legacyTableName: string;
  defaultPreset: DatePreset;
  businessUnitGroup?: "installers" | "advisors" | "company";
  extraParameters?: Array<{ name: string; value: string | number | boolean }>;
  rangeResolver?: (input: {
    preset: DatePreset;
    context?: ReportRequestContext;
    timeZone: string;
    referenceDate: Date;
  }) => {
    from: string;
    to: string;
  };
};

export type ResolvedReportRequest = {
  preset: DatePreset;
  range: {
    from: string;
    to: string;
  };
  parameters: ReportParameter[];
  businessUnitIds?: number[];
  requestHash: string;
};

function toReferenceDate(dateString: string | undefined, fallback: Date) {
  return dateString ? new Date(`${dateString}T12:00:00.000Z`) : fallback;
}

function padTwo(value: number) {
  return String(value).padStart(2, "0");
}

function buildTodayRange(referenceDate: Date, timeZone: string) {
  const today = toBusinessDateString(referenceDate, timeZone);
  return {
    from: today,
    to: today
  };
}

function buildYesterdayRange(referenceDate: Date, timeZone: string) {
  const yesterday = toBusinessDateString(addDays(referenceDate, -1), timeZone);
  return {
    from: yesterday,
    to: yesterday
  };
}

function buildMonthFromSecondRange(
  referenceDate: Date,
  timeZone: string,
  explicitTo?: string,
) {
  const to = explicitTo ?? toBusinessDateString(referenceDate, timeZone);
  const { year, month } = getDateParts(toReferenceDate(to, referenceDate), timeZone);

  return {
    from: `${year}-${padTwo(month)}-02`,
    to
  };
}

function buildYearFromSecondRange(referenceDate: Date, timeZone: string) {
  const to = toBusinessDateString(referenceDate, timeZone);
  const { year } = getDateParts(referenceDate, timeZone);

  return {
    from: `${year}-01-02`,
    to
  };
}

export function getServiceTitanReportDefinitions(): Record<
  ReportFamilyKey,
  ServiceTitanReportDefinition
> {
  const config = getConfig();

  return {
    technicians: {
      family: "technicians",
      category: config.serviceTitan.reports.technicians.category,
      reportId: config.serviceTitan.reports.technicians.reportId,
      legacyTableName: "st_technician",
      defaultPreset: "mtd"
    },
    installers: {
      family: "installers",
      category: config.serviceTitan.reports.installers.category,
      reportId: config.serviceTitan.reports.installers.reportId,
      legacyTableName: "st_installer",
      defaultPreset: "mtd",
      businessUnitGroup: "installers"
    },
    advisors: {
      family: "advisors",
      category: config.serviceTitan.reports.advisors.category,
      reportId: config.serviceTitan.reports.advisors.reportId,
      legacyTableName: "st_advisors",
      defaultPreset: "mtd",
      businessUnitGroup: "advisors"
    },
    callCenterByCsr: {
      family: "callCenterByCsr",
      category: "operations",
      reportId: config.serviceTitan.reports.callCenterPerformance.reportId,
      legacyTableName: "st_per_summary",
      defaultPreset: "mtd"
    },
    callCenterSummary: {
      family: "callCenterSummary",
      category: "operations",
      reportId: config.serviceTitan.reports.callCenterPerformance.reportId,
      legacyTableName: "st_per_csr",
      defaultPreset: "mtd"
    },
    leadGeneration: {
      family: "leadGeneration",
      category: config.serviceTitan.reports.leads.category,
      reportId: config.serviceTitan.reports.leads.reportId,
      legacyTableName: "st_lead",
      defaultPreset: "mtd",
      businessUnitGroup: "company"
    },
    campaigns: {
      family: "campaigns",
      category: config.serviceTitan.reports.campaigns.category,
      reportId: config.serviceTitan.reports.campaigns.reportId,
      legacyTableName: "st_campaign",
      defaultPreset: "mtd"
    },
    trending: {
      family: "trending",
      category: config.serviceTitan.reports.trending.category,
      reportId: config.serviceTitan.reports.trending.reportId,
      legacyTableName: "st_trending",
      defaultPreset: "ytd",
      extraParameters: [{ name: "Period", value: "Month" }]
    },
    marketing: {
      family: "marketing",
      category: config.serviceTitan.reports.campaigns.category,
      reportId: config.serviceTitan.reports.campaigns.reportId,
      legacyTableName: "st_marketing",
      defaultPreset: "mtd"
    },
    capacity: {
      family: "capacity",
      category: config.serviceTitan.reports.capacity.category,
      reportId: config.serviceTitan.reports.capacity.reportId,
      legacyTableName: "st_capacity",
      defaultPreset: "today",
      businessUnitGroup: "company",
      rangeResolver: ({ referenceDate, timeZone }) => buildTodayRange(referenceDate, timeZone)
    },
    jobCostingSummary: {
      family: "jobCostingSummary",
      category: config.serviceTitan.reports.jobCostingSummary.category,
      reportId: config.serviceTitan.reports.jobCostingSummary.reportId,
      legacyTableName: "st_job_costing_summary",
      defaultPreset: "mtd",
      extraParameters: [{ name: "DateType", value: 1 }],
      rangeResolver: ({ context, referenceDate, timeZone }) =>
        buildMonthFromSecondRange(referenceDate, timeZone, context?.to)
    },
    revenueGoals: {
      family: "revenueGoals",
      category: config.serviceTitan.reports.revenueGoals.category,
      reportId: config.serviceTitan.reports.revenueGoals.reportId,
      legacyTableName: "st_revenue",
      defaultPreset: "ytd",
      businessUnitGroup: "company",
      rangeResolver: ({ referenceDate, timeZone }) => buildYearFromSecondRange(referenceDate, timeZone)
    },
    salesToday: {
      family: "salesToday",
      category: config.serviceTitan.reports.sales.category,
      reportId: config.serviceTitan.reports.sales.reportId,
      legacyTableName: "st_sales",
      defaultPreset: "today",
      rangeResolver: ({ referenceDate, timeZone }) => buildTodayRange(referenceDate, timeZone)
    },
    salesYesterday: {
      family: "salesYesterday",
      category: config.serviceTitan.reports.sales.category,
      reportId: config.serviceTitan.reports.sales.reportId,
      legacyTableName: "st_sales_yes",
      defaultPreset: "yesterday",
      rangeResolver: ({ referenceDate, timeZone }) => buildYesterdayRange(referenceDate, timeZone)
    },
    salesMonthlyPace: {
      family: "salesMonthlyPace",
      category: config.serviceTitan.reports.sales.category,
      reportId: config.serviceTitan.reports.sales.reportId,
      legacyTableName: "st_sales_monthly_pace",
      defaultPreset: "mtd",
      businessUnitGroup: "company",
      rangeResolver: ({ context, referenceDate, timeZone }) =>
        buildMonthFromSecondRange(referenceDate, timeZone, context?.to)
    },
    revenueMonthlyPace: {
      family: "revenueMonthlyPace",
      category: config.serviceTitan.reports.revenueMonthlyPace.category,
      reportId: config.serviceTitan.reports.revenueMonthlyPace.reportId,
      legacyTableName: "st_revenue_monthly_pace",
      defaultPreset: "mtd",
      businessUnitGroup: "company",
      rangeResolver: ({ context, referenceDate, timeZone }) =>
        buildMonthFromSecondRange(referenceDate, timeZone, context?.to)
    },
    bookingRate: {
      family: "bookingRate",
      category: "marketing",
      reportId: config.serviceTitan.reports.bookingRate.reportId,
      legacyTableName: "st_booking_rate",
      defaultPreset: "today",
      rangeResolver: ({ referenceDate, timeZone }) => buildTodayRange(referenceDate, timeZone)
    }
  };
}

export function resolveReportRequest(
  definition: ServiceTitanReportDefinition,
  context?: ReportRequestContext,
): ResolvedReportRequest {
  const preset = context?.preset ?? definition.defaultPreset;
  const timeZone = context?.timezone ?? "America/Los_Angeles";
  const referenceDate = context?.referenceDate ?? new Date();
  const presetRange = getPresetRange(preset, timeZone, referenceDate);
  const range = definition.rangeResolver
    ? definition.rangeResolver({
        preset,
        timeZone,
        referenceDate,
        ...(context ? { context } : {})
      })
    : {
        ...presetRange,
        from: context?.from ?? presetRange.from,
        to: context?.to ?? presetRange.to
      };

  const parameters: ReportParameter[] = [
    { name: "From", value: range.from },
    { name: "To", value: range.to }
  ];

  const businessUnits =
    context?.businessUnitIds ??
    (definition.businessUnitGroup
      ? context?.defaultBusinessUnits?.[definition.businessUnitGroup] ??
        getConfig().serviceTitan.businessUnits[definition.businessUnitGroup]
      : undefined);

  const normalizedBusinessUnits =
    businessUnits && businessUnits.length > 0
      ? [...businessUnits].sort((left, right) => left - right)
      : undefined;

  if (normalizedBusinessUnits && normalizedBusinessUnits.length > 0) {
    parameters.push({
      name: "BusinessUnitIds",
      value: normalizedBusinessUnits
    });
  }

  if (definition.extraParameters) {
    parameters.push(...definition.extraParameters);
  }

  parameters.push({
    name: "IncludeInactive",
    value: "false"
  });

  return {
    preset,
    range,
    parameters,
    ...(normalizedBusinessUnits ? { businessUnitIds: normalizedBusinessUnits } : {}),
    requestHash: JSON.stringify([definition.family, parameters])
  };
}

export function buildReportParameters(
  definition: ServiceTitanReportDefinition,
  context?: ReportRequestContext,
): ReportParameter[] {
  return resolveReportRequest(definition, context).parameters;
}
