CREATE TABLE IF NOT EXISTS "PerformanceCoachingSnapshot" (
  "cycle" TEXT PRIMARY KEY CHECK ("cycle" IN ('technician', 'advisor')),
  "periodFrom" TEXT NOT NULL,
  "cutoffDate" TEXT NOT NULL,
  "fetchedAt" TIMESTAMPTZ NOT NULL,
  "payloadJson" JSONB NOT NULL
);
