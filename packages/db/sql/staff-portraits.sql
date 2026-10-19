CREATE TABLE IF NOT EXISTS "StaffPortrait" (
  "key" TEXT PRIMARY KEY,
  "workerId" TEXT UNIQUE,
  "displayName" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "imageBytes" BYTEA NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
