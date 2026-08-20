import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const repoRoot = path.resolve(process.cwd(), "../..");
const snapshotPath = process.env.PERFORMANCE_DELIVERY_SNAPSHOT_PATH ??
  path.join(repoRoot, "generated/service-tech-mtd-delivery.tmp.json");
const baseUrl = process.env.PERFORMANCE_WEB_BASE_URL ?? "http://localhost:3000";
const defaultChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH ??
  (existsSync(defaultChromePath) ? defaultChromePath : null);
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const cutoffDate = snapshot.cutoffDate ?? new Date().toISOString().slice(0, 10);
const reportVersion = String(snapshot.reportVersion ?? "V2").toLowerCase();
const outputDir = process.env.PERFORMANCE_PDF_OUTPUT_DIR ??
  path.join(repoRoot, `reports/service-tech-mtd-${cutoffDate}-${reportVersion}`);

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  ...(chromePath ? { executablePath: chromePath } : {}),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1365, height: 1200 } });
const manifest = [];

try {
  for (const technician of snapshot.technicians) {
    const url = `${baseUrl}/performance/${technician.slug}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator('[data-coaching-report="true"]').waitFor({
      state: "visible",
      timeout: 30_000,
    });
    await page.waitForFunction(() =>
      Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
    );
    await page.emulateMedia({ media: "print" });
    const reportCount = await page.locator('[data-coaching-report="true"]').count();
    if (reportCount !== 1) {
      throw new Error(`Expected one report for ${technician.slug}, found ${reportCount}`);
    }

    const department = String(technician.department ?? "");
    const prefix = department.startsWith("Plumbing")
      ? "plumbing"
      : department.includes("Sales")
        ? "sales"
        : "hvac";
    const fileName = `${prefix}-${technician.slug}-mtd-through-${cutoffDate}.pdf`;
    const outputPath = path.join(outputDir, fileName);
    await page.pdf({
      path: outputPath,
      format: "Letter",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
    });
    manifest.push({
      slug: technician.slug,
      technician: technician.technician,
      department: technician.department,
      email: technician.email,
      fileName,
      url,
    });
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    reportVersion: snapshot.reportVersion ?? null,
    periodFrom: snapshot.periodFrom,
    cutoffDate,
    reports: manifest,
  }, null, 2)}\n`,
);
console.log(`generated=${manifest.length}`);
console.log(`output=${outputDir}`);
