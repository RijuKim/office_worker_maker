import { expect, test } from "@playwright/test";
import { completeRealOnboarding, seedFixture } from "./helpers/real-ui";

test.beforeEach(({ viewport }) => test.skip((viewport?.width ?? 0) < 800, "database integration runs once in the desktop project"));

test("credential, job application, and career panels render persisted API data", async ({ page }, testInfo) => {
  const { character } = await completeRealOnboarding(page);
  await seedFixture(page, "career-panels", character.id);
  await page.reload();

  await expect(page.getByTestId("spec-panel")).toContainText("서비스 기획 포트폴리오");
  await expect(page.getByTestId("spec-panel")).toContainText("COMPLETED");
  await expect(page.getByTestId("job-application-panel")).toContainText("가상 테크");
  await expect(page.getByTestId("job-application-panel")).toContainText("FIRST_INTERVIEW");
  await expect(page.getByTestId("career-path-panel")).toContainText("프로덕트 매니저");
  await expect(page.getByTestId("career-path-panel")).toContainText("PREPARING");
  await testInfo.attach("persisted-career-panels", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("choice request posts its index and produces persisted event history", async ({ page }) => {
  const { character } = await completeRealOnboarding(page);
  const choice = page.locator(".choice-stack button").first();
  const responsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/characters/${character.id}/choices`) && response.request().method() === "POST");
  await choice.click();
  const response = await responsePromise;
  expect(response.request().postDataJSON()).toEqual({ choiceIndex: 0 });
  expect(response.status()).toBe(200);
  await expect(page.locator(".feedback-panel")).toBeVisible();
  await page.reload();
  const restored = await page.request.get(`/api/characters/${character.id}`);
  const restoredBody = await restored.json();
  expect(restoredBody.character.eventHistory.length).toBeGreaterThan(0);
  expect(restoredBody.character.eventHistory[0].summary).toBeTruthy();
});
