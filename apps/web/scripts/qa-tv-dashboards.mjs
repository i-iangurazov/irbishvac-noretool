/* global document, window */

import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = process.env.TV_QA_BASE_URL ?? "http://127.0.0.1:3000";
const outputDir = process.env.TV_QA_OUTPUT_DIR ?? "/tmp/irbis-tv-qa";
const executablePath =
  process.env.CHROME_EXECUTABLE ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const period = "preset=mtd&from=2026-08-01&to=2026-08-12&range=fixed&tv=1";

const cases = [
  {
    slug: "technicians-page-1",
    path: `/technicians?${period}&page=1`,
    ranks: ["#1", "#2", "#3", "#4", "#5", "#6", "#7", "#8"],
    maxCards: 8,
  },
  { slug: "plumbing-page-1", path: `/plumbing?${period}&page=1` },
  { slug: "installers-page-1", path: `/installers?${period}&page=1`, maxCards: 8 },
  { slug: "installers-page-2", path: `/installers?${period}&page=2`, firstRank: "#9", maxCards: 8 },
  { slug: "advisors-page-1", path: `/advisors?${period}&page=1` },
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const failures = [];

for (const entry of cases) {
  const response = await page.goto(`${baseUrl}${entry.path}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForSelector(
    ".leaderboard-card--photo, .empty-dashboard-state, [data-dashboard-shell=\"true\"] main",
    { timeout: 15_000 },
  );
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll(".leaderboard-card--photo img")].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(250);
  const status = response?.status() ?? 0;
  const result = await page.evaluate(() => {
    const shell = document.querySelector('[data-dashboard-shell="true"]');
    const cards = [...document.querySelectorAll(".leaderboard-card--photo")];
    const ranks = cards.map((card) =>
      card.querySelector(".leaderboard-card__rank")?.textContent?.trim() ?? "",
    );
    const overflowing = [...document.querySelectorAll("body *")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.right > window.innerWidth + 1 || rect.bottom > window.innerHeight + 1;
      })
      .slice(0, 10)
      .map((node) => ({
        className: node.className?.toString() ?? "",
        tag: node.tagName,
      }));
    const cardOverflowing = cards.flatMap((card, cardIndex) =>
      [...card.querySelectorAll("*")]
        .filter((node) => {
          const cardRect = card.getBoundingClientRect();
          const rect = node.getBoundingClientRect();
          return (
            rect.left < cardRect.left - 1 ||
            rect.right > cardRect.right + 1 ||
            rect.top < cardRect.top - 1 ||
            rect.bottom > cardRect.bottom + 1
          );
        })
        .slice(0, 5)
        .map((node) => ({ cardIndex, className: node.className?.toString() ?? "" })),
    );

    return {
      cards: cards.length,
      ranks,
      shellHeight: shell?.getBoundingClientRect().height ?? 0,
      viewportHeight: window.innerHeight,
      overflowing,
      cardOverflowing,
    };
  });

  await page.screenshot({ path: `${outputDir}/${entry.slug}.png`, fullPage: false });
  const expectedRanksMatch = entry.ranks
    ? entry.ranks.every((rank, index) => result.ranks[index] === rank)
    : entry.firstRank
      ? result.ranks[0] === entry.firstRank
      : true;
  const passed =
    status === 200 &&
    result.cards > 0 &&
    result.cards <= (entry.maxCards ?? 4) &&
    result.shellHeight <= result.viewportHeight + 1 &&
    result.overflowing.length === 0 &&
    result.cardOverflowing.length === 0 &&
    expectedRanksMatch;

  if (!passed) {
    failures.push({ slug: entry.slug, status, ...result, expectedRanksMatch });
  }

  process.stdout.write(
    `${passed ? "PASS" : "FAIL"} ${entry.slug} ${page.url()} ${JSON.stringify(result)}\n`,
  );
}

const rotationUrl = `${baseUrl}/installers?${period}&rotate=1&boards=installers&page=1`;
await page.goto(rotationUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForSelector(".leaderboard-card--photo", { timeout: 15_000 });

let rotationPassed = true;
try {
  await page.waitForURL((url) => url.searchParams.get("page") === "2", {
    timeout: 12_000,
  });
  const secondPageFirstRank = await page
    .locator(".leaderboard-card__rank")
    .first()
    .textContent();
  rotationPassed = secondPageFirstRank?.trim() === "#9";
  await page.screenshot({ path: `${outputDir}/installers-rotation-page-2.png`, fullPage: false });

  await page.waitForURL((url) => url.searchParams.get("page") === null, {
    timeout: 12_000,
  });
  const firstPageFirstRank = await page
    .locator(".leaderboard-card__rank")
    .first()
    .textContent();
  rotationPassed = rotationPassed && firstPageFirstRank?.trim() === "#1";
} catch {
  rotationPassed = false;
}

if (!rotationPassed) {
  failures.push({ slug: "installers-10-second-rotation", url: page.url() });
}
process.stdout.write(
  `${rotationPassed ? "PASS" : "FAIL"} installers-10-second-rotation ${page.url()}\n`,
);

await browser.close();

if (failures.length > 0) {
  process.stderr.write(`${JSON.stringify(failures, null, 2)}\n`);
  process.exitCode = 1;
}
