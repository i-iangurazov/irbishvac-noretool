import {
  resolveTabularReport,
  toNumber,
  toRatio,
  type NormalizedRow,
  type ServiceTitanField
} from "../shared/report";

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readValue(
  row: NormalizedRow,
  fields: ServiceTitanField[],
  candidates: string[],
) {
  const normalizedCandidates = candidates.map(normalizeKey);

  for (const [key, value] of Object.entries(row)) {
    if (normalizedCandidates.includes(normalizeKey(key))) {
      return value;
    }
  }

  for (const field of fields) {
    if (
      normalizedCandidates.includes(normalizeKey(field.name)) ||
      (field.label && normalizedCandidates.includes(normalizeKey(field.label)))
    ) {
      return row[field.name];
    }
  }

  return null;
}

function readText(row: NormalizedRow, fields: ServiceTitanField[], candidates: string[]) {
  const value = readValue(row, fields, candidates);
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function readNullableNumber(
  row: NormalizedRow,
  fields: ServiceTitanField[],
  candidates: string[],
) {
  const value = readValue(row, fields, candidates);
  return value == null || value === "" ? null : toNumber(value);
}

function normalizeIdentity(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export type FieldProTechnicianActivityRow = {
  name: string;
  email: string | null;
  businessUnit: string | null;
  completedJobs: number;
  completedRevenue: number;
  closedOpportunities: number;
  team: string | null;
  totalRecordings: number | null;
  qualityRecordings: number | null;
  qualityRecordingRate: number | null;
  recordingCoverage: number | null;
};

export type FieldProTechnicianActivityDashboard = {
  rows: FieldProTechnicianActivityRow[];
  totals: {
    completedJobs: number;
    totalRecordings: number;
    qualityRecordings: number;
  };
  snapshotTime: string | null;
};

export type FieldProJobRecordingRow = {
  jobId: string;
  jobNumber: string | null;
  jobType: string | null;
  status: string | null;
  opportunity: boolean | null;
  jobTotal: number | null;
  completionDate: string | null;
  assignedTechnicians: string | null;
  recordingJobId: string | null;
  recordingTitle: string | null;
  technician: string;
  durationMinutes: number | null;
};

export type FieldProJobRecordingsDashboard = {
  rows: FieldProJobRecordingRow[];
  snapshotTime: string | null;
};

export type FieldProTechnicianPerformanceRow = FieldProTechnicianActivityRow & {
  averageRecordingMinutes: number | null;
  longestRecordingMinutes: number | null;
  recordedJobs: FieldProJobRecordingRow[];
};

export type FieldProPerformanceDashboard = {
  rows: FieldProTechnicianPerformanceRow[];
  totals: FieldProTechnicianActivityDashboard["totals"];
  snapshotTime: string | null;
};

export function buildFieldProTechnicianActivity(
  input: unknown,
): FieldProTechnicianActivityDashboard {
  const report = resolveTabularReport(input);
  const rows = report.rows
    .map((row): FieldProTechnicianActivityRow | null => {
      const name = readText(row, report.fields, [
        "Name",
        "Name (Technician Performance)"
      ]);
      if (!name) {
        return null;
      }

      const completedJobs =
        readNullableNumber(row, report.fields, [
          "CompletedJobs",
          "Completed Jobs (Technician Performance)"
        ]) ?? 0;
      const totalRecordings = readNullableNumber(row, report.fields, [
        "TotalRecordings",
        "Total Recordings (Field Pro: Technician Recording Performance)"
      ]);
      const qualityRecordingRateValue = readValue(row, report.fields, [
        "QualityRecordingsRate",
        "Quality Recordings Rate (Field Pro: Technician Recording Performance)"
      ]);

      return {
        name,
        email: readText(row, report.fields, [
          "Email",
          "Email (Technician Performance)"
        ]),
        businessUnit: readText(row, report.fields, [
          "TechnicianBusinessUnit",
          "Technician Business Unit (Technician Performance)"
        ]),
        completedJobs,
        completedRevenue:
          readNullableNumber(row, report.fields, [
            "CompletedRevenue",
            "Completed Revenue (Technician Performance)"
          ]) ?? 0,
        closedOpportunities:
          readNullableNumber(row, report.fields, [
            "ClosedOpportunities",
            "Closed Opportunities (Technician Performance)"
          ]) ?? 0,
        team: readText(row, report.fields, [
          "Team",
          "Team (Field Pro: Technician Recording Performance)"
        ]),
        totalRecordings,
        qualityRecordings: readNullableNumber(row, report.fields, [
          "QualityRecordings",
          "FieldProTechnicianRecordingPerformance_Quality_Recordings",
          "Quality Recordings (>10 min)",
          "Quality Recordings (>10 min) (Field Pro: Technician Recording Performance)"
        ]),
        qualityRecordingRate:
          qualityRecordingRateValue == null || qualityRecordingRateValue === ""
            ? null
            : toRatio(qualityRecordingRateValue),
        recordingCoverage:
          totalRecordings == null || completedJobs <= 0
            ? null
            : Math.min(1, totalRecordings / completedJobs)
      };
    })
    .filter((row): row is FieldProTechnicianActivityRow => row !== null);

  return {
    rows,
    totals: {
      completedJobs: rows.reduce((total, row) => total + row.completedJobs, 0),
      totalRecordings: rows.reduce((total, row) => total + (row.totalRecordings ?? 0), 0),
      qualityRecordings: rows.reduce(
        (total, row) => total + (row.qualityRecordings ?? 0),
        0,
      )
    },
    snapshotTime: report.snapshotTime
  };
}

export function buildFieldProJobRecordings(input: unknown): FieldProJobRecordingsDashboard {
  const report = resolveTabularReport(input);
  const rows = report.rows
    .map((row): FieldProJobRecordingRow | null => {
      const technician = readText(row, report.fields, [
        "Technician",
        "Technician (Field Pro: Job Recordings)"
      ]);
      const jobId = readText(row, report.fields, [
        "Jobs_JobId",
        "JobId",
        "Job ID (Jobs)"
      ]);

      if (!technician || !jobId) {
        return null;
      }

      const opportunityValue = readValue(row, report.fields, [
        "Opportunity",
        "Opportunity (Jobs)"
      ]);

      return {
        jobId,
        jobNumber: readText(row, report.fields, [
          "Jobs_JobNumber",
          "JobNumber",
          "Job #",
          "Job # (Jobs)"
        ]),
        jobType: readText(row, report.fields, ["JobType", "Job Type (Jobs)"]),
        status: readText(row, report.fields, ["Status", "Status (Jobs)"]),
        opportunity:
          opportunityValue == null || opportunityValue === ""
            ? null
            : opportunityValue === true || opportunityValue === 1 || opportunityValue === "1",
        jobTotal: readNullableNumber(row, report.fields, ["JobsTotal", "Jobs Total (Jobs)"]),
        completionDate: readText(row, report.fields, [
          "CompletionDate",
          "Completion Date (Jobs)"
        ]),
        assignedTechnicians: readText(row, report.fields, [
          "AssignedTechnicians",
          "Assigned Technicians (Jobs)"
        ]),
        recordingJobId: readText(row, report.fields, [
          "FieldProJobRecordings_Job_Id",
          "FieldProJobId",
          "Job ID (Field Pro: Job Recordings)"
        ]),
        recordingTitle: readText(row, report.fields, [
          "RecordingTitle",
          "Recording Title (Field Pro: Job Recordings)"
        ]),
        technician,
        durationMinutes: readNullableNumber(row, report.fields, [
          "RecordingDurationMinutes",
          "Recording Duration (Minutes) (Field Pro: Job Recordings)"
        ])
      };
    })
    .filter((row): row is FieldProJobRecordingRow => row !== null);

  return {
    rows,
    snapshotTime: report.snapshotTime
  };
}

export function buildFieldProPerformance(
  activity: FieldProTechnicianActivityDashboard,
  recordings: FieldProJobRecordingsDashboard,
): FieldProPerformanceDashboard {
  const recordingsByTechnician = new Map<string, FieldProJobRecordingRow[]>();

  for (const recording of recordings.rows) {
    const key = normalizeIdentity(recording.technician);
    const rows = recordingsByTechnician.get(key) ?? [];
    rows.push(recording);
    recordingsByTechnician.set(key, rows);
  }

  return {
    rows: activity.rows.map((row) => {
      const recordedJobs = recordingsByTechnician.get(normalizeIdentity(row.name)) ?? [];
      const durations = recordedJobs
        .map((recording) => recording.durationMinutes)
        .filter((duration): duration is number => duration != null);

      return {
        ...row,
        averageRecordingMinutes:
          durations.length > 0
            ? durations.reduce((total, duration) => total + duration, 0) / durations.length
            : null,
        longestRecordingMinutes: durations.length > 0 ? Math.max(...durations) : null,
        recordedJobs
      };
    }),
    totals: activity.totals,
    snapshotTime: activity.snapshotTime ?? recordings.snapshotTime
  };
}
