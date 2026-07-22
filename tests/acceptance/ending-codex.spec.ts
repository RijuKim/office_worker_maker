import { expect, test } from "@playwright/test";
import { completeSharedOnboarding, installSharedUiApi, sharedRecord } from "./helpers/shared-ui";
import { CODEX_CATALOG } from "@/lib/game/codex-catalog";

test.beforeEach(async ({ page }) => {
  await installSharedUiApi(page, { records: true });
  await page.goto("/");
  await completeSharedOnboarding(page);
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  await page.locator(".app-menu-popover").getByRole("button", { name: "기록", exact: true }).click();
});

test("records are the default tab and render the saved ending", async ({ page }) => {
  await expect(page.getByRole("tab", { name: "지난 루트" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(sharedRecord.title, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(sharedRecord.title) }).click();
  await expect(page.getByText(sharedRecord.longNarrative)).toBeVisible();
});

test("ending collection exposes locked progress without leaking titles", async ({ page }) => {
  await page.getByRole("tab", { name: "결말 모음" }).click();
  await expect(page.getByRole("tab", { name: "결말 모음" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: new RegExp(`\\d+\\s*/\\s*${CODEX_CATALOG.length}\\s*달성`) })).toBeVisible();
  await expect(page.getByRole("heading", { name: "???" }).first()).toBeVisible();
});

test("record and collection tabs switch without changing pages", async ({ page }) => {
  await page.getByRole("tab", { name: "결말 모음" }).click();
  await page.getByRole("tab", { name: "지난 루트" }).click();
  await expect(page.getByText(sharedRecord.title, { exact: true })).toBeVisible();
});
