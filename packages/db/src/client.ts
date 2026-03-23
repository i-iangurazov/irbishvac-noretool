import { PrismaClient } from "@prisma/client";

declare global {
  var __irbisPrisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__irbisPrisma__ ??
  new PrismaClient({
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__irbisPrisma__ = prisma;
}
