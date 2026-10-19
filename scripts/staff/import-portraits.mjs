import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(root, "apps/web/package.json"));
const sharp = require("sharp");
const requireDb = createRequire(resolve(root, "packages/db/package.json"));
const { PrismaClient } = requireDb("@prisma/client");
const manifestPath = process.argv
  .find((arg) => arg.startsWith("--manifest="))
  ?.slice(11);
const backupPath = process.argv
  .find((arg) => arg.startsWith("--backup="))
  ?.slice(9);
const apply = process.argv.includes("--apply");
if (!manifestPath)
  throw new Error("Provide --manifest=/private/path/prepared-manifest.json");
if (apply && (!process.env.DATABASE_URL || !backupPath))
  throw new Error(
    "Import requires DATABASE_URL and --backup=/private/path/previous-portraits.json",
  );
const library = dirname(resolve(manifestPath));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const keyFor = (name) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const owners = new Map();
for (const person of manifest.people) {
  for (const name of [
    person.name,
    ...(person.nameVariants ?? []),
    ...(person.displayAliases ?? []),
  ]) {
    const alias = keyFor(name);
    if (!owners.has(alias)) owners.set(alias, new Set());
    owners.get(alias).add(person.key);
  }
}
const records = [];
for (const person of manifest.people) {
  if (person.status !== "prepared" || person.recommendedForUse !== true)
    continue;
  if (!/^[a-z0-9][a-z0-9-]{1,119}$/.test(person.key))
    throw new Error("Invalid portrait key");
  if (!person.checks.originalRgbAfterGeometricTransform)
    throw new Error("Source RGB validation is required");
  const path = resolve(library, person.web512);
  if (!path.startsWith(library + "/"))
    throw new Error("Portrait path must remain inside the library");
  const bytes = readFileSync(path);
  const info = await sharp(bytes).metadata();
  if (
    info.format !== "webp" ||
    info.width !== 512 ||
    info.height !== 512 ||
    bytes.length > 1024 * 1024
  )
    throw new Error("Portrait must be a validated 512 px WebP under 1 MB");
  records.push({
    key: person.key,
    workerId: person.ripplingId ?? null,
    displayName: person.name,
    aliases: [...owners]
      .filter(([, set]) => set.size === 1 && set.has(person.key))
      .map(([alias]) => alias),
    imageBytes: bytes,
    mimeType: "image/webp",
    width: 512,
    height: 512,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    sourceName: person.selected.name,
    uploadedAt: new Date(),
  });
}
if (!records.length)
  throw new Error("No reviewed, recommended portraits were supplied");
console.log(
  JSON.stringify({
    validated: records.length,
    missingSources: manifest.people.filter((p) => p.status !== "prepared")
      .length,
    qualityHold: manifest.people.filter(
      (p) => p.status === "prepared" && !p.recommendedForUse,
    ).length,
    bytes: records.reduce((n, p) => n + p.imageBytes.length, 0),
    apply,
  }),
);
if (apply) {
  const db = new PrismaClient({ log: [] });
  try {
    await db.$executeRawUnsafe(
      readFileSync(
        resolve(root, "packages/db/sql/staff-portraits.sql"),
        "utf8",
      ),
    );
    const keys = records.map((p) => p.key);
    const previous = await db.staffPortrait.findMany({
      where: { key: { in: keys } },
    });
    writeFileSync(
      backupPath,
      JSON.stringify(
        previous.map((p) => ({
          ...p,
          imageBytes: Buffer.from(p.imageBytes).toString("base64"),
        })),
      ) + "\n",
      { mode: 0o600 },
    );
    await db.$transaction(
      async (tx) => {
        for (const record of records)
          await tx.staffPortrait.upsert({
            where: { key: record.key },
            create: record,
            update: record,
          });
        const saved = await tx.staffPortrait.findMany({
          where: { key: { in: keys } },
          select: { key: true, imageBytes: true, checksum: true },
        });
        if (
          saved.length !== records.length ||
          saved.some(
            (p) =>
              createHash("sha256").update(p.imageBytes).digest("hex") !==
              records.find((r) => r.key === p.key)?.checksum,
          )
        )
          throw new Error("Stored portrait verification failed");
      },
      { timeout: 120_000 },
    );
    console.log(
      JSON.stringify({
        imported: records.length,
        previousRecordsBackedUp: previous.length,
        storedBytesVerified: true,
      }),
    );
  } catch (error) {
    console.error(
      "Portrait import failed:",
      error.code ?? "validation or database operation failed",
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
