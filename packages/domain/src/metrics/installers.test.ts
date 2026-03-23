import { describe, expect, it } from "vitest";
import { buildInstallerDashboard } from "./installers";

describe("buildInstallerDashboard", () => {
  it("ranks installers by installed revenue and computes weighted averages", () => {
    const result = buildInstallerDashboard({
      fields: [
        { name: "Name" },
        { name: "CompletedRevenue" },
        { name: "CompletedJobs" },
        { name: "RecallsCaused" },
        { name: "BillableEfficiency" },
        { name: "AverageInstall" }
      ],
      data: [
        ["North Team", 2000, 4, 1, 0.8, 500],
        ["South Team", 1000, 2, 0, 0.5, 450]
      ]
    });

    expect(result.rowsRanked[0]?.name).toBe("North Team");
    expect(result.totals.jobsCompleted).toBe(6);
    expect(result.totals.billableEfficiencyAvg).toBe(0.7);
  });
});
