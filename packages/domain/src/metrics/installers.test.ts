import { describe, expect, it } from "vitest";
import { buildInstallerDashboard, filterInstallerDashboardByDepartment } from "./installers";

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

  it("separates HVAC, plumbing, and electrical installers from ST position or business unit", () => {
    const result = buildInstallerDashboard({
      fields: [
        { name: "Name" },
        { name: "BusinessUnit" },
        { name: "Position" },
        { name: "CompletedRevenue" },
        { name: "CompletedJobs" }
      ],
      data: [
        ["HVAC Installer", "HVAC Install", "", 1000, 1],
        ["Plumbing Installer", "Plumbing", "Plumbing Installation Technicians", 2000, 2],
        ["Electrical Installer", "Electrical", "Electrical Install Technicians", 3000, 3],
        ["Service Role Installer", "HVAC - Service", "Service Technician", 4000, 4]
      ]
    });

    const hvacInstallers = filterInstallerDashboardByDepartment(result, "hvac-install").rowsRanked;

    expect(hvacInstallers).toHaveLength(2);
    expect(hvacInstallers.map((row) => row.name)).toContain("HVAC Installer");
    expect(hvacInstallers.map((row) => row.name)).toContain("Service Role Installer");
    expect(filterInstallerDashboardByDepartment(result, "plumbing-install").rowsRanked[0]?.name).toBe(
      "Plumbing Installer",
    );
    expect(filterInstallerDashboardByDepartment(result, "electrical-install").rowsRanked[0]?.name).toBe(
      "Electrical Installer",
    );
  });
});
