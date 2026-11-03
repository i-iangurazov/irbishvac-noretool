import { prisma, type Prisma } from "@irbis/db";
import { buildPerformancePersonnelDirectory } from "@irbis/domain";
import { MembershipSourceClient } from "@irbis/integrations";
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { createLogger } from "@irbis/utils";

/** Complete paginated source reads precede the single immutable database insert. */
export class PersonnelRefreshRunner {
  constructor(private readonly resources = new MembershipSourceClient()) {}

  async refresh() {
    const units = await this.resources.list("business-units");
    const technicians = await this.resources.list("technicians");
    const directory = buildPerformancePersonnelDirectory(technicians, units);
    await prisma.performancePersonnelSnapshot.create({
      data: {
        payloadJson: directory as unknown as Prisma.InputJsonValue,
        fetchedAt: new Date(directory.fetchedAt),
      },
    });
    return { status: "succeeded", staffCount: directory.staff.length, fetchedAt: directory.fetchedAt };
  }
}

/** A separate queue prevents annual/report refresh backlogs from delaying staff changes. */
export async function startPersonnelWorker(connection: ConnectionOptions) {
  const name = "irbis-performance-personnel";
  const queue = new Queue(name, { connection, defaultJobOptions: {
    attempts: 3, backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 100, removeOnFail: 100,
  } });
  const logger = createLogger("worker-personnel");
  const runner = new PersonnelRefreshRunner();
  const worker = new Worker(name, () => runner.refresh(), { connection, concurrency: 1 });
  worker.on("completed", job => logger.info("Personnel refresh completed", { jobId: job.id }));
  worker.on("failed", (job, error) => logger.error("Personnel refresh failed", {
    jobId: job?.id, errorType: error.name,
  }));
  await queue.upsertJobScheduler("personnel-every-15-minutes", { pattern: "*/15 * * * *", tz: "UTC" }, {
    name: "refresh-personnel", data: {},
  });
  await queue.add("bootstrap-personnel", {}, { jobId: `personnel-bootstrap-${Math.floor(Date.now() / 900_000)}` });
  return { queue, worker };
}
