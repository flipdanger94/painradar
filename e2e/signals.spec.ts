import { test, expect } from "@playwright/test";
import { locales, translate } from "../src/lib/i18n/messages";
test("signals search preserves filters and translates without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/app/signals");
  await expect(
    page.getByRole("heading", { level: 1, name: "Signals", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("search")
    .getByLabel("Search signals")
    .fill("deployment failure");
  await page
    .getByRole("search")
    .getByLabel("Source", { exact: true })
    .selectOption("github");
  await page
    .getByRole("search")
    .getByLabel("Processing state", { exact: true })
    .selectOption("related");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("search").getByLabel("Search signals"),
  ).toHaveValue("deployment failure");
  await expect(
    page.getByRole("search").getByLabel("Source", { exact: true }),
  ).toHaveValue("github");
  expect(new URL(page.url()).searchParams.get("state")).toBe("related");
  for (const locale of locales) {
    await page.locator(".language-switcher select").selectOption(locale);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: translate(locale, "Signals"),
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".language-switcher select")).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.reload();
  await expect(
    page.getByRole("search").getByLabel(translate("ru", "Search signals")),
  ).toHaveValue("deployment failure");
  await expect(
    page.getByRole("heading", { name: translate("ru", "Setup required") }),
  ).toBeVisible();
});
test("landing explanations and pricing features have translations in every interface language", async ({
  page,
}) => {
  await page.goto("/");
  for (const locale of locales) {
    await page.locator(".language-switcher select").selectOption(locale);
    await expect(page.locator(".feature-card").first()).toContainText(
      translate(
        locale,
        "Collect public complaints, feature requests, and workarounds. Every signal keeps its original source.",
      ),
    );
    await expect(page.locator(".faq")).toContainText(
      translate(locale, "Does PainRadar generate startup ideas?"),
    );
    await expect(page.locator(".language-switcher select")).toBeEnabled();
  }
  await page.goto("/pricing");
  await expect(page.locator(".pricing-grid")).toContainText(
    translate("ru", "5 opportunities per day"),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
