import { expect, test } from "@playwright/test";
import { completeSharedOnboarding, installSharedUiApi, sharedEvent } from "./helpers/shared-ui";

test("a current shared-UI choice posts its index and shows the result", async ({ page }) => {
  const api = await installSharedUiApi(page);
  await page.goto("/");
  await completeSharedOnboarding(page);
  await page.getByRole("button", { name: sharedEvent.choices[0].label }).click();

  expect(api.requests.find(({ path }) => path.endsWith("/choices"))).toMatchObject({
    method: "POST", path: "/api/characters/run-1/choices", body: { choiceIndex: 0 },
  });
  await expect(page.locator(".feedback-panel")).toContainText("실무 +2");
  await expect(page.locator(".feedback-panel")).toContainText("준비가 기록되었습니다.");
});

test("the shared gameplay surface renders current stats and event choices", async ({ page }) => {
  await installSharedUiApi(page);
  await page.goto("/");
  await completeSharedOnboarding(page);
  await expect(page.locator(".stats-grid")).toContainText("실무");
  await expect(page.locator(".choice-stack button")).toHaveCount(sharedEvent.choices.length);
});
