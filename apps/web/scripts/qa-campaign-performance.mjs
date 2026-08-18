import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const baseUrl = process.env.CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:3000";
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const workspaceRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const outputDir = resolve(workspaceRoot, process.env.CAMPAIGN_QA_OUTPUT_DIR ?? "reports/campaign-production/qa");

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const results = [];
const periods = [
  { id: "2026-08", pdf: "IRBIS-Marketing-Campaign-August-MTD.pdf" },
  { id: "2026-07", pdf: "IRBIS-Marketing-Campaign-July-2026.pdf" },
];
const views = ["overview", "revenue", "channels", "plan", "history"];
const viewports = [
  { name: "tv-1920x1080", width: 1920, height: 1080 },
  { name: "laptop-1365x768", width: 1365, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
];

for (const period of periods) {
  for (const view of views) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseUrl}/campaigns?month=${period.id}&view=${view}`, { waitUntil: "networkidle" });
      await page.screenshot({ path: resolve(outputDir, `${period.id}-${view}-${viewport.name}.png`), fullPage: true });

      const metrics = await page.evaluate(() => {
        const dashboard = document.querySelector("[data-campaign-performance='true']");
        const tables = [...document.querySelectorAll(".campaign-table")];
        const tabs = document.querySelectorAll(".campaign-view-tabs a");
        const sources = document.querySelectorAll(".campaign-source");
        const refresh = document.querySelector(".campaign-refresh__button");
        const gauges = document.querySelectorAll(".campaign-gauge");
        const legacyMeters = document.querySelectorAll(".campaign-executive-meter, .campaign-progress");
        const clipped = [...document.querySelectorAll(".campaign-performance strong, .campaign-performance small, .campaign-performance span")]
          .filter((element) => element.scrollWidth > element.clientWidth + 2 && getComputedStyle(element).textOverflow !== "ellipsis")
          .length;
        return {
          dashboardPresent: Boolean(dashboard),
          tableCount: tables.length,
          visibleRows: document.querySelectorAll(".campaign-table tbody tr").length,
          visibleSources: sources.length,
          tabCount: tabs.length,
          refreshPresent: Boolean(refresh),
          gaugeCount: gauges.length,
          legacyMeterCount: legacyMeters.length,
          bodyWidthOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          tableWidthOverflow: Math.max(0, ...tables.map((table) => table.scrollWidth - (table.parentElement?.clientWidth ?? table.clientWidth))),
          clippedTextCount: clipped,
        };
      });
      results.push({ period: period.id, view, viewport, ...metrics });
      await page.close();
    }
  }

  const pdfPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await pdfPage.goto(`${baseUrl}/campaigns?month=${period.id}&view=overview`, { waitUntil: "networkidle" });
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
  !result.dashboardPresent ||
  result.visibleSources < 4 ||
  result.tabCount !== 5 ||
  !result.refreshPresent ||
  result.bodyWidthOverflow > 1 ||
  (result.view === "overview" && (result.gaugeCount < 5 || result.legacyMeterCount > 0)) ||
  (result.view !== "overview" && result.tableCount < 1) ||
  (result.viewport.name !== "mobile-390x844" && result.tableWidthOverflow > 1)
);
if (failed.length) {
  console.error(JSON.stringify(failed, null, 2));
  process.exitCode = 1;
}
