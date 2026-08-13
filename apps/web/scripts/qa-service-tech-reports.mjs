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
const screenshotDir = path.join(outputDir, "qa");

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({
  ...(chromePath ? { executablePath: chromePath } : {}),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1365, height: 1200 }, deviceScaleFactor: 1 });
const results = [];

try {
  for (const technician of snapshot.technicians) {
    await page.goto(`${baseUrl}/performance/${technician.slug}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() =>
      Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
    );
    await page.emulateMedia({ media: "print" });
    const report = page.locator('[data-coaching-report="true"]');
    const measurements = await report.evaluate((element) => {
      const reportRect = element.getBoundingClientRect();
      const descendants = Array.from(element.querySelectorAll("*"));
      const outside = descendants
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            tag: node.tagName,
            className: String(node.className || ""),
            text: String(node.textContent || "").trim().slice(0, 80),
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          };
        })
        .filter((rect) =>
          rect.left < reportRect.left - 1 ||
          rect.right > reportRect.right + 1 ||
          rect.top < reportRect.top - 1 ||
          rect.bottom > reportRect.bottom + 1
        );
      return {
        width: reportRect.width,
        height: reportRect.height,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        outside,
        brokenImages: Array.from(document.images)
          .filter((image) => !image.complete || image.naturalWidth <= 0)
          .map((image) => image.currentSrc || image.src),
      };
    });
    await report.screenshot({ path: path.join(screenshotDir, `${technician.slug}.png`) });
    results.push({
      slug: technician.slug,
      technician: technician.technician,
      ok:
        measurements.scrollHeight <= measurements.clientHeight &&
        measurements.scrollWidth <= measurements.clientWidth &&
        measurements.outside.length === 0 &&
        measurements.brokenImages.length === 0,
      ...measurements,
    });
  }
} finally {
  await browser.close();
}

await writeFile(path.join(outputDir, "qa-results.json"), `${JSON.stringify(results, null, 2)}\n`);
const failed = results.filter((result) => !result.ok);
console.log(`checked=${results.length}`);
console.log(`failed=${failed.length}`);
if (failed.length) {
  console.log(JSON.stringify(failed, null, 2));
  process.exitCode = 1;
}
