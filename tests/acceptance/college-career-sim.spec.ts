import { expect, test } from "@playwright/test";
import { completeSharedOnboarding, installSharedUiApi, sharedEvent } from "./helpers/shared-ui";

test.beforeEach(async ({ page }) => {
  await installSharedUiApi(page);
  await page.goto("/");
});

test("shared onboarding creates the player-entered run and renders gameplay", async ({ page }) => {
  await completeSharedOnboarding(page);
  await expect(page.getByText("한서윤", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("2학년 1학기", { exact: true })).toBeVisible();
  await expect(page.getByText("사회학과", { exact: true })).toBeVisible();
});

test("a choice displays observable feedback and the next event", async ({ page }) => {
  await completeSharedOnboarding(page);
  await page.getByRole("button", { name: sharedEvent.choices[0].label }).click();
  await expect(page.locator(".feedback-panel")).toContainText("실무 +2");
  await expect(page.locator(".feedback-panel")).toContainText("준비가 기록되었습니다.");
  await expect(page.getByRole("heading", { name: sharedEvent.title })).toBeVisible();
});

test("the current mobile play surface is single-column and does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeSharedOnboarding(page);
  const choice = page.getByRole("button", { name: sharedEvent.choices[0].label });
  expect((await choice.boundingBox())?.width ?? 391).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("the name step prevents an unnamed protagonist", async ({ page }) => {
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await expect(page.getByRole("button", { name: "다음", exact: true })).toBeDisabled();
});

test("the shared menu opens records and starts a fresh simulation", async ({ page }) => {
  await completeSharedOnboarding(page);
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  await page.locator(".app-menu-popover").getByRole("button", { name: "기록", exact: true }).click();
  await expect(page.getByRole("heading", { name: "선택의 결과 기록" })).toBeVisible();
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  await page.getByRole("button", { name: "새 시뮬레이션", exact: true }).click();
  await expect(page.getByRole("heading", { name: "낯선 아침이 시작됩니다." })).toBeVisible();
});
