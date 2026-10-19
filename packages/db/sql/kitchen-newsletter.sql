CREATE TABLE IF NOT EXISTS "KitchenNewsletter" (
  "issueMonth" TEXT PRIMARY KEY,
  "pagesJson" JSONB NOT NULL,
  "sourceName" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
