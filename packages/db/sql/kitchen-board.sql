-- Additive setup only. No existing tables, rows, or enums are modified.
CREATE TABLE IF NOT EXISTS "KitchenSnapshot" (
  "id" TEXT NOT NULL DEFAULT 'current',
  "payloadJson" JSONB NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KitchenSnapshot_pkey" PRIMARY KEY ("id")
);
