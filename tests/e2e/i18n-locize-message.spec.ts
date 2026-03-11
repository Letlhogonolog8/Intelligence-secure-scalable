import { expect, test } from "@playwright/test";
import { LandingPage } from "./pages/LandingPage";

test("landing page loads without i18next locize sponsorship console noise", async ({ page }) => {
  const consoleMessages: string[] = [];

  page.on("console", (message) => {
    consoleMessages.push(message.text());
  });

  const landingPage = new LandingPage(page);
  await landingPage.goto();
  await landingPage.assertLoaded();

  const hasLocizeMessage = consoleMessages.some((message) =>
    message.includes("i18next is maintained with support from Locize"),
  );

  await expect(hasLocizeMessage).toBeFalsy();
});
