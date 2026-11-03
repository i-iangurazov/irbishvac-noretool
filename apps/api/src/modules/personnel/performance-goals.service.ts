import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { prisma, type Prisma } from "@irbis/db";
import {
  assertGoalMonth, resolvePerformanceGoal, validateApprovedPerformanceGoal,
  type PerformanceGoal, type PerformancePersonnelDirectory,
} from "@irbis/domain";

@Injectable()
export class PerformanceGoalsService {
  async attach(directory: PerformancePersonnelDirectory, month: string) {
    try { assertGoalMonth(month); } catch { throw new BadRequestException("Goal month must be YYYY-MM"); }
    const versions = await prisma.performanceGoalVersion.findMany({
      where: { month }, orderBy: { createdAt: "desc" },
    });
    const latest = new Map<string, PerformanceGoal>();
    for (const version of versions) {
      const key = `${version.technicianId}:${version.department}`;
      if (!latest.has(key)) latest.set(key, version.payloadJson as unknown as PerformanceGoal);
    }
    return { ...directory, staff: directory.staff.map(person => ({
      ...person, goal: resolvePerformanceGoal(person, month, latest.get(`${person.technicianId}:${person.department}`)),
    })) };
  }

  async approve(input: { sourceKey: string; approvedBy: string; goal: PerformanceGoal }) {
    try {
      if (typeof input?.sourceKey !== "string" || !input.sourceKey.trim() || typeof input.approvedBy !== "string" || !input.approvedBy.trim()) throw new Error("Approval evidence and source key are required");
      validateApprovedPerformanceGoal(input.goal);
    } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Invalid performance goal"); }
    const goal = input.goal;
    // Replaying the same import must not create a second approval/version.
    const saved = await prisma.performanceGoalVersion.upsert({
      where: { sourceKey: input.sourceKey }, update: {},
      create: { sourceKey: input.sourceKey, approvedBy: input.approvedBy, technicianId: goal.technicianId,
        month: goal.month, department: goal.report_department, payloadJson: goal as unknown as Prisma.InputJsonValue },
    });
    const canonical = (value: object) => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    if (canonical(saved.payloadJson as object) !== canonical(goal) || saved.approvedBy !== input.approvedBy)
      throw new ConflictException("This approval source key is already associated with a different goal; use a new approval version");
    return saved;
  }
}
