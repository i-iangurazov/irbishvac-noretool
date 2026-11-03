import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { prisma } from "@irbis/db";
import { toBusinessDateString } from "@irbis/utils";
import { PersonnelService } from "./personnel.service";

@Injectable()
export class CoachingSourceService {
  constructor(@Inject(PersonnelService) private readonly personnel: PersonnelService) {}

  async forStaff(slug: string) {
    if (!/^staff-\d+$/.test(slug)) throw new BadRequestException("A current staff ID is required");
    const directory = await this.personnel.directoryWithGoals();
    const person = directory.staff.find(person=>person.slug===slug);
    if (!person || person.cycle==="installer") return null;
    const rows = await prisma.$queryRaw<Array<{fetchedAt:Date;payloadJson:Record<string,unknown>}>>`
      SELECT "fetchedAt","payloadJson" FROM "PerformanceCoachingSnapshot" WHERE "cycle"=${person.cycle}`;
    const source=rows[0];
    const age=source ? Date.now()-source.fetchedAt.getTime() : NaN;
    if (!source || !Number.isFinite(age) || age>90*60_000 || age < -5*60_000) return null;
    const payload=source.payloadJson;
    const today=toBusinessDateString(new Date(),"America/Los_Angeles");
    if (payload.periodFrom!==`${today.slice(0,7)}-01` || payload.cutoffDate!==today || !Array.isArray(payload.technicians)) return null;
    const report=payload.technicians.find(row=>String(row.technicianId)===person.technicianId);
    if (!report) return null;
    const goal=person.goal;
    return {...payload,technicians:[{...report,technician:person.technician,email:person.email,department:person.department,
      plan:{...report.plan,sourceMonth:goal.month,approvalStatus:goal.approval_status,monthlySalesGoal:goal.monthly_sales_goal,
        membershipMonthlyGoal:goal.membership_monthly_goal,reviewMonthlyGoal:goal.review_monthly_goal,workingDaysMonthly:goal.working_days,sourceNote:goal.source_note},
      personalizedTargets:{...report.personalizedTargets,targetOpportunitiesMonthly:goal.target_opportunities_monthly,targetRate:goal.target_rate,targetAverage:goal.target_average},
    }]};
  }
}
