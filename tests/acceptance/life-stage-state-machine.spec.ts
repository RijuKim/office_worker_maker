import { expect, test } from "@playwright/test";
import { completeSharedOnboarding, installSharedUiApi, sharedEvent } from "./helpers/shared-ui";

test.beforeEach(async ({ page }) => {
  await installSharedUiApi(page);
  await page.goto("/");
  await completeSharedOnboarding(page);
});

test("play progress uses the current semester label rather than a fixed event counter", async ({ page }) => {
  await expect(page.getByText("2학년 1학기", { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+\s*\/\s*15/)).toHaveCount(0);
});

test("career choices remain player strategies rather than direct outcomes", async ({ page }) => {
  await expect(page.getByRole("button", { name: sharedEvent.choices[0].label })).toBeVisible();
  await expect(page.getByRole("button", { name: /통과한다|합격한다|탈락한다|떨어진다/ })).toHaveCount(0);
});

test("records do not expose internal route grades", async ({ page }) => {
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  await page.locator(".app-menu-popover").getByRole("button", { name: "기록", exact: true }).click();
  await expect(page.getByText(/GOOD ROUTE|MIXED ROUTE|HARD ROUTE|A등급|B등급|C등급/)).toHaveCount(0);
});
