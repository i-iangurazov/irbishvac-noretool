-- Additive deployment; existing metric snapshots and personnel history stay intact.
CREATE TABLE IF NOT EXISTS "PerformancePersonnelSnapshot" (
  "id" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PerformancePersonnelSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PerformancePersonnelSnapshot_fetchedAt_idx"
  ON "PerformancePersonnelSnapshot"("fetchedAt" DESC);

CREATE TABLE IF NOT EXISTS "PerformanceGoalVersion" (
  "id" TEXT NOT NULL PRIMARY KEY, "sourceKey" TEXT NOT NULL UNIQUE,
  "technicianId" TEXT NOT NULL, "month" TEXT NOT NULL, "department" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL, "approvedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PerformanceGoalVersion_scope_idx"
ON "PerformanceGoalVersion"("month", "technicianId", "department", "createdAt" DESC);
