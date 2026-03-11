import { expect, type Page } from "@playwright/test";

export class LandingPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/");
  }

  async assertLoaded() {
    await expect(this.page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible();
  }
}
