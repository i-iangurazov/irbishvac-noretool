import { getConfig } from "@irbis/config";
import { DashboardFamily, prisma, type Prisma } from "@irbis/db";
import { selectAdvisorRoster } from "@irbis/domain";
import { MembershipSourceClient } from "@irbis/integrations";
import { createLogger } from "@irbis/utils";
const logger = createLogger("worker-sales-staff");

/** Shared across period refreshes; failed/partial reads never replace the last complete roster. */
let pending: Promise<void> | undefined;
let refreshedAt = 0;
export async function refreshAdvisorRoster() {
  if (Date.now() - refreshedAt < 15 * 60_000) return;
  if (pending) return pending;
  pending = (async () => {
    const client = new MembershipSourceClient();
    const [technicians, units] = await Promise.all([
      client.list("technicians"),
      client.list("business-units"),
    ]);
    const roster = selectAdvisorRoster(
      technicians,
      units,
      getConfig().serviceTitan.businessUnits.advisors,
    );
    const data = {
      payloadJson: roster as unknown as Prisma.InputJsonValue,
      snapshotTime: new Date(),
      sourceSnapshotIds: [],
    };
    await prisma.dashboardReadModel.upsert({
      where: {
        family_scopeKey: {
          family: DashboardFamily.ADVISORS,
          scopeKey: "staff-roster:v1",
        },
      },
      create: {
        family: DashboardFamily.ADVISORS,
        scopeKey: "staff-roster:v1",
        ...data,
      },
      update: data,
    });
    refreshedAt = Date.now();
    logger.info("Sales staff roster refreshed", { count: roster.length });
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}
