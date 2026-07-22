import { expect, test } from "@playwright/test";

import { CODEX_CATALOG } from "@/lib/game/codex-catalog";
import { completeRealOnboarding, openRecords, seedFixture } from "./helpers/real-ui";

test.beforeEach(({ viewport }) => test.skip((viewport?.width ?? 0) < 800, "database integration runs once in the desktop project"));

test("empty ending collection shows 0/N locked slots and hides ending titles", async ({ page }) => {
  await completeRealOnboarding(page);
  await openRecords(page);
  await page.getByRole("tab", { name: "결말 모음" }).click();
  await expect(page.getByRole("heading", { name: `0 / ${CODEX_CATALOG.length} 달성` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "???" })).toHaveCount(CODEX_CATALOG.length);
  await expect(page.getByText(CODEX_CATALOG[0].categoryHint).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: CODEX_CATALOG[0].title, exact: true })).toHaveCount(0);
});

test("partial ending collection survives reload and opens and closes its detail dialog", async ({ page }, testInfo) => {
  const { character } = await completeRealOnboarding(page);
  await seedFixture(page, "records-partial", character.id);
  await page.reload();
  await openRecords(page);
  await expect(page.getByText("삼슨전자", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "결말 모음" }).click();

  const progress = page.getByRole("heading", { name: /\d+\s*\/\s*\d+\s*달성/ });
  const match = ((await progress.textContent()) ?? "").match(/(\d+)\s*\/\s*(\d+)/);
  expect(Number(match?.[1])).toBeGreaterThan(0);
  expect(Number(match?.[2])).toBe(CODEX_CATALOG.length);
  const unlocked = page.locator("button").filter({ has: page.locator("h3:not(:has-text('???'))") });
  await unlocked.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await testInfo.attach("partial-ending-dialog", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("records are the default tab and tabs switch without navigation", async ({ page }) => {
  await completeRealOnboarding(page);
  await openRecords(page);
  const initialUrl = page.url();
  await expect(page.getByRole("tab", { name: "지난 루트" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "결말 모음" }).click();
  await page.getByRole("tab", { name: "지난 루트" }).click();
  expect(page.url()).toBe(initialUrl);
  await expect(page.getByText("아직 저장된 기록이 없습니다.")).toBeVisible();
});
