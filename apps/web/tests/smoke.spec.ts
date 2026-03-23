import { expect, test } from "@playwright/test";

const routes = [
  "/company-wide",
  "/technicians",
  "/installers",
  "/advisors",
  "/call-center/summary",
  "/call-center/by-csr",
  "/leads",
  "/campaigns"
];

for (const route of routes) {
  test(`smoke ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
  });
}
