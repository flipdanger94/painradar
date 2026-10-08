import { test, expect } from "@playwright/test";
import { locales, translate } from "../src/lib/i18n/messages";
test.setTimeout(60000);
const fixture = {
  observedAt: "2026-10-08T21:30:00Z",
  counts: {
    signals: 377,
    embedded: 80,
    queued: 297,
    awaitingGrouping: 80,
    processed: 0,
    duplicates: 0,
    clusters: 0,
    opportunities: 0,
  },
  job: {
    status: "completed",
    startedAt: "2026-10-08T18:31:00Z",
    finishedAt: "2026-10-08T18:45:00Z",
    progress: {
      stage: "done",
      done: 1,
      total: 1,
      updatedAt: "2026-10-08T18:45:00Z",
    },
    error: null,
  },
  configured: true,
  limits: { embeddings: 40, seeds: 20 },
  sources: [
    {
      id: "github",
      name: "GitHub Issues",
      enabled: true,
      health: "collecting",
      error: null,
      signals: 125,
      completedThrough: null,
      pages: 3,
      scopes: ["vercel/next.js", "n8n-io/n8n"],
    },
  ],
  recent: [
    {
      source: "github",
      title: "Original source issue",
      url: "https://github.com/vercel/next.js/issues/4381",
    },
  ],
};
test("all seven languages switch and persist through navigation and reload", async ({
  page,
}) => {
  await page.goto("/");
  for (const locale of locales) {
    await page.locator(".language-switcher select").selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("h1")).toContainText(
      translate(locale, "Great products start"),
    );
    await expect(page.locator(".language-switcher select")).toBeEnabled();
    await expect(page.locator(".language-switcher select")).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.reload();
  await expect(page.locator(".language-switcher select")).toHaveValue("ru");
  await page.goto("/login");
  await expect(page.locator("h1")).toHaveText(translate("ru", "Welcome back."));
  await expect(
    page.getByRole("button", { name: translate("ru", "Log in"), exact: true }),
  ).toBeVisible();
});
test("live monitor distinguishes completed batches from the remaining queue", async ({
  page,
}, info) => {
  let current = fixture;
  await page.route("**/api/pipeline/status", (route) =>
    route.fulfill({ json: current }),
  );
  await page.goto("/app/sources");
  await expect(
    page.getByRole("heading", { name: "Collection monitor" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".pipeline-explanation")).toContainText(
    "One batch is complete",
  );
  await expect(page.locator(".pipeline-stats")).toContainText("297");
  await expect(page.locator(".source-monitor-grid")).toContainText("125");
  await expect(page.locator(".source-monitor-grid")).toContainText(
    "vercel/next.js",
  );
  await page.getByText("Latest signals", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: /Original source issue/ }),
  ).toHaveAttribute("href", fixture.recent[0].url);
  await page.locator(".language-switcher select").selectOption("ru");
  await expect(
    page.getByRole("heading", { name: translate("ru", "Collection monitor") }),
  ).toBeVisible({ timeout: 20000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/painradar-monitor-${info.project.name}.png`,
    fullPage: true,
  });
  current = {
    ...fixture,
    job: {
      ...fixture.job,
      status: "running",
      progress: {
        stage: "embed",
        done: 12,
        total: 40,
        updatedAt: fixture.observedAt,
      },
    },
  };
  await expect(page.locator(".batch-progress progress")).toHaveAttribute(
    "value",
    "12",
    { timeout: 15000 },
  );
  await expect(page.locator(".batch-progress")).toContainText("12 / 40");
});
