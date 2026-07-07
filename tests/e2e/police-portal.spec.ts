import { test, expect } from "@playwright/test";

/**
 * Police Portal smoke suite — drives the real sign-in flow and the portal's
 * core sections against a live Supabase backend.
 *
 * Requires a police test account (see scripts/qa-create-police-user.mjs):
 *   E2E_POLICE_USERNAME=qa-police E2E_POLICE_PASSWORD=... npx playwright test
 *
 * Skipped when credentials are not configured so CI without secrets stays
 * green. MFA is exempt on localhost (roleAuthPolicy), so TOTP is not needed.
 */

const USERNAME = process.env.E2E_POLICE_USERNAME;
const PASSWORD = process.env.E2E_POLICE_PASSWORD;

// One worker, sequential: each test signs in with the same account, and
// parallel sign-ins over the on-demand dev-server bundle starve each other.
test.describe.configure({ mode: "serial" });

test.describe("Police Portal", () => {
  test.skip(
    !USERNAME || !PASSWORD,
    "Set E2E_POLICE_USERNAME and E2E_POLICE_PASSWORD to run the portal smoke suite",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    const policeCard = page.getByRole("button", { name: /Police Officer/ });
    await policeCard.scrollIntoViewIfNeeded();
    await policeCard.click();
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await page.getByPlaceholder(/username/i).fill(USERNAME!);
    await page.getByPlaceholder(/passphrase|password/i).fill(PASSWORD!);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await page.waitForURL("**/app", { timeout: 20000 });
    await expect(
      page.getByText("Police Response Portal", { exact: false }),
    ).toBeVisible({ timeout: 20000 });
  });

  test("overview renders live KPI cards and navigation", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Welcome, Law Enforcement Command/ }),
    ).toBeVisible();
    for (const item of ["Emergency Queue", "Cases", "Dispatch", "Messages"]) {
      await expect(
        page.getByRole("button", { name: item, exact: false }).first(),
      ).toBeVisible();
    }
  });

  test("emergency queue lists incidents with actions", async ({ page }) => {
    await page
      .getByRole("button", { name: "Emergency Queue", exact: true })
      .click();
    await expect(page.getByText(/Priority Queue/)).toBeVisible();
    // Live rows carry Dispatch/Escalate actions; an empty queue shows its
    // empty state rather than fabricated incidents.
    const hasRows = await page
      .getByRole("button", { name: "Escalate" })
      .first()
      .isVisible()
      .catch(() => false);
    if (!hasRows) {
      await expect(
        page.getByText(/no .*(alerts|incidents|queue)/i),
      ).toBeVisible();
    }
  });

  test("cases section opens and closes the New Case modal", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Cases", exact: true }).click();
    await expect(page.getByText("Case Management")).toBeVisible();
    await page.getByRole("button", { name: /New Case/ }).click();
    await expect(page.getByRole("dialog", { name: /New case/i })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog", { name: /New case/i })).toBeHidden();
  });

  test("messages section loads the secure inbox", async ({ page }) => {
    await page
      .getByRole("button", { name: /^Messages/ })
      .first()
      .click();
    await expect(page.getByText("Secure Messages")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /New Conversation/ }),
    ).toBeVisible();
  });

  test("partner coordination shows the live board", async ({ page }) => {
    const nav = page.locator("aside nav");
    await nav.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.getByRole("button", { name: "Partner Coordination" }).click();
    await expect(page.getByText("Partner Coordination Board")).toBeVisible();
    await expect(page.getByText("Multi-agency coordination")).toBeVisible();
  });
});
