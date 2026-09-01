import { expect, test } from "@playwright/test";

const routes = [
  "/company-wide",
  "/technicians",
  "/plumbing",
  "/electrical",
  "/installers",
  "/plumbing-install",
  "/electrical-install",
  "/advisors",
  "/call-center/summary",
  "/call-center/by-csr",
  "/leads",
  "/campaigns"
];

for (const route of routes) {
  test(`requires authentication for ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/sign-in\?redirect_url=/);
    await expect(
      page.getByRole("heading", { name: "Sign in to IRBIS HVAC Dashboards" }),
    ).toBeVisible();
  });
}

test("keeps the sign-in page usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sign-in");

  await expect(
    page.getByRole("heading", { name: "Sign in to IRBIS HVAC Dashboards" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
});

test("does not expose dashboard API data to signed-out requests", async ({ request }) => {
  const response = await request.get("/api/dashboard/campaigns", {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/sign-in?redirect_url=");
});
