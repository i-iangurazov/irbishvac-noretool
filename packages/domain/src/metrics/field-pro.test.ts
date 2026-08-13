import { describe, expect, it } from "vitest";
import {
  buildFieldProJobRecordings,
  buildFieldProPerformance,
  buildFieldProTechnicianActivity
} from "./field-pro";

describe("Field Pro report normalization", () => {
  it("preserves missing recording data and normalizes populated technicians", () => {
    const activity = buildFieldProTechnicianActivity({
      fields: [
        { name: "Name", label: "Name (Technician Performance)" },
        { name: "CompletedJobs", label: "Completed Jobs (Technician Performance)" },
        { name: "Team", label: "Team (Field Pro: Technician Recording Performance)" },
        { name: "TotalRecordings", label: "Total Recordings (Field Pro: Technician Recording Performance)" },
        { name: "QualityRecordings", label: "Quality Recordings (>10 min) (Field Pro: Technician Recording Performance)" },
        { name: "QualityRecordingsRate", label: "Quality Recordings Rate (Field Pro: Technician Recording Performance)" }
      ],
      data: [
        ["Matthew Stalcup", 15, "SALES TEAM", 10, 8, 0.8],
        ["Raymond Porras", 15, null, null, null, null]
      ]
    });

    expect(activity.rows[0]).toMatchObject({
      totalRecordings: 10,
      qualityRecordingRate: 0.8,
      recordingCoverage: 10 / 15
    });
    expect(activity.rows[1]).toMatchObject({
      totalRecordings: null,
      qualityRecordingRate: null,
      recordingCoverage: null
    });
  });

  it("joins job-level durations to the matching technician", () => {
    const activity = buildFieldProTechnicianActivity({
      fields: [
        { name: "Name" },
        { name: "CompletedJobs" },
        { name: "TotalRecordings" },
        { name: "QualityRecordings" },
        { name: "QualityRecordingsRate" }
      ],
      data: [["Almaz Shamsharbek", 14, 6, 6, 1]]
    });
    const recordings = buildFieldProJobRecordings({
      fields: [
        { name: "JobId" },
        { name: "Technician" },
        { name: "RecordingDurationMinutes" }
      ],
      data: [
        ["1", "Almaz Shamsharbek", 80],
        ["2", "Almaz Shamsharbek", 40],
        ["3", null, null]
      ]
    });
    const result = buildFieldProPerformance(activity, recordings);

    expect(result.rows[0]).toMatchObject({
      averageRecordingMinutes: 60,
      longestRecordingMinutes: 80
    });
    expect(result.rows[0]?.recordedJobs).toHaveLength(2);
  });

  it("reads the exact ServiceTitan Field Pro report schema", () => {
    const activity = buildFieldProTechnicianActivity({
      fields: [
        { name: "Technicians_Name", label: "Name" },
        { name: "Technicians_CompletedJobs", label: "Completed Jobs" },
        {
          name: "FieldProTechnicianRecordingPerformance_Total_Recordings",
          label: "Total Recordings"
        },
        {
          name: "FieldProTechnicianRecordingPerformance_Quality_Recordings",
          label: "Quality Recordings (>10 min)"
        },
        {
          name: "FieldProTechnicianRecordingPerformance_Quality_Recordings_Rate",
          label: "Quality Recordings Rate"
        }
      ],
      data: [["Matthew Stalcup", 15, 10, 8, 0.8]]
    });
    const recordings = buildFieldProJobRecordings({
      fields: [
        { name: "Jobs_JobId", label: "Job ID" },
        { name: "Jobs_JobNumber", label: "Job #" },
        { name: "FieldProJobRecordings_Job_Id", label: "Job ID" },
        { name: "FieldProJobRecordings_Technician_Name", label: "Technician" },
        {
          name: "FieldProJobRecordings_Recording_Duration_Minutes",
          label: "Recording Duration (Minutes)"
        }
      ],
      data: [[132847514, "132847514", 132847514, "Matthew Stalcup", 44.33]]
    });

    expect(activity.rows[0]).toMatchObject({
      qualityRecordings: 8,
      qualityRecordingRate: 0.8
    });
    expect(recordings.rows[0]).toMatchObject({
      jobId: "132847514",
      jobNumber: "132847514",
      recordingJobId: "132847514",
      technician: "Matthew Stalcup",
      durationMinutes: 44.33
    });
  });
});
