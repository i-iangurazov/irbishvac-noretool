import { PerformanceGoalsService } from "./performance-goals.service";
import { toBusinessDateString } from "@irbis/utils";
import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { getConfig } from "@irbis/config";
import { prisma } from "@irbis/db";
import type { Prisma } from "@irbis/db";
import { MembershipSourceClient } from "@irbis/integrations";
import {
  assertPersonnelFresh, buildPerformancePersonnelDirectory, reconcileAdvisorPersonnel, reconcileInstallerPersonnel,
  reconcileTechnicianPersonnel, type PerformancePersonnelDirectory,
  type TechnicianDashboard, type AdvisorDashboard, type InstallerDashboard,
} from "@irbis/domain";

@Injectable()
export class PersonnelService {
  constructor(@Inject(PerformanceGoalsService) private readonly goals: PerformanceGoalsService = new PerformanceGoalsService()) {}

  async directoryWithGoals(month = toBusinessDateString(new Date(), "America/Los_Angeles").slice(0, 7)) {
    return this.goals.attach(await this.directory(), month);
  }

  async refresh(month?: string) {
    const source = new MembershipSourceClient();
    const units = await source.list("business-units");
    const technicians = await source.list("technicians");
    const directory = buildPerformancePersonnelDirectory(technicians, units);
    await prisma.performancePersonnelSnapshot.create({ data: {
      fetchedAt: new Date(directory.fetchedAt), payloadJson: directory as unknown as Prisma.InputJsonValue,
    } });
    return this.directoryWithGoals(month);
  }
  async directory(): Promise<PerformancePersonnelDirectory> {
    try {
      const saved = await prisma.performancePersonnelSnapshot.findFirst({ orderBy: { fetchedAt: "desc" } });
      if (!saved) throw new Error("No complete personnel export");
      const directory = saved.payloadJson as unknown as PerformancePersonnelDirectory;
      assertPersonnelFresh(directory, getConfig().personnel.maxAgeMinutes);
      return directory;
    } catch {
      throw new ServiceUnavailableException("Employee directory is unavailable or stale. Refresh personnel before using current performance data.");
    }
  }

  private decorate<T extends { rows: Array<{ technicianId: string | null }>; rowsRanked: Array<{ technicianId: string | null }> }>(dashboard: T, directory: Awaited<ReturnType<PersonnelService["directoryWithGoals"]>>, disableGoals: boolean) {
    const goals = new Map(directory.staff.map(person => [person.technicianId, person.goal]));
    const decorate = (row: T["rows"][number]) => ({ ...row, goal: disableGoals ? null : goals.get(row.technicianId ?? "") ?? null });
    return { ...dashboard, rows: dashboard.rows.map(decorate), rowsRanked: dashboard.rowsRanked.map(decorate) };
  }

  async technicians(dashboard: TechnicianDashboard, month?: string | null): Promise<TechnicianDashboard> {
    const directory = await this.directoryWithGoals(month ?? undefined);
    return this.decorate(reconcileTechnicianPersonnel(dashboard, directory), directory, month === null);
  }

  async advisors(dashboard: AdvisorDashboard, month?: string | null): Promise<AdvisorDashboard> {
    const directory = await this.directoryWithGoals(month ?? undefined);
    return this.decorate(reconcileAdvisorPersonnel(dashboard, directory), directory, month === null);
  }

  async installers(dashboard: InstallerDashboard, month?: string | null): Promise<InstallerDashboard> {
    const directory = await this.directoryWithGoals(month ?? undefined);
    return this.decorate(reconcileInstallerPersonnel(dashboard, directory), directory, month === null);
  }
}
