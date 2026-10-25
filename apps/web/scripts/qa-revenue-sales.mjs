/* global document, innerWidth */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const base = process.env.REVENUE_QA_BASE_URL ?? "http://127.0.0.1:3016";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw Error("Run Revenue QA against a local app, not production.");
const out = resolve(
  process.env.REVENUE_QA_OUTPUT_DIR ?? "reports/revenue-sales-qa",
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const results = [];
try {
  for (const width of [390, 768, 1440, 1920]) {
    const page = await browser.newPage({
      viewport: { width, height: width < 800 ? 844 : 1080 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `${base}/marketing?month=${process.env.REVENUE_QA_MONTH ?? "2026-10"}&view=revenue`,
      { waitUntil: "networkidle" },
    );
    await page
      .getByRole("heading", { name: "Total Completed Revenue", exact: true })
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (
      (await page.locator("header .marketing-workspace-tabs a").count()) !== 5
    )
      throw Error("Marketing navigation missing");
    await page.screenshot({
      path: resolve(out, `revenue-channels-${width}.png`),
      fullPage: true,
      style: `[data-dashboard-shell="true"], .dashboard-shell__inner, .dashboard-shell__main {height:auto !important; max-height:none !important; overflow:visible !important;} .dashboard-shell__main {flex:none !important;} nextjs-portal {display:none !important;}`,
    });
    await page.getByLabel("Group distribution by").selectOption("department");
    if (
      process.env.REVENUE_QA_REQUIRE_UNITS === "1" &&
      (await page.locator(".revenue-distribution-card .revenue-empty").count())
    )
      throw Error("Revenue business units missing");
    await page.screenshot({
      path: resolve(out, `revenue-business-units-${width}.png`),
      fullPage: true,
      style: `[data-dashboard-shell="true"], .dashboard-shell__inner, .dashboard-shell__main {height:auto !important; max-height:none !important; overflow:visible !important;} .dashboard-shell__main {flex:none !important;} nextjs-portal {display:none !important;}`,
    });
    await page
      .getByRole("group", { name: "Summary metric", exact: true })
      .getByRole("button", { name: "Sales", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Total Sales", exact: true })
      .waitFor();
    await page.screenshot({
      path: resolve(out, `sales-business-units-${width}.png`),
      fullPage: true,
      style: `[data-dashboard-shell="true"], .dashboard-shell__inner, .dashboard-shell__main {height:auto !important; max-height:none !important; overflow:visible !important;} .dashboard-shell__main {flex:none !important;} nextjs-portal {display:none !important;}`,
    });
    if (
      process.env.REVENUE_QA_REQUIRE_UNITS === "1" &&
      (await page.locator(".revenue-distribution-card .revenue-empty").count())
    )
      throw Error("Sales business units missing");
    const expand = page.getByRole("button", { name: /Show all .* channels/ });
    if (await expand.count()) {
      await expand.click();
      await page.getByRole("button", { name: "Show top 8 channels" }).click();
    }
    await page.getByLabel("Efficiency metric").selectOption("ratio");
    await page.getByLabel("Table channels").selectOption("paid");
    await page.getByLabel("Sort channels").selectOption("return");
    const table = await page
      .locator(".revenue-channel-table tbody")
      .innerText();
    if (table.includes("Organic") || table.includes("Unmapped"))
      throw Error("Table filter includes unrelated groups");
    await page.getByLabel("Chart channels").selectOption("organic");
    await page
      .getByRole("group", { name: "Channel chart metric" })
      .getByRole("button", { name: "Sales", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Sales by Channel", exact: true })
      .waitFor();
    if ((await page.getByLabel("Table channels").inputValue()) !== "paid")
      throw Error("Chart unexpectedly changed table filter");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    results.push({ width, overflow, errors });
    if (overflow > 1 || errors.length)
      throw Error(JSON.stringify(results.at(-1)));
    await page.close();
  }
  await writeFile(
    resolve(out, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
