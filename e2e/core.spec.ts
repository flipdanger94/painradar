import { test, expect } from "@playwright/test";
test("landing, pricing and honest setup states", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Great products start/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Explore opportunities →" }).click();
  await expect(
    page.getByRole("heading", { name: "Trending opportunities" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Not enough evidence yet." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/pricing");
  await expect(
    page.getByRole("heading", { name: "Invest in the right problem." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("auth form validates locally and displays service errors", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator(".auth-wrap").getByRole("alert")).toContainText(
    "Sign-in is not configured yet.",
  );
});
test("account and report setup states retain their page headings", async ({
  page,
}) => {
  for (const [path, title] of [
    ["/app/reports", "Intelligence reports"],
    ["/app/settings", "Settings & billing"],
    ["/app/teams", "Teams & client workspaces"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
test("mobile navigation opens and closes", async ({ page }, info) => {
  if (Number(info.project.name.split("-")[1]) > 768) test.skip();
  await page.goto("/app");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("link", { name: "My radars" })).toBeVisible();
  await page.getByRole("link", { name: "My radars" }).click();
  await expect(
    page.getByRole("heading", { name: "Custom radars" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
});
test("mobile drawer traps focus, restores it and unlocks the background", async ({
  page,
}, info) => {
  if (Number(info.project.name.split("-")[1]) > 768) test.skip();
  await page.goto("/app");
  const opener = page.getByRole("button", { name: "Open navigation" });
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
  const close = drawer.getByRole("button", { name: "Close navigation" });
  await expect(close).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  await page.keyboard.press("Shift+Tab");
  await expect(
    drawer.getByRole("link", { name: "Log in to your workspace" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  expect(
    await page
      .locator("#workspace-navigation")
      .evaluate((element) => element.hasAttribute("inert")),
  ).toBe(true);
});
test("mobile drawer remains scrollable on short screens and closes on backdrop", async ({
  page,
}, info) => {
  const width = Number(info.project.name.split("-")[1]);
  if (width > 768) test.skip();
  await page.setViewportSize({ width, height: 480 });
  await page.goto("/app");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
  expect(
    await drawer.evaluate(
      (element) =>
        element.scrollHeight > element.clientHeight &&
        getComputedStyle(element).overflowY === "auto",
    ),
  ).toBe(true);
  await drawer.getByRole("link", { name: "Log in to your workspace" }).focus();
  await expect(
    drawer.getByRole("link", { name: "Log in to your workspace" }),
  ).toBeInViewport();
  await page
    .locator(".drawer-overlay")
    .click({ position: { x: width - 10, y: 200 } });
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
});
