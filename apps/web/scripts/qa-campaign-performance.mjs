import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const baseUrl = process.env.CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:3000";
const chromePath =
  process.env.PLAYWRIGHT_CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const workspaceRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const outputDir = resolve(
  workspaceRoot,
  process.env.CAMPAIGN_QA_OUTPUT_DIR ?? "reports/campaign-production-2026-08-06/qa",
);

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const results = [];
const periods = [
  { id: "2026-08", pdf: "IRBIS-Marketing-Campaign-August-MTD-LIVE.pdf" },
  { id: "2026-07", pdf: "IRBIS-Marketing-Campaign-July-2026.pdf" },
];

for (const period of periods) {
  for (const viewport of [
    { name: "tv-1920x1080", width: 1920, height: 1080 },
    { name: "laptop-1365x768", width: 1365, height: 768 },
    { name: "mobile-390x844", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${baseUrl}/campaigns?month=${period.id}`, { waitUntil: "networkidle" });
    await page.screenshot({
      path: resolve(outputDir, `${period.id}-${viewport.name}.png`),
      fullPage: viewport.name === "mobile-390x844",
    });

    const metrics = await page.evaluate(() => {
      const dashboard = document.querySelector("[data-campaign-performance='true']");
      const main = document.querySelector(".campaign-performance__main");
      const table = document.querySelector(".campaign-table");
      const rows = document.querySelectorAll(".campaign-table tbody tr");
      const sources = document.querySelectorAll(".campaign-source");
      const refresh = document.querySelector(".campaign-refresh__button");
      return {
        title: document.title,
        dashboardPresent: Boolean(dashboard),
        visibleRows: rows.length,
        visibleSources: sources.length,
        refreshPresent: Boolean(refresh),
        bodyWidthOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainHeightOverflow: main ? main.scrollHeight - main.clientHeight : null,
        tableWidthOverflow: table && table.parentElement
          ? table.scrollWidth - table.parentElement.clientWidth
          : null,
        tableBottom: table ? Math.round(table.getBoundingClientRect().bottom) : null,
        viewportHeight: window.innerHeight,
      };
    });
    results.push({ period: period.id, viewport, ...metrics });
    await page.close();
  }

  const pdfPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await pdfPage.goto(`${baseUrl}/campaigns?month=${period.id}`, { waitUntil: "networkidle" });
  await pdfPage.pdf({
    path: resolve(outputDir, `../${period.pdf}`),
    format: "Letter",
    landscape: true,
    printBackground: true,
    margin: { top: "0.2in", right: "0.2in", bottom: "0.2in", left: "0.2in" },
  });
  await pdfPage.close();
}

await browser.close();
await writeFile(resolve(outputDir, "qa-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
const failed = results.filter((result) =>
  result.viewport.name !== "mobile-390x844" && (
    !result.dashboardPresent ||
    result.visibleRows < 1 ||
    result.visibleSources !== 4 ||
    !result.refreshPresent ||
    result.bodyWidthOverflow > 1 ||
    (result.mainHeightOverflow ?? 0) > 1 ||
    (result.tableWidthOverflow ?? 0) > 1 ||
    (result.tableBottom ?? 0) > result.viewportHeight
  )
);
if (failed.length) {
  console.error(JSON.stringify(failed, null, 2));
  process.exitCode = 1;
}
